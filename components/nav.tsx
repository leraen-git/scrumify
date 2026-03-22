import { TeamSwitcher } from "@/components/team-switcher";
import { prisma } from "@/lib/db";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";

export async function Nav() {
  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { developers: true } } },
  });

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/teams" className="flex items-center gap-2.5 font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
            <LayoutDashboard className="h-5 w-5 text-indigo-600" />
            <span>Scrumify</span>
          </Link>

          <div className="flex items-center gap-3">
            <TeamSwitcher teams={teams} />
          </div>
        </div>
      </div>
    </header>
  );
}
