import { TeamTabs } from "@/components/team-tabs";
import { apiFetch } from "@/lib/api";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  const team = await apiFetch<{ id: string; name: string }>(`/api/teams/${teamId}`).catch(() => null);
  if (!team) notFound();

  const cookieStore = await cookies();
  const ctx = cookieStore.get("scrumify_ctx")?.value ?? "";
  const isAdmin = !ctx.startsWith("user:");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{team.name}</h1>
        <TeamTabs teamId={teamId} isAdmin={isAdmin} />
      </div>
      {children}
    </div>
  );
}
