import { DaysOffCalendar } from "@/components/days-off-calendar";
import { DeveloperRoleSelect } from "@/components/developer-role-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { countWorkingDays } from "@/lib/utils";
import { Plus, Trash2, Users } from "lucide-react";
import { notFound } from "next/navigation";

interface Developer {
  id: string;
  name: string;
  role: string;
  storyPointsPerSprint: number;
  daysOff: { date: string; type: string }[];
}

interface Sprint {
  id: string;
  name: string;
  startDate: string;
  status: string;
}

async function addDeveloperAction(teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const name = formData.get("name") as string;
  const role = (formData.get("role") as string) || "developer";
  const storyPointsPerSprint = parseInt(formData.get("storyPointsPerSprint") as string, 10);
  if (!name?.trim()) return;
  await api(`/api/teams/${teamId}/developers`, {
    method: "POST",
    body: JSON.stringify({ name: name.trim(), role, storyPointsPerSprint }),
  });
  revalidatePath(`/teams/${teamId}`, "layout");
}

async function removeDeveloperAction(teamId: string, devId: string) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  await api(`/api/teams/${teamId}/developers/${devId}`, { method: "DELETE" });
  revalidatePath(`/teams/${teamId}`, "layout");
}

async function updateDeveloperRoleAction(teamId: string, devId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const role = formData.get("role") as string;
  await api(`/api/teams/${teamId}/developers/${devId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  revalidatePath(`/teams/${teamId}`, "layout");
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  const team = await apiFetch<{ id: string; developers: Developer[]; sprints: Sprint[] }>(`/api/teams/${teamId}`).catch(() => null);
  if (!team) notFound();

  const todayISO = toISO(new Date());

  const activeSprint = team.sprints.find((s) => s.status === "active");
  const devCount = team.developers.length;

  // Working days from active sprint start to today × number of devs
  const daysWorkedCurrentSprint = activeSprint
    ? countWorkingDays(activeSprint.startDate, todayISO) * devCount
    : 0;

  // Working days from the very first sprint start to today × number of devs
  const firstSprint = team.sprints.reduce<Sprint | null>(
    (earliest, s) => (!earliest || s.startDate < earliest.startDate ? s : earliest),
    null,
  );
  const totalDaysWorked = firstSprint
    ? countWorkingDays(firstSprint.startDate, todayISO) * devCount
    : 0;

  const sprintCount = team.sprints.filter((s) => s.status === "completed").length;
  const theoreticalCapacity = team.developers.reduce((a, d) => a + d.storyPointsPerSprint, 0);

  const addDeveloperWithId = addDeveloperAction.bind(null, teamId);

  return (
    <div>
      {/* Recap cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="text-3xl font-bold text-indigo-600">{daysWorkedCurrentSprint}</div>
            <div className="text-sm font-medium text-gray-700 mt-1">Days worked this sprint</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {activeSprint ? activeSprint.name : "No active sprint"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="text-3xl font-bold text-gray-900">{totalDaysWorked}</div>
            <div className="text-sm font-medium text-gray-700 mt-1">Total days worked</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Since first sprint · {sprintCount} sprint{sprintCount !== 1 ? "s" : ""} · {devCount} dev{devCount !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="text-3xl font-bold text-green-600">{theoreticalCapacity}</div>
            <div className="text-sm font-medium text-gray-700 mt-1">Theoretical capacity</div>
            <div className="text-xs text-gray-400 mt-0.5">SP / full sprint · {team.developers.length} developer{team.developers.length !== 1 ? "s" : ""}</div>
          </CardContent>
        </Card>
      </div>

      {/* Days off calendar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 mb-6">
        <DaysOffCalendar
          developers={team.developers.map((d) => ({
            id: d.id,
            name: d.name,
            daysOff: d.daysOff.map((o) => ({ date: o.date, type: o.type })),
          }))}
          teamId={teamId}
        />
      </div>

      {/* Developers list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Developers</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Estimated capacity:{" "}
              <strong className="text-indigo-600">{theoreticalCapacity} SP / sprint</strong>
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            {team.developers.length} member{team.developers.length !== 1 ? "s" : ""}
          </div>
        </div>

        {team.developers.length > 0 ? (
          <div className="space-y-2 mb-6">
            {team.developers.map((dev) => {
              const removeDev = removeDeveloperAction.bind(null, teamId, dev.id);
              const updateRole = updateDeveloperRoleAction.bind(null, teamId, dev.id);
              return (
                <div
                  key={dev.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold">
                      {dev.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{dev.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <DeveloperRoleSelect action={updateRole} defaultValue={dev.role} />
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
        ) : (
          <div className="text-center py-8 mb-6">
            <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No developers yet. Add one below.</p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-500" />
            Add Developer
          </h3>
          <form action={addDeveloperWithId} className="flex gap-3">
            <Input name="name" placeholder="Developer name" required className="flex-1" />
            <select
              name="role"
              defaultValue="developer"
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="developer">Developer</option>
              <option value="tech_lead">Tech Lead</option>
            </select>
            <Input
              name="storyPointsPerSprint"
              type="number"
              min="1"
              max="200"
              defaultValue="10"
              placeholder="SP / sprint"
              className="w-32"
              required
            />
            <Button type="submit">Add</Button>
          </form>
          <p className="text-xs text-gray-400 mt-2">
            Story point capacity represents how many SP this developer can deliver per full sprint.
          </p>
        </div>
      </div>
    </div>
  );
}
