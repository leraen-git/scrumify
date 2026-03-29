"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseJiraCSV, type ParsedImportData } from "@/lib/csvImportService";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function NewTeamForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [sprintDuration, setSprintDuration] = useState("2");
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedImportData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setParseError("Invalid file format. Please upload a Jira CSV export.");
      return;
    }
    setParseError(null);
    setParsedData(null);
    setConfirmed(false);
    setFileName(file.name);
    setParsing(true);
    try {
      const data = await parseJiraCSV(file);
      setParsedData(data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse CSV.");
      setFileName(null);
    } finally {
      setParsing(false);
    }
  }

  function clearFile() {
    setParsedData(null);
    setFileName(null);
    setParseError(null);
    setConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    startTransition(async () => {
      const teamRes = await fetch(`${apiUrl}/api/teams`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), sprintDuration: Number(sprintDuration) }),
      });
      if (!teamRes.ok) {
        const data = await teamRes.json().catch(() => ({}));
        setSubmitError(data.message ?? "Failed to create team.");
        return;
      }
      const team = await teamRes.json();
      router.push(`/teams/${team.id}/team`);
    });
  }

  function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!parsedData) return;
    setSubmitError(null);
    startTransition(async () => {
      // 1. Create team
      const teamRes = await fetch(`${apiUrl}/api/teams`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), sprintDuration: Number(sprintDuration) }),
      });
      if (!teamRes.ok) {
        const data = await teamRes.json().catch(() => ({}));
        setSubmitError(data.message ?? "Failed to create team.");
        return;
      }
      const team = await teamRes.json();

      // 2. Run Jira import
      const importRes = await fetch(`${apiUrl}/api/teams/${team.id}/import/jira`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sprints: parsedData.sprints,
          developers: parsedData.developers,
          tickets: parsedData.tickets,
        }),
      });
      if (!importRes.ok) {
        const data = await importRes.json().catch(() => ({}));
        setSubmitError(data.message ?? "Team created but import failed.");
        router.push(`/teams/${team.id}/team`);
        return;
      }

      router.push(`/teams/${team.id}/team`);
    });
  }

  const { summary } = parsedData ?? {};
  const hasImport = parsedData !== null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
      {/* Basic fields */}
      <form id="team-form" onSubmit={hasImport && confirmed ? handleImport : handleCreate} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Team Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Frontend Team"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sprintDuration">Sprint Duration</Label>
          <select
            id="sprintDuration"
            value={sprintDuration}
            onChange={(e) => setSprintDuration(e.target.value)}
            className="flex h-9 w-full items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="1">1 week</option>
            <option value="2">2 weeks</option>
            <option value="3">3 weeks</option>
            <option value="4">4 weeks</option>
          </select>
        </div>

        {/* CSV import section */}
        <div className="border-t border-gray-100 pt-5 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Import existing tickets <span className="text-gray-400 font-normal">(optional)</span></p>
            <p className="text-xs text-gray-400 mt-0.5">Supports standard Jira CSV export</p>
          </div>

          {!fileName ? (
            <label className="flex items-center gap-3 cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
              <Upload className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500">
                {parsing ? "Parsing CSV…" : "Click to upload a .csv file"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                disabled={parsing}
              />
            </label>
          ) : (
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50">
              <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">{fileName}</span>
              <button type="button" onClick={clearFile} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {parseError && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {parseError}
            </p>
          )}

          {/* Import Summary */}
          {summary && !confirmed && (
            <div className="border border-indigo-200 rounded-lg bg-indigo-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-indigo-800">📦 Import Summary</p>
              <div className="space-y-1 text-sm text-indigo-900">
                <p>✅ <strong>{summary.totalTickets}</strong> tickets found</p>
                <p>🗓️ <strong>{summary.sprintsDetected}</strong> sprints detected
                  <span className="text-indigo-600 ml-1">
                    ({summary.pastSprints} past · {summary.activeSprints} active · {summary.futureSprints} future)
                  </span>
                </p>
                <p>👤 <strong>{summary.developersFound}</strong> developers identified</p>
                {summary.ticketsWithNoSprint > 0 && (
                  <p className="text-amber-700">⚠️ {summary.ticketsWithNoSprint} tickets with no sprint → will go to Backlog</p>
                )}
                {summary.ticketsWithNoAssignee > 0 && (
                  <p className="text-amber-700">⚠️ {summary.ticketsWithNoAssignee} tickets with no assignee → will be unassigned</p>
                )}
                {summary.warnings.map((w, i) => (
                  <p key={i} className="text-amber-700">⚠️ {w}</p>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={clearFile}>
                  Cancel import
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => setConfirmed(true)}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Confirm Import
                </Button>
              </div>
            </div>
          )}

          {confirmed && summary && (
            <div className="border border-green-200 rounded-lg bg-green-50 px-4 py-2.5 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                Ready to import {summary.totalTickets} tickets, {summary.sprintsDetected} sprints, {summary.developersFound} developers.
              </p>
              <button type="button" onClick={() => setConfirmed(false)} className="ml-auto text-green-600 hover:text-green-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {submitError && <p className="text-xs text-red-500">{submitError}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <a href="/teams">
            <Button type="button" variant="outline">Cancel</Button>
          </a>
          {hasImport && confirmed ? (
            <Button type="submit" disabled={pending || !name.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              {pending ? "Importing…" : "Import & Initialize Team"}
            </Button>
          ) : (
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create Team"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
