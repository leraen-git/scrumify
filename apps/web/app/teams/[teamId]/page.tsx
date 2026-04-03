import { BugEnvironmentChart } from "@/components/bug-environment-chart";
import { CategoryDonutChart } from "@/components/category-donut-chart";
import { KanbanCategoryFilter } from "@/components/kanban-category-filter";
import { StoryEnvironmentSelect } from "@/components/story-environment-select";
import { ForecastChart, ForecastSummary, FutureSprintPoint, PastSprintPoint } from "@/components/forecast-chart";
import { MoveSprintSelect } from "@/components/move-sprint-select";
import { SprintExportModal, type SprintExportData } from "@/components/sprint-export-modal";
import { VelocityChart } from "@/components/velocity-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { countWorkingDays, formatDate, formatDateTime, sprintWeeks } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  FlaskConical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
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

async function updateStoryEnvironment(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath: revalidate } = await import("next/cache");
  const environment = (formData.get("environment") as string) || null;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify({ environment }),
  });
  revalidate(`/teams/${teamId}`);
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

async function moveStoryToSprint(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath: revalidate } = await import("next/cache");
  const toSprintId = formData.get("toSprintId") as string;
  if (!toSprintId) return;
  await api(`/api/teams/${teamId}/sprints/${sprintId}/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify({ sprintId: toSprintId }),
  });
  revalidate(`/teams/${teamId}`, "layout");
}

function formatElapsed(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "< 1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function getElapsedMs(statusHistory: string | null, status: string, createdAt?: string): number | null {
  const history = JSON.parse(statusHistory ?? "[]") as { from: string; to: string; at: string }[];
  const entered = [...history].reverse().find((e) => e.to === status);
  if (entered) return Date.now() - new Date(entered.at).getTime();
  // Fallback: story was created/imported directly in this status — use createdAt
  if (createdAt) return Date.now() - new Date(createdAt).getTime();
  return null;
}

function accumulateStatusMs(history: { from: string; to: string; at: string }[], statusName: string): number | null {
  const firstExit = history.find((e) => e.from === statusName);
  const firstEntry = history.find((e) => e.to === statusName);
  if (!firstExit) return null;
  let total = 0;
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

function getCompletedTimings(statusHistory: string | null) {
  const history = JSON.parse(statusHistory ?? "[]") as { from: string; to: string; at: string }[];
  return {
    devMs:  accumulateStatusMs(history, "in_progress"),
    testMs: accumulateStatusMs(history, "dev_done"),
  };
}

const storyStatusConfig = {
  todo: { label: "To Do", icon: Circle, next: "in_progress" },
  in_progress: { label: "In Progress", icon: Clock, next: "dev_done" },
  dev_done: { label: "Dev Done / Testing", icon: FlaskConical, next: "done" },
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
  searchParams: Promise<{ editStory?: string; categories?: string }>;
}) {
  const { teamId } = await params;
  const { editStory, categories } = await searchParams;

  const cookieStore = await cookies();
  const ctx = cookieStore.get("argo_ctx")?.value ?? "";
  const isAdmin = !ctx.startsWith("user:");

  interface ForecastResponse {
    past: PastSprintPoint[];
    future: FutureSprintPoint[];
    summary: ForecastSummary;
  }

  interface TeamDashboardData {
    id: string;
    developers: { id: string; name: string; storyPointsPerSprint: number }[];
    categoryAllocations: Record<string, string | number>;
    sprints: {
      id: string; name: string; startDate: string; endDate: string;
      status: string; capacity: number; plannedPoints: number;
      userStories: { id: string; title: string; storyPoints: number; status: string; category: string; assigneeId: string | null; spChanges: string | null; statusHistory: string; sprintHistory: string; createdAt: string; environment: string | null }[];
    }[];
  }
  const [team, forecast] = await Promise.all([
    apiFetch<TeamDashboardData>(`/api/teams/${teamId}`).catch(() => null),
    apiFetch<ForecastResponse>(`/api/teams/${teamId}/forecast`).catch(() => null),
  ]);
  if (!team) notFound();

  const activeSprint = team.sprints.find((s) => s.status === "active");
  const plannedSprints = team.sprints
    .filter((s) => s.status === "planned")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
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

  function calcAvgStatusDuration(
    stories: { statusHistory: string }[],
    enterStatus: string,
  ): number | null {
    const durations: number[] = [];
    for (const story of stories) {
      const history = JSON.parse(story.statusHistory ?? "[]") as { from: string; to: string; at: string }[];
      // Accumulate ALL stints in this status (handles back-and-forth transitions)
      let totalMs = 0;
      let enteredAt: number | null = null;

      // If the story starts in this status (first entry has from === enterStatus
      // but no prior to === enterStatus), treat the first exit as a 0-duration entry
      const firstExit = history.find((h) => h.from === enterStatus);
      const firstEntry = history.find((h) => h.to === enterStatus);
      if (!firstExit) continue; // never left this status — skip (still in it)

      // If no recorded entry, use the first exit timestamp as entry (imported tickets)
      if (!firstEntry) {
        enteredAt = new Date(firstExit.at).getTime();
      }

      for (const event of history) {
        if (event.to === enterStatus) {
          enteredAt = new Date(event.at).getTime();
        } else if (event.from === enterStatus && enteredAt !== null) {
          totalMs += new Date(event.at).getTime() - enteredAt;
          enteredAt = null;
        }
      }
      if (totalMs > 0) durations.push(totalMs / (1000 * 60 * 60));
    }
    if (durations.length === 0) return null;
    return Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
  }

  function formatDuration(hours: number): string {
    if (hours < 24) return `${hours}h`;
    return `${Math.round((hours / 24) * 10) / 10}d`;
  }

  const allSprintsForMetrics = [...completedSprints, ...(activeSprint ? [activeSprint] : [])];
  const allActiveStories = allSprintsForMetrics.flatMap((s) => s.userStories);
  // Dev time: any story that left in_progress (dev_done or done)
  const devDoneOrDoneStories = allActiveStories.filter((u) => u.status === "dev_done" || u.status === "done");
  // Test time: only stories that completed testing (done)
  const doneStories = allActiveStories.filter((u) => u.status === "done");
  const avgDevTime = calcAvgStatusDuration(devDoneOrDoneStories, "in_progress");
  const avgTestTime = calcAvgStatusDuration(doneStories, "dev_done");

  const avgCompletion =
    completedSprints.length > 0
      ? Math.round(
          completedSprints.reduce((a, s) => {
            const done = s.userStories.filter((u) => u.status === "done").reduce((b, u) => b + u.storyPoints, 0);
            const total = s.userStories.reduce((b, u) => b + u.storyPoints, 0);
            // Prefer plannedPoints (locked at sprint start), then capacity, then current total
            const denominator = s.plannedPoints > 0 ? s.plannedPoints : s.capacity > 0 ? s.capacity : total;
            return a + (denominator > 0 ? done / denominator : 0);
          }, 0) / completedSprints.length * 100
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

  // ── Category filter (for active sprint kanban) ────────────────────────────
  const activeCategories = new Set((categories ?? "").split(",").filter(Boolean));

  // ── Export data for active sprint (passed to SprintExportModal) ───────────
  const CATEGORY_LABELS: Record<string, string> = {
    user_story: "User Story", bug: "Bug", mco: "MCO", best_effort: "Best-effort", tech_lead: "Tech Lead",
  };
  const EXPORT_CATEGORIES_CONFIG = [
    { key: "user_story",  label: "User Story",  color: (team.categoryAllocations["user_story_color"]  as string) ?? "#6366f1" },
    { key: "bug",         label: "Bug",          color: (team.categoryAllocations["bug_color"]          as string) ?? "#ef4444" },
    { key: "mco",         label: "MCO",          color: (team.categoryAllocations["mco_color"]          as string) ?? "#f59e0b" },
    { key: "best_effort", label: "Best-effort",  color: (team.categoryAllocations["best_effort_color"]  as string) ?? "#22c55e" },
    { key: "tech_lead",   label: "Tech Lead",    color: (team.categoryAllocations["tech_lead_color"]    as string) ?? "#a855f7" },
  ];

  const activeSprintExportData: SprintExportData | null = activeSprint ? (() => {
    const devTimes: number[] = [];
    const testTimes: number[] = [];
    for (const story of activeSprint.userStories) {
      const { devMs, testMs } = getCompletedTimings(story.statusHistory);
      if (devMs !== null && devMs > 0) devTimes.push(devMs);
      if (testMs !== null && testMs > 0) testTimes.push(testMs);
    }
    const toExportStories = (list: typeof activeSprint.userStories) =>
      list.map((s) => ({
        title:         s.title,
        category:      s.category,
        categoryLabel: CATEGORY_LABELS[s.category] ?? s.category,
        storyPoints:   s.storyPoints,
        assigneeName:  team.developers.find((d) => d.id === s.assigneeId)?.name ?? null,
      }));
    const spDone = activeSprint.userStories.filter((s) => s.status === "done").reduce((a, s) => a + s.storyPoints, 0);
    const spTotal = activeSprint.userStories.reduce((a, s) => a + s.storyPoints, 0);
    const denom = activeSprint.capacity > 0 ? activeSprint.capacity : spTotal;
    return {
      name:        activeSprint.name,
      teamName:    team.developers.length > 0 ? `${team.developers.length} dev${team.developers.length > 1 ? "s" : ""}` : "",
      startDate:   formatDate(activeSprint.startDate),
      endDate:     formatDate(activeSprint.endDate),
      capacity:    activeSprint.capacity,
      donePoints:  spDone,
      totalPoints: spTotal,
      progress:    denom > 0 ? Math.round((spDone / denom) * 100) : 0,
      categories: EXPORT_CATEGORIES_CONFIG
        .map((c) => {
          const stories = activeSprint.userStories.filter((s) => s.category === c.key);
          const sp     = stories.reduce((a, s) => a + s.storyPoints, 0);
          const spDoneC = stories.filter((s) => s.status === "done").reduce((a, s) => a + s.storyPoints, 0);
          return { ...c, count: stories.length, sp, spDone: spDoneC };
        })
        .filter((c) => c.sp > 0),
      avgDevMs:  devTimes.length  > 0 ? devTimes.reduce((a, v)  => a + v, 0) / devTimes.length  : null,
      avgTestMs: testTimes.length > 0 ? testTimes.reduce((a, v) => a + v, 0) / testTimes.length : null,
      bugsByEnvironment: (() => {
        const bugs = activeSprint.userStories.filter((s) => s.category === "bug");
        if (bugs.length === 0) return null;
        const counts = { dev: 0, staging: 0, preprod: 0, prod: 0, unset: 0 };
        for (const b of bugs) {
          const env = b.environment as keyof typeof counts | null;
          if (env && env in counts) counts[env]++;
          else counts.unset++;
        }
        return counts;
      })(),
      storiesByStatus: {
        todo:        toExportStories(activeSprint.userStories.filter((s) => s.status === "todo")),
        in_progress: toExportStories(activeSprint.userStories.filter((s) => s.status === "in_progress")),
        dev_done:    toExportStories(activeSprint.userStories.filter((s) => s.status === "dev_done")),
        done:        toExportStories(activeSprint.userStories.filter((s) => s.status === "done")),
      },
    };
  })() : null;

  const dashUrl = `/teams/${teamId}`;

  return (
    <div>
      {/* Export button */}
      {activeSprintExportData && (
        <div className="flex justify-end mb-3">
          <SprintExportModal data={activeSprintExportData} />
        </div>
      )}

      {/* Project Overview */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Project Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-indigo-600">
                {avgDevTime !== null ? formatDuration(avgDevTime) : "—"}
              </div>
              <div className="text-sm text-gray-500 mt-1">Avg Dev Time</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">
                {avgTestTime !== null ? formatDuration(avgTestTime) : "—"}
              </div>
              <div className="text-sm text-gray-500 mt-1">Avg Test Time</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600">
                {avgCompletion !== null ? `${avgCompletion}%` : "—"}
              </div>
              <div className="text-sm text-gray-500 mt-1">Avg Completion</div>
            </CardContent>
          </Card>
        </div>

        {/* Forecast chart inside Project Overview */}
        {forecast && (forecast.past.length > 0 || forecast.future.length > 0) && (
          <div className="mt-4">
            <ForecastChart
              past={forecast.past}
              future={forecast.future}
              summary={forecast.summary}
            />
          </div>
        )}
      </div>

      {/* Sprint Overview + Category Breakdown */}
      {chartData.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-6 items-start mb-8">
          <VelocityChart data={chartData} avgVelocityPerDay={avgVelocityPerDay} />
          {(() => {
            const donutSprints = chartSprints.filter((s) => s.userStories.length > 0);
            if (donutSprints.length === 0) return null;
            const alloc = team.categoryAllocations ?? {};
            const categoryColors = Object.fromEntries(
              ["user_story", "bug", "mco", "best_effort", "tech_lead"].map((k) => [k, alloc[`${k}_color`] as string])
                .filter(([, v]) => v)
            );
            return (
              <CategoryDonutChart
                sprints={donutSprints.map((s) => ({
                  id: s.id,
                  name: s.name,
                  active: s.status === "active",
                  stories: s.userStories.map((u) => ({ category: u.category ?? "user_story", storyPoints: u.storyPoints })),
                }))}
                colors={categoryColors}
              />
            );
          })()}
        </div>
      )}

      {/* Bugs by Environment */}
      {chartSprints.some((s) => s.userStories.some((u) => u.category === "bug")) && (
        <div className="mb-8">
          <BugEnvironmentChart
            sprints={chartSprints.map((s) => ({
              name: s.name,
              stories: s.userStories.map((u) => ({ category: u.category, environment: u.environment })),
            }))}
          />
        </div>
      )}

      {/* Active sprint board */}
      {activeSprint ? (() => {
        const stories = activeSprint.userStories;
        const donePoints = stories.filter((s) => s.status === "done").reduce((a, s) => a + s.storyPoints, 0);
        const totalPoints = stories.reduce((a, s) => a + s.storyPoints, 0);
        const denominator = activeSprint.capacity > 0 ? activeSprint.capacity : totalPoints;
        const progress = denominator > 0 ? Math.round((donePoints / denominator) * 100) : 0;

        const carryoverCount = stories.filter((s) => {
          const h = JSON.parse(s.sprintHistory ?? "[]") as { toSprintId: string }[];
          return h.some((e) => e.toSprintId === activeSprint.id);
        }).length;

        const filteredStories = activeCategories.size > 0
          ? stories.filter((s) => activeCategories.has(s.category))
          : stories;
        const groupedStories = {
          todo:        filteredStories.filter((s) => s.status === "todo"),
          in_progress: filteredStories.filter((s) => s.status === "in_progress"),
          dev_done:    filteredStories.filter((s) => s.status === "dev_done"),
          done:        filteredStories.filter((s) => s.status === "done"),
        };

        return (
          <div className="mb-8">
            {/* Sprint header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">{activeSprint.name}</h2>
                  <Badge variant="success">Active</Badge>
                  {carryoverCount > 0 && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                      ↩ {carryoverCount} carried over
                    </span>
                  )}
                  {isAdmin && (
                    <Link
                      href={`/teams/${teamId}/sprints/${activeSprint.id}?editSprint=1`}
                      className="text-gray-300 hover:text-gray-500 transition-colors"
                      title="Edit sprint"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(activeSprint.startDate)} → {formatDate(activeSprint.endDate)} · {sprintWeeks(activeSprint.startDate, activeSprint.endDate)}w
                </p>
              </div>
              {isAdmin && (
                <Link href={`/teams/${teamId}/sprints/new`}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    New Sprint
                  </Button>
                </Link>
              )}
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

            {/* Category filter pills */}
            {(() => {
              const alloc = team.categoryAllocations ?? {};
              const pillCategories = [
                { key: "user_story",  label: "User Story",  color: (alloc["user_story_color"]  as string) ?? "#6366f1" },
                { key: "bug",         label: "Bug",          color: (alloc["bug_color"]          as string) ?? "#ef4444" },
                { key: "mco",         label: "MCO",          color: (alloc["mco_color"]          as string) ?? "#f59e0b" },
                { key: "best_effort", label: "Best-effort",  color: (alloc["best_effort_color"]  as string) ?? "#22c55e" },
                { key: "tech_lead",   label: "Tech Lead",    color: (alloc["tech_lead_color"]    as string) ?? "#a855f7" },
              ]
                .map((c) => ({ ...c, count: stories.filter((s) => s.category === c.key).length }))
                .filter((c) => c.count > 0);
              if (pillCategories.length <= 1) return null;
              return (
                <div className="mb-3">
                  <KanbanCategoryFilter categories={pillCategories} />
                </div>
              );
            })()}

            {/* Kanban */}
            <div className="flex flex-col gap-3 mb-4">
              {(["todo", "in_progress", "dev_done", "done"] as const).map((status) => {
                const cfg = storyStatusConfig[status];
                const colStories = groupedStories[status];
                const Icon = cfg.icon;
                return (
                  <div key={status} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`h-4 w-4 ${status === "done" ? "text-green-500" : status === "dev_done" ? "text-purple-500" : status === "in_progress" ? "text-amber-500" : "text-gray-400"}`} />
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
                        const updateEnvironmentAction = updateStoryEnvironment.bind(null, story.id, activeSprint.id, teamId);
                        const moveAction = moveStoryToSprint.bind(null, story.id, activeSprint.id, teamId);
                        const assignee = team.developers.find((d) => d.id === story.assigneeId);
                        const spHistory = JSON.parse(story.spChanges ?? "[]") as { from: number; to: number; at: string }[];
                        const carryHistory = JSON.parse(story.sprintHistory ?? "[]") as { fromSprintName: string | null }[];
                        const elapsedMs = (status === "in_progress" || status === "dev_done")
                          ? getElapsedMs(story.statusHistory, status, story.createdAt)
                          : null;
                        const { devMs, testMs } = getCompletedTimings(story.statusHistory);

                        if (isAdmin && editStory === story.id) {
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
                            {/* Environment — bugs only */}
                            {story.category === "bug" && (
                              isAdmin ? (
                                <StoryEnvironmentSelect action={updateEnvironmentAction} defaultValue={story.environment ?? null} />
                              ) : story.environment ? (
                                <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 border ${
                                  story.environment === "prod"    ? "bg-red-50 text-red-600 border-red-200" :
                                  story.environment === "preprod" ? "bg-amber-50 text-amber-600 border-amber-200" :
                                  story.environment === "staging" ? "bg-blue-50 text-blue-600 border-blue-200" :
                                                                    "bg-gray-50 text-gray-500 border-gray-200"
                                }`}>{story.environment}</span>
                              ) : null
                            )}

                            {/* Elapsed timer for active stories */}
                            {elapsedMs !== null && (
                              <span
                                className={`text-[10px] rounded px-1.5 py-0.5 shrink-0 ${
                                  status === "dev_done"
                                    ? "text-purple-600 bg-purple-50 border border-purple-200"
                                    : "text-amber-600 bg-amber-50 border border-amber-200"
                                }`}
                                title={`Time in ${status === "dev_done" ? "testing" : "dev"}`}
                              >
                                ⏱ {formatElapsed(elapsedMs)}
                              </span>
                            )}
                            {/* Completed dev/test timings */}
                            {devMs !== null && (
                              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                                dev {formatElapsed(devMs)}
                              </span>
                            )}
                            {testMs !== null && (
                              <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 shrink-0">
                                test {formatElapsed(testMs)}
                              </span>
                            )}
                            {isAdmin && status !== "done" && (
                              <form action={updateStatusAction} className="shrink-0">
                                <input type="hidden" name="status" value={cfg.next} />
                                <button type="submit" className="text-xs font-medium whitespace-nowrap px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 transition-colors">
                                  → {storyStatusConfig[cfg.next as keyof typeof storyStatusConfig]?.label}
                                </button>
                              </form>
                            )}
                            {isAdmin && status === "dev_done" && (
                              <form action={updateStatusAction} className="shrink-0">
                                <input type="hidden" name="status" value="in_progress" />
                                <button type="submit" className="text-xs font-medium whitespace-nowrap px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-300 transition-colors">
                                  ← Back to Dev
                                </button>
                              </form>
                            )}
                            {isAdmin && status !== "done" && (
                              <MoveSprintSelect plannedSprints={plannedSprints} action={moveAction} />
                            )}
                            {isAdmin && (
                              <>
                                <Link href={`${dashUrl}?editStory=${story.id}`} scroll={false} className="text-gray-300 hover:text-indigo-400 transition-colors shrink-0" title="Edit story">
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

          </div>
        );
      })() : (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Active Sprint</h2>
            {isAdmin && (
              <Link href={`/teams/${teamId}/sprints/new`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  New Sprint
                </Button>
              </Link>
            )}
          </div>
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">No active sprint.</p>
            {isAdmin && (
              <Link href={`/teams/${teamId}/sprints/new`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Sprint
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Upcoming sprints */}
      {plannedSprints.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Upcoming Sprints <span className="text-sm font-normal text-gray-400">· {plannedSprints.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {plannedSprints.map((sprint) => {
              const planned = sprint.plannedPoints > 0 ? sprint.plannedPoints : sprint.userStories.reduce((a, s) => a + s.storyPoints, 0);
              return (
                <Link key={sprint.id} href={`/teams/${teamId}/sprints/${sprint.id}`} className="block">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900 leading-snug">{sprint.name}</span>
                        <Badge variant="secondary" className="shrink-0">Planned</Badge>
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)} · {sprintWeeks(sprint.startDate, sprint.endDate)}w
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {planned > 0 ? `${planned} SP planned` : "No stories yet"}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed sprints */}
      {completedSprints.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Completed Sprints <span className="text-sm font-normal text-gray-400">· {completedSprints.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {completedSprints.map((sprint) => {
              const done = sprint.userStories
                .filter((s) => s.status === "done")
                .reduce((a, s) => a + s.storyPoints, 0);
              return (
                <Link key={sprint.id} href={`/teams/${teamId}/sprints/${sprint.id}`} className="block">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900 leading-snug">{sprint.name}</span>
                        <Badge variant="outline" className="shrink-0">Done</Badge>
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)} · {sprintWeeks(sprint.startDate, sprint.endDate)}w
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{done} SP delivered</div>
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
