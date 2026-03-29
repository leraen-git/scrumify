import { TeamSwitcher } from "@/components/team-switcher";
import { apiFetch } from "@/lib/api";
import { LogoutButton } from "@/components/logout-button";
import { LayoutDashboard, Settings2 } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

export async function Nav() {
  const cookieStore = await cookies();
  const ctx = cookieStore.get("argo_ctx")?.value ?? "";
  const isAdmin = ctx !== "" && !ctx.startsWith("user:");

  const teams = isAdmin
    ? await apiFetch<{ id: string; name: string; sprintDuration: number; _count: { developers: number } }[]>("/api/teams").catch(() => [])
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href={isAdmin ? "/admin" : "/"} className="flex items-center gap-2.5 hover:text-indigo-600 transition-colors">
            <LayoutDashboard className="h-5 w-5 text-indigo-600 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold text-gray-900 tracking-wide">A.R.G.O</span>
              <span className="text-[10px] font-medium text-gray-400 tracking-wide">Agile Reporting &amp; Goal Observer</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {isAdmin && <TeamSwitcher teams={teams} />}
            {isAdmin && (
              <Link href="/admin" className="text-gray-400 hover:text-indigo-600 transition-colors" title="Admin">
                <Settings2 className="h-5 w-5" />
              </Link>
            )}
            {ctx && <LogoutButton />}
          </div>
        </div>
      </div>
    </header>
  );
}
