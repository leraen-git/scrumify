"use client";

import { CalendarDays, LayoutDashboard, Settings, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Dashboard", icon: LayoutDashboard, href: (id: string) => `/teams/${id}`, exact: true },
  { label: "Sprint", icon: CalendarDays, href: (id: string) => `/teams/${id}/sprints` },
  { label: "Velocity", icon: TrendingUp, href: (id: string) => `/teams/${id}/velocity` },
  { label: "Team", icon: Users, href: (id: string) => `/teams/${id}/team` },
  { label: "Settings", icon: Settings, href: (id: string) => `/teams/${id}/settings` },
];

export function TeamTabs({ teamId }: { teamId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex border-b border-gray-200">
      {tabs.map(({ label, icon: Icon, href, exact }) => {
        const path = href(teamId);
        const isActive = exact ? pathname === path : pathname.startsWith(path);
        return (
          <Link
            key={label}
            href={path}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
