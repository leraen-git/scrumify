import { CategoryDonutChart } from "@/components/category-donut-chart";
import { VelocityChart } from "@/components/velocity-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { countWorkingDays, formatDate, formatDateTime } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const FIBONACCI_SP = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];


async function updateStory(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath: revalidate } = await import("next/cache");
  const { redirect: redir } = await import("next/navigation");
  const title = formData.get("title") as string;
  const storyPoints = parseInt(formData.get("storyPoints") as string, 10);
  const assigneeId = (formData.get("assigneeId") as string) || null;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify({ title: title.trim(), storyPoints, assigneeId }),
  });
  revalidate(`/teams/${teamId}`);
  redir(`/teams/${teamId}`);
}

async function updateStoryStatus(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath: revalidate } = await import("next/cache");
  const status = formData.get("status") as string;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  revalidate(`/teams/${teamId}`);
}

async function removeStory(storyId: string, sprintId: string, teamId: string) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath: revalidate } = await import("next/cache");
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, { method: "DELETE" });
  revalidate(`/teams/${teamId}`);
}

const storyStatusConfig = {
  todo: { label: "To Do", icon: Circle, next: "in_progress" },
  in_progress: { label: "In Progress", icon: Clock, next: "done" },
  done: { label: "Done", icon: CheckCircle2, next: "todo" },
};

const statusConfig = {
  planned: { label: "Planned", variant: "secondary" as const },
  active: { label: "Active", variant: "success" as const },
  completed: { label: "Completed", variant: "outline" as const },
};

export default async function TeamDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ editStory?: string }>;
}) {
  const { teamId } = await params;
  const { editStory } = await searchParams;

  interface TeamDashboardData {
    id: string;
    developers: { id: string; name: string; storyPointsPerSprint: number }[];
    sprints: {
      id: string; name: string; startDate: string; endDate: string;
      status: string; capacity: number; plannedPoints: number;
      userStories: { id: string; title: string; storyPoints: number; status: string; category: string; assigneeId: string | null; spChanges: string | null }[];
    }[];
  }
  const team = await apiFetch<TeamDashboardData>(`/api/teams/${teamId}`).catch(() => null);
  if (!team) notFound();

  const activeSprint = team.sprints.find((s) => s.status === "active");
  const completedSprints = team.sprints
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const totalCapacity = team.developers.reduce((a, d) => a + d.storyPointsPerSprint, 0);
  const devCount = Math.max(1, team.developers.length);

  const avgVelocity =
    completedSprints.length > 0
      ? Math.round(
          completedSprints.reduce((a, s) => {
            const done = s.userStories
              .filter((u) => u.status === "done")
              .reduce((b, u) => b + u.storyPoints, 0);
            return a + done;
          }, 0) / completedSprints.length
        )
      : null;

  const avgVelocityPerDay =
    completedSprints.length > 0
      ? Math.round(
          (completedSprints.reduce((a, s) => {
            const delivered = s.userStories.filter((u) => u.status === "done").reduce((b, u) => b + u.storyPoints, 0);
            const days = Math.max(1, countWorkingDays(s.startDate, s.endDate));
            return a + delivered / (days * devCount);
          }, 0) / completedSprints.length) * 100
        ) / 100
      : 0;

  const chartSprints = [...completedSprints, ...(activeSprint ? [activeSprint] : [])];
  const chartData = chartSprints.map((s) => {
    const delivered = s.userStories.filter((u) => u.status === "done").reduce((a, u) => a + u.storyPoints, 0);
    const planned = s.plannedPoints > 0 ? s.plannedPoints : s.userStories.reduce((a, u) => a + u.storyPoints, 0);
    const days = Math.max(1, countWorkingDays(s.startDate, s.endDate));
    return {
      name: s.name,
      spPlanned: planned,
      spDone: delivered,
      velocityPerDay: Math.round((delivered / (days * devCount)) * 100) / 100,
      active: s.status === "active",
    };
  });

  const dashUrl = `/teams/${teamId}`;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{team.developers.length}</div>
            <div className="text-sm text-gray-500 mt-1">Developers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-indigo-600">{totalCapacity}</div>
            <div className="text-sm text-gray-500 mt-1">SP Capacity / Sprint</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{team.sprints.length}</div>
            <div className="text-sm text-gray-500 mt-1">Total Sprints</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {avgVelocity !== null ? avgVelocity : "—"}
            </div>
            <div className="text-sm text-gray-500 mt-1">Avg Velocity (SP)</div>
          </CardContent>
        </Card>
      </div>

      {/* Sprint Overview + Category Breakdown */}
      {chartData.length > 0 && (
        <div className="flex gap-6 items-start mb-8">
          <VelocityChart data={chartData} avgVelocityPerDay={avgVelocityPerDay} />
          {(() => {
            const donutSprints = chartSprints.filter((s) => s.userStories.length > 0);
            if (donutSprints.length === 0) return null;
            return (
              <CategoryDonutChart
                sprints={donutSprints.map((s) => ({
                  id: s.id,
                  name: s.name,
                  active: s.status === "active",
                  stories: s.userStories.map((u) => ({ category: u.category ?? "user_story", storyPoints: u.storyPoints })),
                }))}
              />
            );
          })()}
        </div>
      )}

      {/* Active sprint board */}
      {activeSprint ? (() => {
        const stories = activeSprint.userStories;
        const donePoints = stories.filter((s) => s.status === "done").reduce((a, s) => a + s.storyPoints, 0);
        const totalPoints = stories.reduce((a, s) => a + s.storyPoints, 0);
        const progress = activeSprint.capacity > 0 ? Math.round((donePoints / activeSprint.capacity) * 100) : 0;

        const groupedStories = {
          todo: stories.filter((s) => s.status === "todo"),
          in_progress: stories.filter((s) => s.status === "in_progress"),
          done: stories.filter((s) => s.status === "done"),
        };

        return (
          <div className="mb-8">
            {/* Sprint header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">{activeSprint.name}</h2>
                  <Badge variant="success">Active</Badge>
                  <Link
                    href={`/teams/${teamId}/sprints/${activeSprint.id}?editSprint=1`}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    title="Edit sprint"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(activeSprint.startDate)} → {formatDate(activeSprint.endDate)}
                </p>
              </div>
              <Link href={`/teams/${teamId}/sprints/new`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  New Sprint
                </Button>
              </Link>
            </div>

            {/* Progress */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xl font-bold text-indigo-600">{activeSprint.capacity}</div>
                  <div className="text-xs text-gray-500 mt-0.5">SP Capacity</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xl font-bold text-gray-900">{activeSprint.plannedPoints > 0 ? activeSprint.plannedPoints : totalPoints}</div>
                  <div className="text-xs text-gray-500 mt-0.5">SP Planned</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xl font-bold text-green-600">{donePoints}</div>
                  <div className="text-xs text-gray-500 mt-0.5">SP Done</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xl font-bold text-gray-900">{progress}%</div>
                  <div className="text-xs text-gray-500 mt-0.5">Complete</div>
                </CardContent>
              </Card>
            </div>

            {/* Progress bars */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const totalDays = countWorkingDays(activeSprint.startDate, activeSprint.endDate);
              const elapsedDays = activeSprint.startDate <= today
                ? countWorkingDays(activeSprint.startDate, today < activeSprint.endDate ? today : activeSprint.endDate)
                : 0;
              const remainingDays = Math.max(0, totalDays - elapsedDays);
              const timeProgress = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0;
              return (
                <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1.5">
                      <span>Story points</span>
                      <span>{donePoints} / {activeSprint.capacity} SP</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progress >= 80 ? "bg-green-400" : progress >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1.5">
                      <span>Time elapsed</span>
                      <span>{remainingDays} working day{remainingDays !== 1 ? "s" : ""} left</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${timeProgress >= 80 ? "bg-red-400" : timeProgress >= 50 ? "bg-amber-400" : "bg-green-400"}`}
                        style={{ width: `${Math.min(timeProgress, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Kanban */}
            <div className="grid lg:grid-cols-3 gap-4 mb-4">
              {(["todo", "in_progress", "done"] as const).map((status) => {
                const cfg = storyStatusConfig[status];
                const colStories = groupedStories[status];
                const Icon = cfg.icon;
                return (
                  <div key={status} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`h-4 w-4 ${status === "done" ? "text-green-500" : status === "in_progress" ? "text-amber-500" : "text-gray-400"}`} />
                      <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                      <span className="ml-auto text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                        {colStories.reduce((a, s) => a + s.storyPoints, 0)} SP
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {colStories.map((story) => {
                        const updateStatusAction = updateStoryStatus.bind(null, story.id, activeSprint.id, teamId);
                        const removeStoryAction = removeStory.bind(null, story.id, activeSprint.id, teamId);
                        const updateStoryAction = updateStory.bind(null, story.id, activeSprint.id, teamId);
                        const assignee = team.developers.find((d) => d.id === story.assigneeId);
                        const spHistory = JSON.parse(story.spChanges ?? "[]") as { from: number; to: number; at: string }[];

                        if (editStory === story.id) {
                          return (
                            <div key={story.id} className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                              <form action={updateStoryAction} className="space-y-2">
                                <Input name="title" defaultValue={story.title} required autoFocus className="text-sm h-8" />
                                <div className="flex gap-2">
                                  <select
                                    name="storyPoints"
                                    defaultValue={story.storyPoints}
                                    className="w-20 h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    {(FIBONACCI_SP.includes(story.storyPoints)
                                      ? FIBONACCI_SP
                                      : [...FIBONACCI_SP, story.storyPoints].sort((a, b) => a - b)
                                    ).map((v) => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                  <select
                                    name="assigneeId"
                                    defaultValue={story.assigneeId ?? ""}
                                    className="flex-1 h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    <option value="">Unassigned</option>
                                    {team.developers.map((dev) => (
                                      <option key={dev.id} value={dev.id}>{dev.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex gap-1.5">
                                  <Button type="submit" size="sm" className="h-7 text-xs">Save</Button>
                                  <Link href={dashUrl} scroll={false}>
                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs">Cancel</Button>
                                  </Link>
                                </div>
                              </form>
                            </div>
                          );
                        }

                        return (
                          <div key={story.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-100 bg-gray-50">
                            <span className="text-[10px] font-mono text-gray-300 shrink-0">#{story.id.slice(0, 8)}</span>
                            <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{story.title}</span>
                            {assignee && <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{assignee.name}</span>}
                            <div className="relative group shrink-0">
                              <span className={`text-xs font-semibold cursor-default ${spHistory.length > 0 ? "text-red-500" : "text-gray-500"}`}>
                                {story.storyPoints} SP
                              </span>
                              {spHistory.length > 0 && (
                                <div className="hidden group-hover:block absolute bottom-full right-0 mb-1.5 z-20 w-52 rounded-lg border border-gray-200 bg-white shadow-lg p-2.5 text-xs text-gray-700">
                                  <div className="font-semibold text-gray-800 mb-1.5">SP history</div>
                                  {spHistory.map((h, i) => (
                                    <div key={i} className="flex justify-between text-gray-600 py-0.5 border-b border-gray-100 last:border-0">
                                      <span>{h.from} → {h.to} SP</span>
                                      <span className="text-gray-400">{formatDateTime(new Date(h.at))}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {status !== "done" && (
                              <form action={updateStatusAction} className="shrink-0">
                                <input type="hidden" name="status" value={cfg.next} />
                                <button type="submit" className="text-xs font-medium whitespace-nowrap px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 transition-colors">
                                  → {storyStatusConfig[cfg.next as keyof typeof storyStatusConfig]?.label}
                                </button>
                              </form>
                            )}
                            <Link href={`${dashUrl}?editStory=${story.id}`} scroll={false} className="text-gray-300 hover:text-indigo-400 transition-colors shrink-0" title="Edit story">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <form action={removeStoryAction}>
                              <button type="submit" className="text-gray-300 hover:text-red-400 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        );
      })() : (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Active Sprint</h2>
            <Link href={`/teams/${teamId}/sprints/new`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Sprint
              </Button>
            </Link>
          </div>
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">No active sprint. Create one to get started.</p>
            <Link href={`/teams/${teamId}/sprints/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Sprint
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Recent completed sprints */}
      {completedSprints.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Sprints</h2>
          <div className="space-y-2">
            {completedSprints.slice(0, 3).map((sprint) => {
              const done = sprint.userStories
                .filter((s) => s.status === "done")
                .reduce((a, s) => a + s.storyPoints, 0);
              const cfg = statusConfig[sprint.status as keyof typeof statusConfig] ?? statusConfig.planned;
              return (
                <Link key={sprint.id} href={`/teams/${teamId}/sprints/${sprint.id}`}>
                  <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{sprint.name}</span>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{done} SP delivered</span>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
