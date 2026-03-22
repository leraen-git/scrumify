import { addDeveloper, deleteTeam, removeDeveloper, updateTeam } from "@/app/teams/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function TeamSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { developers: { orderBy: { name: "asc" } } },
  });

  if (!team) notFound();

  const updateTeamWithId = updateTeam.bind(null, teamId);
  const deleteTeamWithId = deleteTeam.bind(null, teamId);
  const addDeveloperWithId = addDeveloper.bind(null, teamId);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/teams/${teamId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to {team.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Team Settings</h1>
      </div>

      {/* Team Info */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 mb-6">
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

      {/* Developers */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Developers</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Total capacity: <strong>{team.developers.reduce((a, d) => a + d.storyPointsPerSprint, 0)} SP / sprint</strong>
            </p>
          </div>
        </div>

        {team.developers.length > 0 && (
          <div className="space-y-2 mb-5">
            {team.developers.map((dev) => {
              const removeDev = removeDeveloper.bind(null, teamId, dev.id);
              return (
                <div key={dev.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold">
                      {dev.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{dev.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{dev.storyPointsPerSprint} SP / sprint</Badge>
                    <form action={removeDev}>
                      <button
                        type="submit"
                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                        title="Remove developer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add developer form */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-500" />
            Add Developer
          </h3>
          <form action={addDeveloperWithId} className="flex gap-3">
            <div className="flex-1">
              <Input name="name" placeholder="Developer name" required />
            </div>
            <div className="w-40">
              <Input
                name="storyPointsPerSprint"
                type="number"
                min="1"
                max="200"
                defaultValue="10"
                placeholder="SP / sprint"
                required
              />
            </div>
            <Button type="submit" size="default">
              Add
            </Button>
          </form>
          <p className="text-xs text-gray-400 mt-2">Enter the developer&apos;s name and their story point capacity per sprint.</p>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-white rounded-xl border border-red-200 shadow-xs p-6">
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
