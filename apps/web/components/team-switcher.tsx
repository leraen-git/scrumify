"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Team {
  id: string;
  name: string;
  sprintDuration: number;
  _count: { developers: number };
}

interface TeamSwitcherProps {
  teams: Team[];
}

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const params = useParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentTeamId = params?.teamId as string | undefined;
  const currentTeam = teams.find((t) => t.id === currentTeamId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (teams.length === 0) {
    return (
      <Link href="/teams/new">
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          New Team
        </Button>
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 transition-colors"
      >
        <Users className="h-4 w-4 text-indigo-500" />
        <span>{currentTeam?.name ?? "Select team"}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            Teams
          </div>
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                router.push(`/teams/${team.id}`);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-indigo-50 ${
                team.id === currentTeamId ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700"
              }`}
            >
              <span className="flex-1">{team.name}</span>
              <span className="text-xs text-gray-400">{team._count.developers} devs</span>
            </button>
          ))}
          <div className="border-t border-gray-100">
            <Link
              href="/teams/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Team
            </Link>
            <Link
              href="/teams"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Users className="h-4 w-4" />
              Manage Teams
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
