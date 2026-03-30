import { CategoryDonutChart } from "@/components/category-donut-chart";
import { EstimationScatterChart, ScatterPoint } from "@/components/estimation-scatter-chart";
import { ForecastChart, ForecastSummary, FutureSprintPoint, PastSprintPoint } from "@/components/forecast-chart";
import { RetroAdviceCard } from "@/components/retro-advice-card";
import { StoriesImporter } from "@/components/stories-importer";
import { VelocityChart } from "@/components/velocity-chart";
import { apiFetch } from "@/lib/api";
import { countWorkingDays, formatDate, sprintWeeks } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";

interface StatusEvent {
  from: string;
  to: string;
  at: string;
}

interface SprintWithStories {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  plannedPoints: number;
  status: string;
  userStories: {
    title: string;
    status: string;
    storyPoints: number;
    category: string;
    assigneeId: string | null;
    statusHistory?: string | null;
    sprintHistory?: string | null;
  }[];
}

interface ForecastResponse {
  past: PastSprintPoint[];
  future: FutureSprintPoint[];
  summary: ForecastSummary;
}

function calcStatusDurationHours(raw: string | null | undefined, fromStatus: string, toStatus: string): number | null {
  const history: StatusEvent[] = JSON.parse(raw ?? "[]");
  if (!Array.isArray(history) || history.length === 0) return null;
  const entry = history.find((e) => e.from === fromStatus && e.to === toStatus);
  if (!entry) return null;
  const startEvent = history.find((e) => e.to === fromStatus);
  if (!startEvent) return null;
  const start = new Date(startEvent.at).getTime();
  const end = new Date(entry.at).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  return Math.round((end - start) / (1000 * 60 * 60));
}

export default async function VelocityPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const [team, forecast] = await Promise.all([
    apiFetch<{ id: string; developers: { id: string; name: string }[]; sprints: SprintWithStories[]; categoryAllocations: Record<string, string | number> }>(
      `/api/teams/${teamId}`,
    ).catch(() => null),
    apiFetch<ForecastResponse>(`/api/teams/${teamId}/forecast`).catch(() => null),
  ]);

  if (!team) notFound();

  const completedSprints = team.sprints
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const activeSprint = team.sprints.find((s) => s.status === "active") ?? null;

  const chartSprints = [
    ...completedSprints,
    ...(activeSprint ? [activeSprint] : []),
  ];

  const devCount = Math.max(1, team.developers.length);

  const devStats = team.developers.map((dev) => {
    const activeDone = activeSprint
      ? activeSprint.userStories
          .filter((s) => s.assigneeId === dev.id && s.status === "done")
          .reduce((a, s) => a + s.storyPoints, 0)
      : null;
    const totalCompleted = completedSprints.reduce(
      (a, sprint) =>
        a + sprint.userStories
          .filter((s) => s.assigneeId === dev.id && s.status === "done")
          .reduce((b, s) => b + s.storyPoints, 0),
      0,
    );
    const avgSP =
      completedSprints.length > 0
        ? Math.round((totalCompleted / completedSprints.length) * 10) / 10
        : null;
    return { id: dev.id, name: dev.name, activeDone, avgSP };
  });

  const scatterData: ScatterPoint[] = completedSprints.flatMap((sprint) =>
    sprint.userStories
      .filter((s) => s.status === "done" && s.statusHistory)
      .flatMap((s): ScatterPoint[] => {
        const history: StatusEvent[] = JSON.parse(s.statusHistory ?? "[]");

        const enteredDev = history.find((e) => e.to === "in_progress");
        const leftDev = history.find(
          (e) => e.from === "in_progress" && (e.to === "dev_done" || e.to === "done"),
        );
        const devHours =
          enteredDev && leftDev
            ? Math.round(
                (new Date(leftDev.at).getTime() - new Date(enteredDev.at).getTime()) / 3_600_000,
              )
            : 0;

        const enteredTest = history.find((e) => e.to === "dev_done");
        const leftTest = history.find((e) => e.from === "dev_done" && e.to === "done");
        const testHours =
          enteredTest && leftTest
            ? Math.round(
                (new Date(leftTest.at).getTime() - new Date(enteredTest.at).getTime()) / 3_600_000,
              )
            : 0;

        const hours = devHours + testHours;
        if (hours === 0) return [];

        return [{ sp: s.storyPoints, hours, devHours, testHours, title: s.title }];
      }),
  );

  const sprintVelocities = completedSprints.map((sprint) => {
    const delivered = sprint.userStories
      .filter((s) => s.status === "done")
      .reduce((a, s) => a + s.storyPoints, 0);
    const planned = sprint.plannedPoints > 0
      ? sprint.plannedPoints
      : sprint.userStories.reduce((a, s) => a + s.storyPoints, 0);
    const workingDays = Math.max(1, countWorkingDays(sprint.startDate, sprint.endDate));
    const velocityPerDay = Math.round((delivered / (workingDays * devCount)) * 100) / 100;
    const carryoverSP = sprint.userStories
      .filter((s) => {
        const h = JSON.parse(s.sprintHistory ?? "[]") as { toSprintId: string }[];
        return h.some((e) => e.toSprintId === sprint.id);
      })
      .reduce((a, s) => a + s.storyPoints, 0);
    return {
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      capacity: sprint.capacity,
      planned,
      delivered,
      velocityPerDay,
      carryoverSP,
    };
  });

  const avgVelocity =
    sprintVelocities.length > 0
      ? Math.round(sprintVelocities.reduce((a, s) => a + s.delivered, 0) / sprintVelocities.length)
      : null;

  const avgVelocityPerDay =
    sprintVelocities.length > 0
      ? Math.round((sprintVelocities.reduce((a, s) => a + s.velocityPerDay, 0) / sprintVelocities.length) * 100) / 100
      : 0;

  // Cycle time by story points: first in_progress → done (calendar days)
  const SP_BUCKETS = [5, 8, 13, 21];
  const cycleBuckets: Record<number, number[]> = { 5: [], 8: [], 13: [], 21: [] };
  const sprintsForCycle = [...completedSprints, ...(activeSprint ? [activeSprint] : [])];
  for (const sprint of sprintsForCycle) {
    for (const story of sprint.userStories) {
      if (story.status !== "done" || !SP_BUCKETS.includes(story.storyPoints) || !story.statusHistory) continue;
      const history: StatusEvent[] = JSON.parse(story.statusHistory ?? "[]");
      const enteredDev = history.find((e) => e.to === "in_progress");
      const becameDone = [...history].reverse().find((e) => e.to === "done");
      if (!enteredDev || !becameDone) continue;
      const ms = new Date(becameDone.at).getTime() - new Date(enteredDev.at).getTime();
      if (ms <= 0) continue;
      cycleBuckets[story.storyPoints].push(ms / (1000 * 60 * 60 * 24));
    }
  }
  const cycleTimeBySP = SP_BUCKETS.map((sp) => {
    const items = cycleBuckets[sp];
    if (items.length === 0) return { sp, avgDays: null as number | null, count: 0 };
    const avg = items.reduce((a, b) => a + b, 0) / items.length;
    return { sp, avgDays: Math.round(avg * 10) / 10, count: items.length };
  });

  const chartData = chartSprints.map((sprint) => {
    const delivered = sprint.userStories
      .filter((s) => s.status === "done")
      .reduce((a, s) => a + s.storyPoints, 0);
    const planned = sprint.plannedPoints > 0
      ? sprint.plannedPoints
      : sprint.userStories.reduce((a, s) => a + s.storyPoints, 0);
    const workingDays = Math.max(1, countWorkingDays(sprint.startDate, sprint.endDate));
    const velocityPerDay = Math.round((delivered / (workingDays * devCount)) * 100) / 100;
    return {
      name: sprint.name,
      spPlanned: planned,
      spDone: delivered,
      velocityPerDay,
      active: sprint.status === "active",
    };
  });

  // Build retro context from last 3 completed sprints (or fewer)
  const retroSprints = completedSprints.slice(-3).map((sprint) => ({
    name: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    capacity: sprint.capacity,
    plannedPoints: sprint.plannedPoints,
    stories: sprint.userStories.map((s) => {
      const devHours = calcStatusDurationHours(s.statusHistory, "in_progress", "dev_done") ?? undefined;
      const testHours = calcStatusDurationHours(s.statusHistory, "dev_done", "done") ?? undefined;
      return {
        title: s.title,
        storyPoints: s.storyPoints,
        status: s.status,
        category: s.category ?? "user_story",
        devHours,
        testHours,
      };
    }),
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Velocity</h2>
        {avgVelocity !== null && (
          <span className="text-sm text-gray-500">
            Avg: <strong className="text-indigo-600">{avgVelocity} SP</strong> / sprint
          </span>
        )}
      </div>

      {/* Cycle time by story points */}
      {cycleTimeBySP.some((b) => b.count > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {cycleTimeBySP.map(({ sp, avgDays, count }) => (
            <div key={sp} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">{sp} SP</span>
                {count > 0 && <span className="text-[10px] text-gray-400">{count} {count === 1 ? "story" : "stories"}</span>}
              </div>
              <div className="mt-2">
                {avgDays !== null ? (
                  <span className="text-2xl font-bold text-gray-900">{avgDays}<span className="text-sm font-normal text-gray-400 ml-1">d</span></span>
                ) : (
                  <span className="text-2xl font-bold text-gray-300">—</span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">avg cycle time</p>
            </div>
          ))}
        </div>
      )}

      {sprintVelocities.length === 0 ? (
        <div className="space-y-6">
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <TrendingUp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No completed sprints yet.</p>
            <p className="text-gray-400 text-xs mt-1">Velocity data will appear here once sprints are completed.</p>
          </div>

          {/* Backlog import available even without completed sprints */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Backlog Import</h3>
            <p className="text-xs text-gray-400 mb-4">
              Import your full backlog from CSV or Excel. Use a <strong>Sprint</strong> column to
              assign stories to specific sprints; leave it blank to add stories to the backlog.
            </p>
            <StoriesImporter teamId={teamId} mode="backlog" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <VelocityChart data={chartData} avgVelocityPerDay={avgVelocityPerDay} />
            {(() => {
              const donutSprints = [
                ...completedSprints,
                ...(activeSprint ? [activeSprint] : []),
              ].filter((s) => s.userStories.length > 0);
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

          {/* Forecast chart */}
          {forecast && (forecast.past.length > 0 || forecast.future.length > 0) && (
            <ForecastChart
              past={forecast.past}
              future={forecast.future}
              summary={forecast.summary}
            />
          )}

          {/* Backlog import */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Backlog Import</h3>
            <p className="text-xs text-gray-400 mb-4">
              Import your full backlog. Add a <strong>Sprint</strong> column to assign stories to
              specific sprints; leave blank to add to the backlog (used in the forecast above).
            </p>
            <StoriesImporter teamId={teamId} mode="backlog" />
          </div>

          {/* Estimation accuracy scatter */}
          <EstimationScatterChart data={scatterData} />

          {/* Developer contributions */}
          {devStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Developer Contributions</h3>
              <div className="divide-y divide-gray-50">
                {devStats.map((dev) => (
                  <div key={dev.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <span className="text-sm text-gray-800 font-medium">{dev.name}</span>
                    <div className="flex items-center gap-6 text-xs text-gray-500">
                      {dev.activeDone !== null && (
                        <span>
                          Active sprint:{" "}
                          <strong className="text-gray-900">{dev.activeDone} SP</strong>
                        </span>
                      )}
                      <span>
                        Avg:{" "}
                        <strong className="text-indigo-600">
                          {dev.avgSP !== null ? `${dev.avgSP} SP` : "—"}
                        </strong>
                        {" "}/ sprint
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <RetroAdviceCard sprints={retroSprints} />

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Sprint</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Capacity</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Planned</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Delivered</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Carryover</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {sprintVelocities.map((sprint, i) => {
                  const efficiency =
                    sprint.capacity > 0
                      ? Math.round((sprint.delivered / sprint.capacity) * 100)
                      : 0;
                  return (
                    <tr
                      key={i}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{sprint.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)} · {sprintWeeks(sprint.startDate, sprint.endDate)}w
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{sprint.capacity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{sprint.planned}</td>
                      <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                        {sprint.delivered}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sprint.carryoverSP > 0 ? (
                          <span className="font-medium text-amber-600">{sprint.carryoverSP} SP</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-medium ${
                            efficiency >= 80
                              ? "text-green-600"
                              : efficiency >= 50
                              ? "text-amber-600"
                              : "text-red-500"
                          }`}
                        >
                          {efficiency}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
