"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ExternalLink, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type Team = {
  id: string;
  name: string;
  sprintDuration: number;
  _count: { developers: number; sprints: number };
  sprints: { id: string; status: string }[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function EditableRow({
  team,
  onSave,
  onDelete,
}: {
  team: Team;
  onSave: (id: string, name: string, sprintDuration: number) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [duration, setDuration] = useState(String(team.sprintDuration));

  async function save() {
    await onSave(team.id, name, Number(duration));
    setEditing(false);
  }

  function cancel() {
    setName(team.name);
    setDuration(String(team.sprintDuration));
    setEditing(false);
  }

  const hasActiveSprint = team.sprints.some((s) => s.status === "active");

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-4 py-3">
        {editing ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-sm" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{team.name}</span>
            {hasActiveSprint && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">active sprint</span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {editing ? (
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="h-7 rounded border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {[1, 2, 3, 4].map((w) => (
              <option key={w} value={w}>{w} week{w !== 1 ? "s" : ""}</option>
            ))}
          </select>
        ) : (
          `${team.sprintDuration} week${team.sprintDuration !== 1 ? "s" : ""}`
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {team._count.developers} dev{team._count.developers !== 1 ? "s" : ""} · {team._count.sprints} sprint{team._count.sprints !== 1 ? "s" : ""}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {editing ? (
            <>
              <button onClick={save} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
              <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <a href={`/teams/${team.id}`} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Open team dashboard">
                <ExternalLink className="h-4 w-4" />
              </a>
              <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => onDelete(team.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function TeamManager({
  teams,
  onTeamsChange,
}: {
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
}) {
  const [, startTransition] = useTransition();

  async function handleSave(id: string, name: string, sprintDuration: number) {
    const res = await fetch(`${apiUrl}/api/teams/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sprintDuration }),
    });
    if (res.ok) {
      onTeamsChange(teams.map((t) => (t.id === id ? { ...t, name, sprintDuration } : t)));
    }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await fetch(`${apiUrl}/api/teams/${id}`, { method: "DELETE", credentials: "include" });
      onTeamsChange(teams.filter((t) => t.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/teams/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </Link>
      </div>

      {/* Teams table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-medium text-gray-500 px-4 py-3">Name</th>
              <th className="text-left font-medium text-gray-500 px-4 py-3">Sprint</th>
              <th className="text-left font-medium text-gray-500 px-4 py-3">Stats</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {teams.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                  No teams yet. Create one above.
                </td>
              </tr>
            ) : (
              teams.map((team) => (
                <EditableRow
                  key={team.id}
                  team={team}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
