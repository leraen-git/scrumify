"use client";

import { useState, useCallback } from "react";
import { Download, X } from "lucide-react";

// ─── Public types (used by page.tsx to build the prop) ────────────────────

export interface ExportStory {
  title: string;
  category: string;
  categoryLabel: string;
  storyPoints: number;
  assigneeName: string | null;
}

export interface ExportCategory {
  key: string;
  label: string;
  color: string;
  count: number;
  sp: number;
  spDone: number;
}

export interface BugsByEnvironment {
  dev: number;
  staging: number;
  preprod: number;
  prod: number;
  unset: number;
}

export interface SprintExportData {
  name: string;
  teamName: string;
  startDate: string;
  endDate: string;
  capacity: number;
  donePoints: number;
  totalPoints: number;
  progress: number;
  categories: ExportCategory[];
  avgDevMs: number | null;
  avgTestMs: number | null;
  bugsByEnvironment: BugsByEnvironment | null;
  storiesByStatus: {
    todo: ExportStory[];
    in_progress: ExportStory[];
    dev_done: ExportStory[];
    done: ExportStory[];
  };
}

// ─── Constants ────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "summary",    label: "Sprint Summary" },
  { key: "charts",     label: "Charts" },
  { key: "categories", label: "Category Breakdown" },
  { key: "times",      label: "Avg Transition Times" },
  { key: "stories",    label: "Stories by Status" },
] as const;

type SectionKey = typeof SECTIONS[number]["key"];

const STATUS_LABELS: Record<string, string> = {
  done:        "Done",
  in_progress: "In Progress",
  dev_done:    "Dev Done / Testing",
  todo:        "To Do",
};

// Stories are exported in this order (most relevant first for sprint review)
const STATUS_ORDER = ["done", "in_progress", "dev_done", "todo"] as const;

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "< 1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// Safe string: strip control chars that can break pptxgenjs XML
function safe(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

// ─── PPTX generation (dynamic import — never runs on server) ──────────────

async function generatePptx(data: SprintExportData, selected: Set<SectionKey>) {
  // Dynamic import: avoids SSR crash and lazy-loads ~1MB bundle only on demand
  const PptxGenJS = (await import("pptxgenjs")).default;
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_16x9"; // 10" × 5.625"
  prs.title = `${data.name} — Sprint Review`;
  prs.author = "ARGO";

  // Palette (no leading #, pptxgenjs uses raw hex)
  const C = {
    primary:   "6366F1",
    primaryDk: "4F46E5",
    surface:   "F5F3FF",
    accentLight: "E0E7FF",
    white:     "FFFFFF",
    headerBg:  "F9FAFB",
    border:    "E5E7EB",
    textDark:  "1F2937",
    textMid:   "374151",
    textMuted: "6B7280",
    green:     "22C55E",
    amber:     "F59E0B",
    red:       "EF4444",
    amberBg:   "FFFBEB",
    amberBorder: "FDE68A",
    purple:    "A855F7",
    purpleBg:  "FAF5FF",
    purpleBorder: "E9D5FF",
  };

  // Shared: indigo header bar + title text
  const addHeader = (slide: ReturnType<typeof prs.addSlide>, title: string) => {
    slide.background = { color: C.white };
    slide.addShape("rect" as never, {
      x: 0, y: 0, w: "100%", h: 0.72,
      fill: { color: C.primary },
      line: { color: C.primary, pt: 0 },
    });
    slide.addText(safe(title), {
      x: 0.35, y: 0.08, w: 9.3, h: 0.56,
      fontSize: 18, bold: true, color: C.white, valign: "middle",
    });
  };

  // ── Slide 1: Sprint Summary ──────────────────────────────────────────────
  if (selected.has("summary")) {
    const s = prs.addSlide();
    s.background = { color: C.white };

    // Large header bar
    s.addShape("rect" as never, {
      x: 0, y: 0, w: "100%", h: 1.35,
      fill: { color: C.primary },
      line: { color: C.primary, pt: 0 },
    });
    s.addText(safe(data.name), {
      x: 0.4, y: 0.12, w: 9.2, h: 0.72,
      fontSize: 30, bold: true, color: C.white,
    });
    s.addText(safe(`${data.teamName}  ·  ${data.startDate} → ${data.endDate}`), {
      x: 0.4, y: 0.84, w: 9.2, h: 0.36,
      fontSize: 12, color: C.accentLight,
    });

    // 4 stat cards
    const totalStories = Object.values(data.storiesByStatus).reduce((a, arr) => a + arr.length, 0);
    const progressColor = data.progress >= 80 ? C.green : data.progress >= 50 ? C.amber : C.red;
    const stats = [
      { label: "Capacity",  value: `${data.capacity} SP`, color: C.primaryDk },
      { label: "Done",      value: `${data.donePoints} SP`, color: C.green },
      { label: "Progress",  value: `${data.progress}%`, color: progressColor },
      { label: "Stories",   value: String(totalStories), color: C.primaryDk },
    ];

    stats.forEach((stat, i) => {
      const x = 0.38 + i * 2.36;
      s.addShape("rect" as never, {
        x, y: 1.55, w: 2.12, h: 1.65,
        fill: { color: C.surface },
        line: { color: C.accentLight, pt: 1 },
      });
      s.addText(safe(stat.value), {
        x: x + 0.05, y: 1.72, w: 2.02, h: 0.82,
        fontSize: 30, bold: true, color: stat.color, align: "center",
      });
      s.addText(safe(stat.label), {
        x: x + 0.05, y: 2.54, w: 2.02, h: 0.36,
        fontSize: 12, color: C.textMuted, align: "center",
      });
    });

    // Footer note
    s.addText(safe(`${data.donePoints} done out of ${data.capacity} SP capacity`), {
      x: 0.4, y: 3.42, w: 9.2, h: 0.32,
      fontSize: 11, color: C.textMuted, align: "center",
    });
  }

  // ── Slide 2: Category Breakdown ──────────────────────────────────────────
  if (selected.has("categories") && data.categories.length > 0) {
    const s = prs.addSlide();
    addHeader(s, "Category Breakdown");

    const header = [
      { text: "Category",  options: { bold: true, color: C.textMid, fill: { color: C.headerBg } } },
      { text: "Stories",   options: { bold: true, color: C.textMid, fill: { color: C.headerBg }, align: "center" as const } },
      { text: "SP Done",   options: { bold: true, color: C.textMid, fill: { color: C.headerBg }, align: "center" as const } },
      { text: "SP Total",  options: { bold: true, color: C.textMid, fill: { color: C.headerBg }, align: "center" as const } },
      { text: "Done %",    options: { bold: true, color: C.textMid, fill: { color: C.headerBg }, align: "center" as const } },
    ];

    const dataRows = data.categories.map((c) => [
      { text: safe(c.label),         options: { bold: true, color: C.textDark } },
      { text: String(c.count),       options: { color: C.textMuted, align: "center" as const } },
      { text: String(c.spDone),      options: { bold: true, color: C.primaryDk, align: "center" as const } },
      { text: String(c.sp),          options: { color: C.textMuted, align: "center" as const } },
      { text: c.sp > 0 ? `${Math.round((c.spDone / c.sp) * 100)}%` : "—", options: { color: C.textMuted, align: "center" as const } },
    ]);

    s.addTable([header, ...dataRows] as never, {
      x: 0.4, y: 0.88, w: 9.2,
      colW: [3.6, 1.5, 1.5, 1.5, 1.6],
      border: { type: "solid", pt: 0.5, color: C.border },
      fontSize: 13,
      rowH: 0.44,
      align: "left",
    });
  }

  // ── Slide 3: Avg Transition Times ─────────────────────────────────────────
  if (selected.has("times") && (data.avgDevMs !== null || data.avgTestMs !== null)) {
    const s = prs.addSlide();
    addHeader(s, "Avg Transition Times");

    type Block = { label: string; value: string; color: string; bg: string; border: string };
    const blocks: Block[] = [];
    if (data.avgDevMs !== null) blocks.push({
      label: "In Progress → Dev Done",
      value: fmtMs(data.avgDevMs),
      color: C.amber, bg: C.amberBg, border: C.amberBorder,
    });
    if (data.avgTestMs !== null) blocks.push({
      label: "Testing → Done",
      value: fmtMs(data.avgTestMs),
      color: C.purple, bg: C.purpleBg, border: C.purpleBorder,
    });

    const cardW = 4.2;
    const totalW = blocks.length * cardW + (blocks.length - 1) * 0.6;
    const startX = (10 - totalW) / 2;

    blocks.forEach((b, i) => {
      const x = startX + i * (cardW + 0.6);
      s.addShape("rect" as never, {
        x, y: 1.05, w: cardW, h: 2.4,
        fill: { color: b.bg },
        line: { color: b.border, pt: 1 },
      });
      s.addText(safe(b.value), {
        x: x + 0.1, y: 1.25, w: cardW - 0.2, h: 1.2,
        fontSize: 48, bold: true, color: b.color, align: "center", valign: "middle",
      });
      s.addText(safe(b.label), {
        x: x + 0.1, y: 2.55, w: cardW - 0.2, h: 0.45,
        fontSize: 13, color: C.textMuted, align: "center",
      });
    });
  }

  // ── Slides 4+: Stories by Status ─────────────────────────────────────────
  if (selected.has("stories")) {
    for (const statusKey of STATUS_ORDER) {
      const stories = data.storiesByStatus[statusKey];
      if (stories.length === 0) continue;

      const totalPages = Math.ceil(stories.length / PAGE_SIZE);

      for (let page = 0; page < totalPages; page++) {
        const slice = stories.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const pageLabel = totalPages > 1 ? ` (${page + 1}/${totalPages})` : "";
        const title = `Stories — ${STATUS_LABELS[statusKey]}${pageLabel}`;

        const s = prs.addSlide();
        addHeader(s, title);

        const header = [
          { text: "#",        options: { bold: true, color: C.textMid, fill: { color: C.headerBg }, align: "center" as const } },
          { text: "Title",    options: { bold: true, color: C.textMid, fill: { color: C.headerBg } } },
          { text: "Category", options: { bold: true, color: C.textMid, fill: { color: C.headerBg } } },
          { text: "SP",       options: { bold: true, color: C.textMid, fill: { color: C.headerBg }, align: "center" as const } },
          { text: "Assignee", options: { bold: true, color: C.textMid, fill: { color: C.headerBg } } },
        ];

        const dataRows = slice.map((story, idx) => [
          { text: String(page * PAGE_SIZE + idx + 1), options: { color: C.textMuted, align: "center" as const } },
          { text: safe(story.title),                  options: { color: C.textDark } },
          { text: safe(story.categoryLabel),          options: { color: C.textMuted } },
          { text: String(story.storyPoints),          options: { bold: true, color: C.primaryDk, align: "center" as const } },
          { text: safe(story.assigneeName ?? "—"),    options: { color: C.textMuted } },
        ]);

        s.addTable([header, ...dataRows] as never, {
          x: 0.4, y: 0.88,
          w: 9.2,
          colW: [0.5, 4.4, 1.7, 0.65, 2.0],
          border: { type: "solid", pt: 0.5, color: C.border },
          fontSize: 11,
          rowH: 0.3,
          align: "left",
        });
      }
    }
  }

  // ── Charts — screenshot actual DOM elements ───────────────────────────────
  if (selected.has("charts")) {
    const { toPng } = await import("html-to-image");

    // Helper: capture a DOM element to base64 PNG
    const capture = async (selector: string): Promise<string | null> => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      try {
        return await toPng(el, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });
      } catch {
        return null;
      }
    };

    // Capture the whole charts section (velocity + donut + bug env)
    const chartsImg = await capture('[data-export-section="charts"]');
    if (chartsImg) {
      const s = prs.addSlide();
      addHeader(s, "Charts Overview");
      s.addImage({ data: chartsImg, x: 0.3, y: 0.82, w: 9.4, h: 4.5 });
    }

    // Bug env chart as its own dedicated slide (exact screenshot)
    const bugImg = await capture('[data-export-chart="bug-env"]');
    if (bugImg) {
      const s = prs.addSlide();
      addHeader(s, "Bugs by Environment");
      s.addImage({ data: bugImg, x: 0.3, y: 0.82, w: 9.4, h: 4.5 });
    }
  }

  await prs.writeFile({
    fileName: `${data.name.replace(/[^a-z0-9\-_]/gi, "_")}_sprint_review.pptx`,
  });
}

// ─── PNG generation — captures real page sections by data-export-section ────

async function generatePng(selected: Set<SectionKey>, name: string) {
  const { toCanvas } = await import("html-to-image");

  const sectionOrder: SectionKey[] = ["summary", "charts", "categories", "times", "stories"];
  const canvases: HTMLCanvasElement[] = [];

  for (const key of sectionOrder) {
    if (!selected.has(key)) continue;
    const el = document.querySelector(`[data-export-section="${key}"]`) as HTMLElement | null;
    if (!el) continue;
    try {
      const c = await toCanvas(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      canvases.push(c);
    } catch {
      // skip sections that fail to capture
    }
  }

  if (canvases.length === 0) return;

  const gap = 16;
  const pad = 24;
  const totalH = pad + canvases.reduce((h, c) => h + c.height + gap, 0);
  const maxW   = Math.max(...canvases.map((c) => c.width)) + pad * 2;

  const combined = document.createElement("canvas");
  combined.width  = maxW;
  combined.height = totalH;
  const ctx = combined.getContext("2d")!;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, maxW, totalH);

  let y = pad;
  for (const c of canvases) {
    ctx.drawImage(c, pad, y);
    y += c.height + gap;
  }

  combined.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.download = `${name.replace(/[^a-z0-9\-_]/gi, "_")}_sprint_review.png`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ─── Main component ───────────────────────────────────────────────────────

export function SprintExportModal({ data }: { data: SprintExportData }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(
    () => new Set(SECTIONS.map((s) => s.key))
  );
  const [format, setFormat] = useState<"pptx" | "png">("pptx");
  const [loading, setLoading] = useState(false);

  const toggleSection = useCallback((key: SectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading(true);
    // Close the modal first — the backdrop (bg-black/40) would otherwise
    // occlude page elements and break html2canvas DOM capture.
    setOpen(false);
    // Wait two animation frames so React flushes the state update and the
    // browser has fully repainted without the overlay before we capture.
    await new Promise<void>((resolve) => requestAnimationFrame(() => { requestAnimationFrame(() => resolve()); }));
    try {
      if (format === "pptx") {
        await generatePptx(data, selected);
      } else {
        await generatePng(selected, data.name);
      }
    } catch (err) {
      console.error("[SprintExport] generation failed:", err);
    } finally {
      setLoading(false);
    }
  }, [data, selected, format]);

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
      >
        <Download className="h-4 w-4" />
        Export
      </button>

      {/* Backdrop + Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Export Sprint Review</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Format toggle */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Format</p>
                <div className="flex gap-2">
                  {(["pptx", "png"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        format === f
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {f === "pptx" ? "PowerPoint (.pptx)" : "Image (.png)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section checkboxes */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Sections</p>
                <div className="space-y-1">
                  {SECTIONS.map((section) => (
                    <label
                      key={section.key}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(section.key)}
                        onChange={() => toggleSection(section.key)}
                        className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {selected.size === 0 ? "Select at least one section" : `${selected.size} section${selected.size > 1 ? "s" : ""} selected`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={loading || selected.size === 0}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Generating…" : "Download"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
