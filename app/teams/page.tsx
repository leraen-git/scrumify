import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { Clock, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { developers: true, sprints: true } },
      sprints: {
        where: { status: "active" },
        take: 1,
      },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <p className="text-gray-500 mt-1">Manage your scrum teams and switch between them.</p>
        </div>
        <Link href="/teams/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Team
          </Button>
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-1">No teams yet</h2>
          <p className="text-gray-500 mb-6">Create your first team to get started.</p>
          <Link href="/teams/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{team.name}</CardTitle>
                  {team.sprints.length > 0 && (
                    <Badge variant="success">Active Sprint</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {team._count.developers} developer{team._count.developers !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {team.sprintDuration} week{team.sprintDuration !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/teams/${team.id}`} className="flex-1">
                    <Button variant="default" className="w-full" size="sm">
                      Open
                    </Button>
                  </Link>
                  <Link href={`/teams/${team.id}/settings`}>
                    <Button variant="outline" size="sm" className="px-2">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
