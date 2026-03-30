import { MoveSprintSelect } from "@/components/move-sprint-select";
import { SprintDatePicker } from "@/components/sprint-date-picker";
import { SprintStatusSelect } from "@/components/sprint-status-select";
import { StoriesImporter } from "@/components/stories-importer";
import { StoryCategorySelect } from "@/components/story-category-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { countWorkingDays, formatDate, formatDateTime, sprintWeeks } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Circle, Clock, FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

async function updateSprint(sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const { redirect: redir } = await import("next/navigation");
  const name = formData.get("name") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  await api(`/api/teams/${teamId}/sprints/${sprintId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: name.trim(), startDate, endDate }),
  });
  revalidatePath(`/teams/${teamId}`, "layout");
  redir(`/teams/${teamId}/sprints/${sprintId}`);
}

async function updateSprintStatus(sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const status = formData.get("status") as string;
  await api(`/api/teams/${teamId}/sprints/${sprintId}`, { method: "PATCH", body: JSON.stringify({ status }) });
  revalidatePath(`/teams/${teamId}`, "layout");
}

async function addStory(sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const title = formData.get("title") as string;
  const storyPoints = parseInt(formData.get("storyPoints") as string, 10);
  const assigneeId = (formData.get("assigneeId") as string) || null;
  const category = (formData.get("category") as string) || "user_story";
  if (!title?.trim()) return;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories`, {
    method: "POST",
    body: JSON.stringify({ title: title.trim(), storyPoints, assigneeId, category }),
  });
  revalidatePath(`/teams/${teamId}/sprints/${sprintId}`);
}

async function updateStory(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const { redirect: redir } = await import("next/navigation");
  const title = formData.get("title") as string;
  const storyPoints = parseInt(formData.get("storyPoints") as string, 10);
  const assigneeId = (formData.get("assigneeId") as string) || null;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify({ title: title.trim(), storyPoints, assigneeId }),
  });
  revalidatePath(`/teams/${teamId}/sprints/${sprintId}`);
  redir(`/teams/${teamId}/sprints/${sprintId}`);
}

async function updateStoryStatus(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const status = formData.get("status") as string;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  revalidatePath(`/teams/${teamId}/sprints/${sprintId}`);
}

async function removeStory(storyId: string, sprintId: string, teamId: string) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, { method: "DELETE" });
  revalidatePath(`/teams/${teamId}/sprints/${sprintId}`);
}

async function moveStoryToSprint(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const toSprintId = formData.get("toSprintId") as string;
  if (!toSprintId) return;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify({ sprintId: toSprintId }),
  });
  revalidatePath(`/teams/${teamId}`, "layout");
}

async function updateStoryCategory(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const category = formData.get("category") as string;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify({ category }),
  });
  revalidatePath(`/teams/${teamId}/sprints/${sprintId}`);
}

const storyStatusConfig = {
  todo: { label: "To Do", icon: Circle, next: "in_progress" },
  in_progress: { label: "In Progress", icon: Clock, next: "dev_done" },
  dev_done: { label: "Dev Done / Testing", icon: FlaskConical, next: "done" },
  done: { label: "Done", icon: CheckCircle2, next: "todo" },
};

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "< 1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function getElapsedMs(statusHistory: string | null, status: string, createdAt?: string): number | null {
  const history = JSON.parse(statusHistory ?? "[]") as { from: string; to: string; at: string }[];
  const entered = [...history].reverse().find((e) => e.to === status);
  if (entered) return Date.now() - new Date(entered.at).getTime();
  if (createdAt) return Date.now() - new Date(createdAt).getTime();
  return null;
}

function accumulateStatusMs(history: { from: string; to: string; at: string }[], statusName: string): number | null {
  const firstExit = history.find((e) => e.from === statusName);
  const firstEntry = history.find((e) => e.to === statusName);
  if (!firstExit) return null; // never left this status — still in it or never visited

  let total = 0;
  // For imported tickets: no "to: statusName" entry exists, use first exit time as entry
  let enteredAt: number | null = firstEntry ? null : new Date(firstExit.at).getTime();

  for (const event of history) {
    if (event.to === statusName) enteredAt = new Date(event.at).getTime();
    else if (event.from === statusName && enteredAt !== null) {
      total += new Date(event.at).getTime() - enteredAt;
      enteredAt = null;
    }
  }
  return total > 0 ? total : null;
}

function getStatusTimings(statusHistory: string | null) {
  const history = JSON.parse(statusHistory ?? "[]") as { from: string; to: string; at: string }[];
  const devMs = accumulateStatusMs(history, "in_progress");
  const testMs = accumulateStatusMs(history, "dev_done");
  return { devMs, testMs };
}

const sprintStatusOptions = ["planned", "active", "completed"];
const FIBONACCI_SP = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

const CATEGORY_LABELS: Record<string, string> = {
  user_story:  "User Story",
  bug:         "Bug",
  mco:         "MCO",
  best_effort: "Best-effort",
  tech_lead:   "Tech Lead",
};

export default async function SprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; sprintId: string }>;
  searchParams: Promise<{ editSprint?: string; editStory?: string }>;
}) {
  const { teamId, sprintId } = await params;
  const { editSprint, editStory } = await searchParams;

  const cookieStore = await cookies();
  const ctx = cookieStore.get("argo_ctx")?.value ?? "";
  const isAdmin = !ctx.startsWith("user:");

  interface SprintDetails {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    capacity: number;
    plannedPoints: number;
    teamId: string;
    team: { id: string; name: string; sprintDuration: number; developers: { id: string; name: string }[]; categoryAllocations: Record<string, string | number> };
    userStories: { id: string; title: string; storyPoints: number; status: string; category: string; assigneeId: string | null; spChanges: string | null; statusHistory: string | null; sprintHistory: string; createdAt: string }[];
  }

  const [sprint, plannedSprints] = await Promise.all([
    apiFetch<SprintDetails>(`/api/teams/${teamId}/sprints/${sprintId}`).catch(() => null),
    apiFetch<{ id: string; name: string; status: string }[]>(`/api/teams/${teamId}/sprints`)
      .then((r) => r.filter((s) => s.status === "planned" && s.id !== sprintId))
      .catch(() => [] as { id: string; name: string; status: string }[]),
  ]);
  if (!sprint) notFound();

  const donePoints = sprint.userStories
    .filter((s) => s.status === "done")
    .reduce((a, s) => a + s.storyPoints, 0);
  const totalPoints = sprint.userStories.reduce((a, s) => a + s.storyPoints, 0);
  const denominator = sprint.capacity > 0 ? sprint.capacity : totalPoints;
  const progress = denominator > 0 ? Math.round((donePoints / denominator) * 100) : 0;

  const updateSprintAction = updateSprint.bind(null, sprintId, teamId);
  const updateStatusAction = updateSprintStatus.bind(null, sprintId, teamId);
  const addStoryAction = addStory.bind(null, sprintId, teamId);

  const groupedStories = {
    todo: sprint.userStories.filter((s) => s.status === "todo"),
    in_progress: sprint.userStories.filter((s) => s.status === "in_progress"),
    dev_done: sprint.userStories.filter((s) => s.status === "dev_done"),
    done: sprint.userStories.filter((s) => s.status === "done"),
  };

  const boardUrl = `/teams/${teamId}/sprints/${sprintId}`;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/teams/${teamId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {sprint.team.name}
        </Link>

        {isAdmin && editSprint ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 mt-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Edit Sprint</h2>
            <form action={updateSprintAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Sprint Name</Label>
                <Input id="name" name="name" defaultValue={sprint.name} required autoFocus />
              </div>
              <SprintDatePicker
                sprintDuration={sprint.team.sprintDuration}
                defaultStartISO={sprint.startDate}
                defaultEndISO={sprint.endDate}
              />
              <div className="flex gap-2 pt-1">
                <Button type="submit">Save</Button>
                <Link href={boardUrl}>
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{sprint.name}</h1>
                {isAdmin && (
                  <Link
                    href={`${boardUrl}?editSprint=1`}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    title="Edit sprint"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)} · {sprintWeeks(sprint.startDate, sprint.endDate)}w
              </p>
            </div>
            {isAdmin && (
              <SprintStatusSelect
                currentStatus={sprint.status}
                options={sprintStatusOptions}
                action={updateStatusAction}
              />
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-indigo-600">{sprint.capacity}</div>
            <div className="text-xs text-gray-500 mt-1">SP Capacity</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-gray-900">{sprint.plannedPoints > 0 ? sprint.plannedPoints : totalPoints}</div>
            <div className="text-xs text-gray-500 mt-1">SP Planned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-indigo-500">{totalPoints}</div>
            <div className="text-xs text-gray-500 mt-1">SP Current</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-green-600">{donePoints}</div>
            <div className="text-xs text-gray-500 mt-1">SP Done</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-gray-900">{progress}%</div>
            <div className="text-xs text-gray-500 mt-1">Complete</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress bars */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10);
        const totalDays = countWorkingDays(sprint.startDate, sprint.endDate);
        const elapsedDays = sprint.startDate <= today
          ? countWorkingDays(sprint.startDate, today < sprint.endDate ? today : sprint.endDate)
          : 0;
        const remainingDays = Math.max(0, totalDays - elapsedDays);
        const timeProgress = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0;
        return (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1.5">
                <span>Story points</span>
                <span>{donePoints} / {sprint.capacity} SP</span>
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

      {/* Category breakdown + Transition times */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {(() => {
          const alloc = sprint.team.categoryAllocations ?? {};
          const CATEGORIES = [
            { key: "user_story", label: "User Story", color: (alloc["user_story_color"] as unknown as string) ?? "#6366f1" },
            { key: "bug",        label: "Bug",         color: (alloc["bug_color"] as unknown as string) ?? "#ef4444" },
            { key: "mco",        label: "MCO",         color: (alloc["mco_color"] as unknown as string) ?? "#f59e0b" },
            { key: "best_effort",label: "Best-effort", color: (alloc["best_effort_color"] as unknown as string) ?? "#22c55e" },
            { key: "tech_lead",  label: "Tech Lead",   color: (alloc["tech_lead_color"] as unknown as string) ?? "#a855f7" },
          ];
          const rows = CATEGORIES.map((c) => {
            const stories = sprint.userStories.filter((s) => s.category === c.key);
            const sp = stories.reduce((a, s) => a + s.storyPoints, 0);
            const spDone = stories.filter((s) => s.status === "done").reduce((a, s) => a + s.storyPoints, 0);
            return { ...c, sp, spDone, count: stories.length };
          }).filter((c) => c.sp > 0);
          return (
            <div className="w-full lg:w-1/2 bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Category Breakdown</p>
              {rows.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No stories with categories yet.</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((c) => (
                    <div key={c.key} className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="w-28 font-medium text-gray-700">{c.label}</span>
                      <span className="text-xs text-gray-400">{c.count} stor{c.count !== 1 ? "ies" : "y"}</span>
                      <span className="ml-auto font-semibold text-indigo-600">{c.spDone} / {c.sp} SP</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {(() => {
          const devTimes: number[] = [];
          const testTimes: number[] = [];
          for (const story of sprint.userStories) {
            const { devMs, testMs } = getStatusTimings(story.statusHistory);
            if (devMs !== null && devMs > 0) devTimes.push(devMs);
            if (testMs !== null && testMs > 0) testTimes.push(testMs);
          }
          const avgDev = devTimes.length > 0 ? devTimes.reduce((a, v) => a + v, 0) / devTimes.length : null;
          const avgTest = testTimes.length > 0 ? testTimes.reduce((a, v) => a + v, 0) / testTimes.length : null;
          return (
            <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Avg Transition Times</p>
              {avgDev === null && avgTest === null ? (
                <p className="text-xs text-gray-400 italic">No transitions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {avgDev !== null && (
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-sm text-gray-600">In Progress → Dev Done</span>
                      <span className="ml-auto font-semibold text-amber-600">{formatDuration(avgDev)}</span>
                      <span className="text-xs text-gray-400">({devTimes.length} stor{devTimes.length !== 1 ? "ies" : "y"})</span>
                    </div>
                  )}
                  {avgTest !== null && (
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                      <span className="text-sm text-gray-600">Testing → Done</span>
                      <span className="ml-auto font-semibold text-purple-600">{formatDuration(avgTest)}</span>
                      <span className="text-xs text-gray-400">({testTimes.length} stor{testTimes.length !== 1 ? "ies" : "y"})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Kanban columns */}
      <div className="flex flex-col gap-3 mb-6">
        {(["todo", "in_progress", "dev_done", "done"] as const).map((status) => {
          const cfg = storyStatusConfig[status];
          const stories = groupedStories[status];
          const Icon = cfg.icon;
          return (
            <div key={status} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon
                  className={`h-4 w-4 ${
                    status === "done"
                      ? "text-green-500"
                      : status === "dev_done"
                      ? "text-purple-500"
                      : status === "in_progress"
                      ? "text-amber-500"
                      : "text-gray-400"
                  }`}
                />
                <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                <span className="ml-auto text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                  {stories.reduce((a, s) => a + s.storyPoints, 0)} SP
                </span>
              </div>
              <div className="space-y-2">
                {stories.map((story) => {
                  const updateStatusAction = updateStoryStatus.bind(null, story.id, sprintId, teamId);
                  const removeStoryAction = removeStory.bind(null, story.id, sprintId, teamId);
                  const updateStoryAction = updateStory.bind(null, story.id, sprintId, teamId);
                  const updateCategoryAction = updateStoryCategory.bind(null, story.id, sprintId, teamId);
                  const moveAction = moveStoryToSprint.bind(null, story.id, sprintId, teamId);
                  const assignee = sprint.team.developers.find((d) => d.id === story.assigneeId);

                  const spHistory = JSON.parse(story.spChanges ?? "[]") as { from: number; to: number; at: string }[];
                  const carryHistory = JSON.parse(story.sprintHistory ?? "[]") as { fromSprintName: string | null }[];
                  const { devMs, testMs } = getStatusTimings(story.statusHistory);
                  const elapsedMs = (status === "in_progress" || status === "dev_done")
                    ? getElapsedMs(story.statusHistory, status, story.createdAt)
                    : null;

                  if (isAdmin && editStory === story.id) {
                    return (
                      <div key={story.id} className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                        <form action={updateStoryAction} className="space-y-2">
                          <Input
                            name="title"
                            defaultValue={story.title}
                            required
                            autoFocus
                            className="text-sm h-8"
                          />
                          <div className="flex gap-2 flex-wrap">
                            <select
                              name="storyPoints"
                              defaultValue={story.storyPoints}
                              className="w-20 h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              {(FIBONACCI_SP.includes(story.storyPoints)
                                ? FIBONACCI_SP
                                : [...FIBONACCI_SP, story.storyPoints].sort((a, b) => a - b)
                              ).map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                            <select
                              name="category"
                              defaultValue={story.category || "user_story"}
                              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                            <select
                              name="assigneeId"
                              defaultValue={story.assigneeId ?? ""}
                              className="flex-1 h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">Unassigned</option>
                              {sprint.team.developers.map((dev) => (
                                <option key={dev.id} value={dev.id}>{dev.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-1.5">
                            <Button type="submit" size="sm" className="h-7 text-xs">Save</Button>
                            <Link href={boardUrl} scroll={false}>
                              <Button type="button" variant="outline" size="sm" className="h-7 text-xs">Cancel</Button>
                            </Link>
                          </div>
                        </form>
                      </div>
                    );
                  }

                  return (
                    <div key={story.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-100 bg-gray-50">
                      {/* ID */}
                      <span className="text-[10px] font-mono text-gray-300 shrink-0">#{story.id.slice(0, 8)}</span>

                      {/* Title + edited */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800 truncate block leading-tight">{story.title}</span>
                      </div>

                      {/* Carryover badge */}
                      {carryHistory.length === 1 && (
                        <span className="text-[10px] text-indigo-500 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 shrink-0">
                          ↩ {carryHistory[0].fromSprintName ?? "prev sprint"}
                        </span>
                      )}
                      {carryHistory.length > 1 && (
                        <span className="text-[10px] text-indigo-500 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 shrink-0">
                          ↩ ×{carryHistory.length}
                        </span>
                      )}

                      {/* Category */}
                      {isAdmin
                        ? <StoryCategorySelect action={updateCategoryAction} defaultValue={story.category || "user_story"} />
                        : <span className="text-xs text-gray-400 shrink-0">{CATEGORY_LABELS[story.category] ?? story.category}</span>
                      }

                      {/* Assignee */}
                      {assignee && (
                        <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{assignee.name}</span>
                      )}

                      {/* SP — red with history tooltip if SP was ever changed */}
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

                      {/* Elapsed in current status (for active stories) */}
                      {elapsedMs !== null && (
                        <span
                          className={`text-[10px] rounded px-1.5 py-0.5 shrink-0 ${
                            status === "dev_done"
                              ? "text-purple-600 bg-purple-50 border border-purple-200"
                              : "text-amber-600 bg-amber-50 border border-amber-200"
                          }`}
                          title={`Time in ${status === "dev_done" ? "testing" : "dev"}`}
                        >
                          ⏱ {formatDuration(elapsedMs)}
                        </span>
                      )}

                      {/* Completed dev / test timings */}
                      {devMs !== null && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0" title="Dev time">
                          dev {formatDuration(devMs)}
                        </span>
                      )}
                      {testMs !== null && (
                        <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 shrink-0" title="Test time">
                          test {formatDuration(testMs)}
                        </span>
                      )}

                      {/* Status transition — admin only */}
                      {isAdmin && status !== "done" && (
                        <form action={updateStatusAction} className="shrink-0">
                          <input type="hidden" name="status" value={cfg.next} />
                          <button type="submit" className="text-xs font-medium whitespace-nowrap px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 transition-colors">
                            → {storyStatusConfig[cfg.next as keyof typeof storyStatusConfig]?.label}
                          </button>
                        </form>
                      )}

                      {/* Back to Dev — admin, dev_done only */}
                      {isAdmin && status === "dev_done" && (
                        <form action={updateStatusAction} className="shrink-0">
                          <input type="hidden" name="status" value="in_progress" />
                          <button type="submit" className="text-xs font-medium whitespace-nowrap px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-300 transition-colors">
                            ← Back to Dev
                          </button>
                        </form>
                      )}

                      {/* Move to sprint — admin, non-done only */}
                      {isAdmin && status !== "done" && (
                        <MoveSprintSelect plannedSprints={plannedSprints} action={moveAction} />
                      )}

                      {/* Actions — admin only */}
                      {isAdmin && (
                        <>
                          <Link
                            href={`${boardUrl}?editStory=${story.id}`}
                            scroll={false}
                            className="text-gray-300 hover:text-indigo-400 transition-colors shrink-0"
                            title="Edit story"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <form action={removeStoryAction}>
                            <button type="submit" className="text-gray-300 hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Import / Export */}
      {isAdmin && (
        <div className="mb-4">
          <StoriesImporter sprintId={sprintId} teamId={teamId} existingCount={sprint.userStories.length} />
        </div>
      )}

      {/* Add story */}
      {isAdmin && <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-indigo-500" />
          Add User Story
        </h3>
        <form action={addStoryAction} className="flex gap-3 flex-wrap sm:flex-nowrap">
          <Input name="title" placeholder="Story title or description" required className="flex-1 min-w-0" />
          <select
            name="storyPoints"
            defaultValue={3}
            className="h-9 w-20 flex-shrink-0 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {FIBONACCI_SP.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            name="category"
            defaultValue="user_story"
            className="h-9 flex-shrink-0 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            name="assigneeId"
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
          >
            <option value="">Unassigned</option>
            {sprint.team.developers.map((dev) => (
              <option key={dev.id} value={dev.id}>{dev.name}</option>
            ))}
          </select>
          <Button type="submit" className="flex-shrink-0">Add</Button>
        </form>
      </div>}
    </div>
  );
}
