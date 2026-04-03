"use client";

import { useState, useRef, useCallback } from "react";
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

  // ── Charts ────────────────────────────────────────────────────────────────
  if (selected.has("charts")) {
    // Chart 1: Category Distribution — Pie chart
    if (data.categories.length > 0) {
      const s = prs.addSlide();
      addHeader(s, "Category Distribution (Story Points)");

      s.addChart("pie" as never, [{
        name: "SP per Category",
        labels: data.categories.map((c) => safe(c.label)),
        values: data.categories.map((c) => c.sp),
      }], {
        x: 0.8, y: 0.85, w: 8.4, h: 4.5,
        showLegend: true,
        legendPos: "r",
        showPercent: true,
        dataLabelFontSize: 12,
        legendFontSize: 13,
        chartColors: data.categories.map((c) => c.color.replace("#", "").toUpperCase()),
      } as never);
    }

    // Chart 2: Story Status Distribution — Horizontal bar chart
    const statusCounts = STATUS_ORDER
      .map((k) => ({ label: STATUS_LABELS[k], count: data.storiesByStatus[k].length }))
      .filter((d) => d.count > 0);

    if (statusCounts.length > 0) {
      const s = prs.addSlide();
      addHeader(s, "Story Status Distribution");

      const barColors: Record<string, string> = {
        "Done":                 "22C55E",
        "In Progress":          "F59E0B",
        "Dev Done / Testing":   "A855F7",
        "To Do":                "94A3B8",
      };

      s.addChart("bar" as never, [{
        name: "Stories",
        labels: statusCounts.map((d) => d.label),
        values: statusCounts.map((d) => d.count),
      }], {
        x: 0.6, y: 0.85, w: 8.8, h: 4.3,
        barDir: "bar",
        showLegend: false,
        showValue: true,
        dataLabelFontSize: 13,
        dataLabelColor: "FFFFFF",
        chartColors: statusCounts.map((d) => barColors[d.label] ?? "94A3B8"),
        valAxisHidden: true,
        catAxisLabelFontSize: 13,
      } as never);
    }

    // Chart 3: SP Done vs Capacity — Column chart
    {
      const s = prs.addSlide();
      addHeader(s, "Sprint Progress — Story Points");

      s.addChart("bar" as never, [{
        name: "Story Points",
        labels: ["Capacity", "Planned", "Done"],
        values: [data.capacity, data.totalPoints, data.donePoints],
      }], {
        x: 1.5, y: 0.85, w: 7.0, h: 4.3,
        barDir: "col",
        showLegend: false,
        showValue: true,
        dataLabelFontSize: 14,
        dataLabelColor: "FFFFFF",
        chartColors: [C.primaryDk, "6B7280", "22C55E"],
        valAxisHidden: true,
        catAxisLabelFontSize: 14,
      } as never);
    }
  }

  await prs.writeFile({
    fileName: `${data.name.replace(/[^a-z0-9\-_]/gi, "_")}_sprint_review.pptx`,
  });
}

// ─── PNG generation (dynamic import — captures hidden div) ────────────────

async function generatePng(ref: React.RefObject<HTMLDivElement | null>, name: string) {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(ref.current!, {
    backgroundColor: "#ffffff",
    scale: 2,           // 2× resolution for crisp output
    useCORS: true,      // allow external images (avatars etc.) without taint
    allowTaint: false,
    logging: false,
  });
  const link = document.createElement("a");
  link.download = `${name.replace(/[^a-z0-9\-_]/gi, "_")}_sprint_review.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ─── Hidden export preview (rendered off-screen for PNG capture) ──────────

function ExportPreview({ data, selected }: { data: SprintExportData; selected: Set<SectionKey> }) {
  const totalStories = Object.values(data.storiesByStatus).reduce((a, arr) => a + arr.length, 0);

  const sectionStyle: React.CSSProperties = {
    marginBottom: 32,
    padding: 24,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  };
  const headingStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: "#4f46e5",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "2px solid #e0e7ff",
  };
  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 12,
  };
  const thStyle: React.CSSProperties = {
    background: "#f9fafb",
    color: "#374151",
    fontWeight: 600,
    padding: "6px 10px",
    border: "1px solid #e5e7eb",
    textAlign: "left" as const,
  };
  const tdStyle: React.CSSProperties = {
    padding: "5px 10px",
    border: "1px solid #e5e7eb",
    color: "#1f2937",
    fontSize: 11,
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Arial, sans-serif", background: "#f8f9fa", padding: 24 }}>
      {/* Header */}
      <div style={{ background: "#6366f1", borderRadius: 8, padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#ffffff" }}>{data.name}</div>
        <div style={{ fontSize: 12, color: "#e0e7ff", marginTop: 4 }}>
          {data.teamName} · {data.startDate} → {data.endDate}
        </div>
      </div>

      {/* Summary */}
      {selected.has("summary") && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Sprint Summary</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "Capacity",  value: `${data.capacity} SP`, color: "#4f46e5" },
              { label: "Done",      value: `${data.donePoints} SP`, color: "#22c55e" },
              { label: "Progress",  value: `${data.progress}%`, color: data.progress >= 80 ? "#22c55e" : data.progress >= 50 ? "#f59e0b" : "#ef4444" },
              { label: "Stories",   value: String(totalStories), color: "#4f46e5" },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, background: "#f5f3ff", border: "1px solid #e0e7ff", borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {selected.has("categories") && data.categories.length > 0 && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Category Breakdown</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Category", "Stories", "SP Done", "SP Total", "Done %"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.key}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.color, marginRight: 6 }} />
                    {c.label}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>{c.count}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 600, color: "#4f46e5" }}>{c.spDone}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>{c.sp}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                    {c.sp > 0 ? `${Math.round((c.spDone / c.sp) * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transition Times */}
      {selected.has("times") && (data.avgDevMs !== null || data.avgTestMs !== null) && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Avg Transition Times</div>
          <div style={{ display: "flex", gap: 16 }}>
            {data.avgDevMs !== null && (
              <div style={{ flex: 1, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{fmtMs(data.avgDevMs)}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>In Progress → Dev Done</div>
              </div>
            )}
            {data.avgTestMs !== null && (
              <div style={{ flex: 1, background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 8, padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#a855f7" }}>{fmtMs(data.avgTestMs)}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Testing → Done</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      {selected.has("charts") && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Charts</div>

          {/* Category Distribution — stacked bar */}
          {data.categories.length > 0 && data.totalPoints > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Category Distribution (Story Points)
              </p>
              <div style={{ display: "flex", height: 24, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                {data.categories.map((c) => (
                  <div
                    key={c.key}
                    style={{ width: `${(c.sp / data.totalPoints) * 100}%`, backgroundColor: c.color }}
                    title={`${c.label}: ${c.sp} SP`}
                  />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "6px 20px" }}>
                {data.categories.map((c) => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c.color, flexShrink: 0 }} />
                    {c.label}: <strong>{c.sp} SP</strong>&nbsp;({Math.round((c.sp / data.totalPoints) * 100)}%)
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SP Progress — Capacity vs Done */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Sprint Progress (Story Points)</p>
            {[
              { label: "Capacity", value: data.capacity, color: "#6366f1", max: Math.max(data.capacity, data.totalPoints, data.donePoints) },
              { label: "Planned",  value: data.totalPoints, color: "#6b7280", max: Math.max(data.capacity, data.totalPoints, data.donePoints) },
              { label: "Done",     value: data.donePoints, color: "#22c55e", max: Math.max(data.capacity, data.totalPoints, data.donePoints) },
            ].map((row) => (
              <div key={row.label} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 3 }}>
                  <span>{row.label}</span>
                  <span style={{ fontWeight: 600, color: "#1f2937" }}>{row.value} SP</span>
                </div>
                <div style={{ height: 10, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${row.max > 0 ? (row.value / row.max) * 100 : 0}%`, height: "100%", backgroundColor: row.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Story Status Distribution */}
          {(() => {
            const totalStories = Object.values(data.storiesByStatus).reduce((a, arr) => a + arr.length, 0);
            if (totalStories === 0) return null;
            const statusColors: Record<string, string> = {
              done: "#22c55e", in_progress: "#f59e0b", dev_done: "#a855f7", todo: "#94a3b8",
            };
            return (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Story Status Distribution</p>
                {STATUS_ORDER.map((k) => {
                  const count = data.storiesByStatus[k].length;
                  if (count === 0) return null;
                  const pct = Math.round((count / totalStories) * 100);
                  return (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 3 }}>
                        <span>{STATUS_LABELS[k]}</span>
                        <span style={{ fontWeight: 600, color: "#1f2937" }}>{count} stories ({pct}%)</span>
                      </div>
                      <div style={{ height: 10, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: statusColors[k], borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Stories by Status */}
      {selected.has("stories") && STATUS_ORDER.map((statusKey) => {
        const stories = data.storiesByStatus[statusKey];
        if (stories.length === 0) return null;
        return (
          <div key={statusKey} style={sectionStyle}>
            <div style={headingStyle}>Stories — {STATUS_LABELS[statusKey]}</div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["#", "Title", "Category", "SP", "Assignee"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stories.map((story, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    <td style={{ ...tdStyle, color: "#6b7280", textAlign: "center", width: 30 }}>{idx + 1}</td>
                    <td style={tdStyle}>{story.title}</td>
                    <td style={{ ...tdStyle, color: "#6b7280" }}>{story.categoryLabel}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "#4f46e5", textAlign: "center", width: 40 }}>{story.storyPoints}</td>
                    <td style={{ ...tdStyle, color: "#6b7280" }}>{story.assigneeName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export function SprintExportModal({ data }: { data: SprintExportData }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(
    () => new Set(SECTIONS.map((s) => s.key))
  );
  const [format, setFormat] = useState<"pptx" | "png">("pptx");
  const [loading, setLoading] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

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
    try {
      if (format === "pptx") {
        await generatePptx(data, selected);
      } else {
        if (!exportRef.current) return;
        await generatePng(exportRef, data.name);
      }
      setOpen(false);
    } catch (err) {
      console.error("[SprintExport] generation failed:", err);
      // Keep modal open so user can retry
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

      {/* Hidden div for PNG capture — always in DOM, positioned off-screen */}
      <div
        ref={exportRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-99999px",
          left: "-99999px",
          width: "1200px",
          pointerEvents: "none",
        }}
      >
        <ExportPreview data={data} selected={selected} />
      </div>
    </>
  );
}
