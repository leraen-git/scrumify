import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { CalendarDays, Clock, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const statusConfig = {
  planned: { label: "Planned", variant: "secondary" as const },
  active: { label: "Active", variant: "success" as const },
  completed: { label: "Completed", variant: "outline" as const },
};

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      developers: { orderBy: { name: "asc" } },
      sprints: {
        orderBy: { startDate: "desc" },
        include: {
          _count: { select: { userStories: true } },
          userStories: { select: { status: true, storyPoints: true } },
        },
      },
    },
  });

  if (!team) notFound();

  const activeSprint = team.sprints.find((s) => s.status === "active");
  const totalCapacity = team.developers.reduce((acc, d) => acc + d.storyPointsPerSprint, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {team.developers.length} developer{team.developers.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {team.sprintDuration} week sprint{team.sprintDuration !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/teams/${teamId}/settings`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
          <Link href={`/teams/${teamId}/sprints/new`}>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Sprint
            </Button>
          </Link>
        </div>
      </div>

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
              {activeSprint ? "Yes" : "No"}
            </div>
            <div className="text-sm text-gray-500 mt-1">Active Sprint</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sprints */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Sprints</h2>
            <Link href={`/teams/${teamId}/sprints/new`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Sprint
              </Button>
            </Link>
          </div>

          {team.sprints.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
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
            <div className="space-y-3">
              {team.sprints.map((sprint) => {
                const done = sprint.userStories.filter((s) => s.status === "done").reduce((a, s) => a + s.storyPoints, 0);
                const total = sprint.userStories.reduce((a, s) => a + s.storyPoints, 0);
                const progress = sprint.capacity > 0 ? Math.round((done / sprint.capacity) * 100) : 0;
                const cfg = statusConfig[sprint.status as keyof typeof statusConfig] ?? statusConfig.planned;

                return (
                  <Link key={sprint.id} href={`/teams/${teamId}/sprints/${sprint.id}`}>
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
                        {sprint.status === "active" && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Members */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            <Link href={`/teams/${teamId}/settings`}>
              <Button variant="ghost" size="sm" className="text-xs">
                Manage
              </Button>
            </Link>
          </div>
          {team.developers.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-400 text-sm mb-3">No developers yet.</p>
              <Link href={`/teams/${teamId}/settings`}>
                <Button size="sm" variant="outline">Add Developers</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {team.developers.map((dev) => (
                <div key={dev.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold">
                      {dev.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{dev.name}</span>
                  </div>
                  <Badge variant="secondary">{dev.storyPointsPerSprint} SP</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
