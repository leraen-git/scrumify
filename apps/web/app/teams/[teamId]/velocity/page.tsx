import { CategoryDonutChart } from "@/components/category-donut-chart";
import { VelocityChart } from "@/components/velocity-chart";
import { apiFetch } from "@/lib/api";
import { countWorkingDays, formatDate } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";

interface SprintWithStories {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  plannedPoints: number;
  status: string;
  userStories: { status: string; storyPoints: number; category: string }[];
}

export default async function VelocityPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const team = await apiFetch<{ id: string; developers: { id: string }[]; sprints: SprintWithStories[]; categoryAllocations: Record<string, string | number> }>(`/api/teams/${teamId}`).catch(() => null);
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

  const sprintVelocities = completedSprints.map((sprint) => {
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
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      capacity: sprint.capacity,
      planned,
      delivered,
      velocityPerDay,
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

      {sprintVelocities.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <TrendingUp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No completed sprints yet.</p>
          <p className="text-gray-400 text-xs mt-1">Velocity data will appear here once sprints are completed.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-6 items-start">
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sprint</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Capacity</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Planned</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Delivered</th>
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
                      {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{sprint.capacity}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{sprint.planned}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                      {sprint.delivered}
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
