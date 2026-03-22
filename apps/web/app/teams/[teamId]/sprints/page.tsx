import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

interface SprintWithStories {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  capacity: number;
  userStories: { status: string; storyPoints: number }[];
}
import { countWorkingDays, formatDate } from "@/lib/utils";
import { CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const statusConfig = {
  planned: { label: "Planned", variant: "secondary" as const },
  active: { label: "Active", variant: "success" as const },
  completed: { label: "Completed", variant: "outline" as const },
};

function SprintCard({ sprint, teamId }: { sprint: SprintWithStories; teamId: string }) {
  const done = sprint.userStories.filter((s) => s.status === "done").reduce((a, s) => a + s.storyPoints, 0);
  const total = sprint.userStories.reduce((a, s) => a + s.storyPoints, 0);
  const progress = sprint.capacity > 0 ? Math.round((done / sprint.capacity) * 100) : 0;
  const cfg = statusConfig[sprint.status as keyof typeof statusConfig] ?? statusConfig.planned;
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = countWorkingDays(sprint.startDate, sprint.endDate);
  const elapsedDays = sprint.startDate <= today
    ? countWorkingDays(sprint.startDate, today < sprint.endDate ? today : sprint.endDate)
    : 0;
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const timeProgress = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0;

  return (
    <Link href={`/teams/${teamId}/sprints/${sprint.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="font-medium text-gray-900">{sprint.name}</span>
              <div className="text-xs text-gray-400 mt-0.5">
                {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
              </div>
            </div>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>{sprint.capacity} SP capacity</span>
            <span>·</span>
            <span>{done}/{total} SP done</span>
          </div>
          {sprint.status !== "planned" && (
            <div className="mt-3 space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Story points</span>
                  <span>{done} / {sprint.capacity} SP</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progress >= 80 ? "bg-green-400" : progress >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Time elapsed</span>
                  <span>{remainingDays} working day{remainingDays !== 1 ? "s" : ""} left</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${timeProgress >= 80 ? "bg-red-400" : timeProgress >= 50 ? "bg-amber-400" : "bg-green-400"}`}
                    style={{ width: `${Math.min(timeProgress, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function SprintsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const sprints = await apiFetch<SprintWithStories[]>(`/api/teams/${teamId}/sprints`).catch(() => null);
  if (sprints === null) notFound();

  const activeAndPlanned = sprints.filter((s) => s.status !== "completed");
  const completed = sprints.filter((s) => s.status === "completed");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">All Sprints</h2>
        <Link href={`/teams/${teamId}/sprints/new`}>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Sprint
          </Button>
        </Link>
      </div>

      {sprints.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-4">No sprints yet. Create your first sprint.</p>
          <Link href={`/teams/${teamId}/sprints/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Sprint
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {activeAndPlanned.length > 0 && (
            <div className="space-y-3">
              {activeAndPlanned.map((sprint) => (
                <SprintCard key={sprint.id} sprint={sprint} teamId={teamId} />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer select-none list-none mb-3">
                <span className="text-sm font-semibold text-gray-500 group-open:text-gray-700">
                  Sprints Completed ({completed.length})
                </span>
                <svg
                  className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="space-y-3">
                {completed.map((sprint) => (
                  <SprintCard key={sprint.id} sprint={sprint} teamId={teamId} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
