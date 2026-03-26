"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Trash2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Team = { id: string; name: string };
type User = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  accessToken: string | null;
  assignedTeamId: string | null;
  assignedTeam: { id: string; name: string } | null;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const el = document.createElement("textarea");
          el.value = text;
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 text-gray-400 hover:text-indigo-600 transition-colors"
      title="Copy link"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function UserManager({
  users: initialUsers,
  teams,
  baseUrl,
}: {
  users: User[];
  teams: Team[];
  baseUrl: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [newAccessLink, setNewAccessLink] = useState<string | null>(null);

  // Keep selected teamId valid when teams list changes
  const effectiveTeamId = teams.some((t) => t.id === teamId) ? teamId : (teams[0]?.id ?? "");

  function accessLink(token: string) {
    return `${baseUrl}/access/${token}`;
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewAccessLink(null);
    startTransition(async () => {
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, teamId: effectiveTeamId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create user");
        return;
      }
      const user = await res.json();
      setUsers((prev) => [...prev, user]);
      setName("");
      if (user.accessToken) setNewAccessLink(accessLink(user.accessToken));
    });
  }

  function handleDelete(userId: string) {
    startTransition(async () => {
      await fetch(`${apiUrl}/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    });
  }

  async function handleTeamChange(userId: string, newTeamId: string) {
    const res = await fetch(`${apiUrl}/api/admin/users/${userId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: newTeamId }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    }
  }

  async function handleRegenerate(userId: string) {
    const res = await fetch(`${apiUrl}/api/admin/users/${userId}/regenerate-token`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === data.id ? { ...u, accessToken: data.accessToken } : u))
      );
    }
  }

  const regularUsers = users.filter((u) => u.role !== "admin");
  const adminUsers = users.filter((u) => u.role === "admin");

  return (
    <div className="space-y-4">
      {/* Add user form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px] space-y-1">
            <Label htmlFor="user-name" className="text-xs">Name</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="flex-1 min-w-[160px] space-y-1">
            <Label htmlFor="user-team" className="text-xs">Team</Label>
            <select
              id="user-team"
              value={effectiveTeamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              {teams.length === 0 && <option value="">— create a team first —</option>}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending || teams.length === 0} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        </form>
        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Access link banner shown right after creation */}
        {newAccessLink && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-green-800 mb-0.5">User created — share this access link</p>
              <code className="text-xs text-green-700 break-all">{newAccessLink}</code>
            </div>
            <CopyButton text={newAccessLink} />
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-medium text-gray-500 px-4 py-3">Name</th>
              <th className="text-left font-medium text-gray-500 px-4 py-3">Team</th>
              <th className="text-left font-medium text-gray-500 px-4 py-3">Access link</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {adminUsers.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.email ?? u.name}
                  <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">admin</span>
                </td>
                <td className="px-4 py-3 text-gray-500">All teams</td>
                <td className="px-4 py-3 text-gray-400 text-xs italic">Password login</td>
                <td className="px-4 py-3"></td>
              </tr>
            ))}
            {regularUsers.length === 0 && adminUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                  No users yet. Add one above.
                </td>
              </tr>
            )}
            {regularUsers.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.assignedTeamId ?? ""}
                    onChange={(e) => handleTeamChange(u.id, e.target.value)}
                    className="h-7 rounded border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.accessToken ? (
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 max-w-[220px] truncate">
                        {accessLink(u.accessToken)}
                      </code>
                      <CopyButton text={accessLink(u.accessToken)} />
                      <button
                        onClick={() => handleRegenerate(u.id)}
                        className="text-gray-400 hover:text-amber-500 transition-colors"
                        title="Regenerate link"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
