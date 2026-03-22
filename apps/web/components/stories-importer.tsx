"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, FileUp, Info, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

type StoryStatus = "todo" | "in_progress" | "done";

interface Mapping {
  idCol: string;
  titleCol: string;
  spCol: string;
  statusCol: string;
  categoryCol: string;
  assigneeCol: string;
}

function normalizeStatus(raw: unknown): StoryStatus {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (s === "done" || s === "completed" || s === "finished") return "done";
  if (s === "in_progress" || s === "wip" || s === "doing" || s === "started")
    return "in_progress";
  return "todo";
}

const VALID_CATEGORIES = new Set(["user_story", "bug", "mco", "best_effort", "tech_lead"]);

function normalizeCategory(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (VALID_CATEGORIES.has(s)) return s;
  if (s === "userstory" || s === "us" || s === "business" || s === "user story") return "user_story";
  if (s === "defect" || s === "fix") return "bug";
  if (s === "tech" || s === "techlead" || s === "tl") return "tech_lead";
  if (s === "be" || s === "bestef" || s === "best effort") return "best_effort";
  return "user_story";
}

function autoDetect(keys: string[]): Mapping {
  return {
    idCol: keys.find((k) => /^id$/i.test(k)) ?? keys.find((k) => /\bid\b/i.test(k)) ?? "",
    titleCol: keys.find((k) => /title|name|description|story/i.test(k)) ?? keys[0] ?? "",
    spCol: keys.find((k) => /point|sp|effort|estimate/i.test(k)) ?? "",
    statusCol: keys.find((k) => /status|state/i.test(k)) ?? "",
    categoryCol: keys.find((k) => /category|type|kind/i.test(k)) ?? "",
    assigneeCol: keys.find((k) => /assign|owner|dev|member/i.test(k)) ?? "",
  };
}

const STATUS_LABELS: Record<StoryStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_COLORS: Record<StoryStatus, string> = {
  todo: "bg-gray-100 text-gray-600",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-green-100 text-green-700",
};

interface Props {
  sprintId: string;
  teamId: string;
  existingCount: number;
}

export function StoriesImporter({ sprintId, teamId, existingCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({
    idCol: "",
    titleCol: "",
    spCol: "",
    statusCol: "",
    categoryCol: "",
    assigneeCol: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showInfo, setShowInfo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stories = rawRows
    .map((row) => ({
      id: mapping.idCol ? String(row[mapping.idCol] ?? "").trim() : "",
      title: String(row[mapping.titleCol] ?? "").trim(),
      storyPoints: Math.max(1, parseInt(String(row[mapping.spCol] ?? "1"), 10) || 1),
      status: normalizeStatus(mapping.statusCol ? row[mapping.statusCol] : ""),
      category: normalizeCategory(mapping.categoryCol ? row[mapping.categoryCol] : ""),
      assigneeName: mapping.assigneeCol ? String(row[mapping.assigneeCol] ?? "").trim() : "",
    }))
    .filter((s) => s.title);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setRawRows([]);
    setHeaders([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const workbook = XLSX.read(ev.target?.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });
        if (rows.length === 0) {
          setError("No rows found in the file.");
          return;
        }
        const keys = Object.keys(rows[0]);
        setHeaders(keys);
        setRawRows(rows);
        setMapping(autoDetect(keys));
      } catch {
        setError("Could not read the file. Make sure it's a valid CSV or Excel file.");
      }
    };
    reader.onerror = () => setError("Failed to read the file.");
    reader.readAsArrayBuffer(file);
  }

  function handleImport() {
    if (!stories.length) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    startTransition(async () => {
      await fetch(`${apiUrl}/api/teams/${teamId}/sprints/${sprintId}/stories/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stories }),
      });
      handleClose();
      router.refresh();
    });
  }

  function handleClose() {
    setOpen(false);
    setRawRows([]);
    setHeaders([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <FileUp className="h-4 w-4 mr-1.5" />
        Import CSV / Excel
      </Button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <FileUp className="h-4 w-4 text-indigo-500" />
            Import User Stories
          </h3>
          {/* Info bubble */}
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              onFocus={() => setShowInfo(true)}
              onBlur={() => setShowInfo(false)}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <Info className="h-4 w-4" />
            </button>
            {showInfo && (
              <div className="absolute left-6 top-0 z-20 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs text-gray-600 leading-relaxed">
                <p className="font-semibold text-gray-800 mb-1.5">Expected format</p>
                <p className="mb-1">Upload a <strong>.csv</strong>, <strong>.xls</strong>, or <strong>.xlsx</strong> file. The first row must be headers.</p>
                <p className="mb-1">Column names are detected automatically, or you can map them manually below after uploading.</p>
                <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-gray-500">
                  <li><strong className="text-gray-700">ID *</strong> — story identifier (from export)</li>
                  <li><strong className="text-gray-700">Title *</strong> — story name / description</li>
                  <li><strong className="text-gray-700">Points</strong> — story points (number)</li>
                  <li><strong className="text-gray-700">Status</strong> — todo · in progress · done</li>
                  <li><strong className="text-gray-700">Category *</strong> — user_story · bug · mco · best_effort · tech_lead</li>
                  <li><strong className="text-gray-700">Assignee</strong> — developer name (optional)</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Existing stories warning */}
      {existingCount > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            This sprint already has <strong>{existingCount} stor{existingCount !== 1 ? "ies" : "y"}</strong>.
            Importing will <strong>replace all of them</strong>.
          </span>
        </div>
      )}

      {/* File input */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        onChange={handleFile}
        className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
      />

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {/* Column mapping */}
      {headers.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 p-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-700 mb-3">Column mapping</p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { label: "ID *", key: "idCol", required: true },
                { label: "Title *", key: "titleCol", required: true },
                { label: "Story Points", key: "spCol", required: false },
                { label: "Status", key: "statusCol", required: false },
                { label: "Category *", key: "categoryCol", required: false },
                { label: "Assignee", key: "assigneeCol", required: false },
              ] as const
            ).map(({ label, key, required }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <select
                  value={mapping[key]}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [key]: e.target.value }))
                  }
                  className="w-full h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {!required && <option value="">(none)</option>}
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {stories.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Preview — {stories.length} stor{stories.length !== 1 ? "ies" : "y"} ready to import
          </p>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Title</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium w-12">SP</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium w-24">Status</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium w-28">Category</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {stories.slice(0, 10).map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 text-gray-800">{s.title}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{s.storyPoints}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[s.status]}`}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{s.category}</td>
                    <td className="px-3 py-2 text-gray-600">{s.assigneeName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stories.length > 10 && (
              <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                … and {stories.length - 10} more
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleImport} disabled={pending}>
              {pending
                ? "Importing…"
                : `Import ${stories.length} stor${stories.length !== 1 ? "ies" : "y"}`}
            </Button>
            <Button variant="outline" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
