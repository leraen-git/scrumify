import { CategoryAllocationForm } from "@/components/category-allocation-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { notFound, redirect } from "next/navigation";

async function updateTeam(teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const name = formData.get("name") as string;
  const sprintDuration = parseInt(formData.get("sprintDuration") as string, 10);
  if (!name?.trim()) return;
  await api(`/api/teams/${teamId}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), sprintDuration }) });
  revalidatePath(`/teams/${teamId}`, "layout");
}

async function deleteTeam(teamId: string) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const { redirect: redir } = await import("next/navigation");
  await api(`/api/teams/${teamId}`, { method: "DELETE" });
  revalidatePath("/teams");
  redir("/teams");
}

export default async function TeamSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const team = await apiFetch<{ id: string; name: string; sprintDuration: number; categoryAllocations: Record<string, number>; developers: { id: string; name: string; role: string; storyPointsPerSprint: number }[] }>(`/api/teams/${teamId}`).catch(() => null);
  if (!team) notFound();

  const updateTeamWithId = updateTeam.bind(null, teamId);
  const deleteTeamWithId = deleteTeam.bind(null, teamId);

  return (
    <div className="max-w-4xl">

      {/* General + Category Allocation side by side */}
      <div className="flex flex-col lg:flex-row lg:gap-6 items-start mb-6">
        {/* Team Info */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 w-full lg:w-72 lg:shrink-0 mb-6 lg:mb-0">
          <h2 className="text-base font-semibold text-gray-900 mb-4">General</h2>
          <form action={updateTeamWithId} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Team Name</Label>
              <Input id="name" name="name" defaultValue={team.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprintDuration">Sprint Duration</Label>
              <select
                id="sprintDuration"
                name="sprintDuration"
                defaultValue={team.sprintDuration}
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="1">1 week</option>
                <option value="2">2 weeks</option>
                <option value="3">3 weeks</option>
                <option value="4">4 weeks</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </section>

        {/* Category Allocation */}
        <section className="flex-1">
          <CategoryAllocationForm teamId={teamId} initial={team.categoryAllocations ?? {}} developers={team.developers ?? []} />
        </section>
      </div>

      {/* Danger Zone */}
      <section className="bg-white rounded-xl border border-red-200 shadow-xs p-6 max-w-sm">
        <h2 className="text-base font-semibold text-red-700 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Deleting this team will permanently remove all sprints, stories, and developer data.
        </p>
        <form action={deleteTeamWithId}>
          <Button type="submit" variant="destructive" size="sm">
            Delete Team
          </Button>
        </form>
      </section>
    </div>
  );

}
