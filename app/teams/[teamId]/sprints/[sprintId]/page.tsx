import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Circle, Clock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function updateSprintStatus(sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { prisma: db } = await import("@/lib/db");
  const { revalidatePath: revalidate } = await import("next/cache");
  const status = formData.get("status") as string;
  await db.sprint.update({ where: { id: sprintId }, data: { status } });
  revalidate(`/teams/${teamId}/sprints/${sprintId}`);
  revalidate(`/teams/${teamId}`);
}

async function addStory(sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { prisma: db } = await import("@/lib/db");
  const { revalidatePath: revalidate } = await import("next/cache");
  const title = formData.get("title") as string;
  const storyPoints = parseInt(formData.get("storyPoints") as string, 10);
  const assigneeId = (formData.get("assigneeId") as string) || null;
  if (!title?.trim()) return;
  await db.userStory.create({
    data: { title: title.trim(), storyPoints, sprintId, assigneeId },
  });
  revalidate(`/teams/${teamId}/sprints/${sprintId}`);
}

async function updateStoryStatus(storyId: string, sprintId: string, teamId: string, formData: FormData) {
  "use server";
  const { prisma: db } = await import("@/lib/db");
  const { revalidatePath: revalidate } = await import("next/cache");
  const status = formData.get("status") as string;
  await db.userStory.update({ where: { id: storyId }, data: { status } });
  revalidate(`/teams/${teamId}/sprints/${sprintId}`);
}

async function removeStory(storyId: string, sprintId: string, teamId: string) {
  "use server";
  const { prisma: db } = await import("@/lib/db");
  const { revalidatePath: revalidate } = await import("next/cache");
  await db.userStory.delete({ where: { id: storyId } });
  revalidate(`/teams/${teamId}/sprints/${sprintId}`);
}

const storyStatusConfig = {
  todo: { label: "To Do", icon: Circle, variant: "secondary" as const, next: "in_progress" },
  in_progress: { label: "In Progress", icon: Clock, variant: "warning" as const, next: "done" },
  done: { label: "Done", icon: CheckCircle2, variant: "success" as const, next: "todo" },
};

const sprintStatusOptions = ["planned", "active", "completed"];

export default async function SprintPage({
  params,
}: {
  params: Promise<{ teamId: string; sprintId: string }>;
}) {
  const { teamId, sprintId } = await params;

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      team: { include: { developers: { orderBy: { name: "asc" } } } },
      userStories: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!sprint || sprint.teamId !== teamId) notFound();

  const donePoints = sprint.userStories
    .filter((s) => s.status === "done")
    .reduce((a, s) => a + s.storyPoints, 0);
  const totalPoints = sprint.userStories.reduce((a, s) => a + s.storyPoints, 0);
  const progress = sprint.capacity > 0 ? Math.round((donePoints / sprint.capacity) * 100) : 0;

  const updateStatus = updateSprintStatus.bind(null, sprintId, teamId);
  const addStoryAction = addStory.bind(null, sprintId, teamId);

  const groupedStories = {
    todo: sprint.userStories.filter((s) => s.status === "todo"),
    in_progress: sprint.userStories.filter((s) => s.status === "in_progress"),
    done: sprint.userStories.filter((s) => s.status === "done"),
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            href={`/teams/${teamId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {sprint.team.name}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{sprint.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
          </p>
        </div>
        <form action={updateStatus} className="flex items-center gap-2">
          <select
            name="status"
            defaultValue={sprint.status}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {sprintStatusOptions.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">
            Update
          </Button>
        </form>
      </div>

      {/* Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-indigo-600">{sprint.capacity}</div>
            <div className="text-xs text-gray-500 mt-1">SP Capacity</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-gray-900">{totalPoints}</div>
            <div className="text-xs text-gray-500 mt-1">SP Planned</div>
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

      {/* Progress bar */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Sprint progress</span>
          <span>{donePoints} / {sprint.capacity} SP</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Stories by status */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {(["todo", "in_progress", "done"] as const).map((status) => {
          const cfg = storyStatusConfig[status];
          const stories = groupedStories[status];
          const Icon = cfg.icon;
          return (
            <div key={status} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-4 w-4 ${status === "done" ? "text-green-500" : status === "in_progress" ? "text-amber-500" : "text-gray-400"}`} />
                <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                <span className="ml-auto text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                  {stories.length}
                </span>
              </div>
              <div className="space-y-2">
                {stories.map((story) => {
                  const updateStatusAction = updateStoryStatus.bind(null, story.id, sprintId, teamId);
                  const removeStoryAction = removeStory.bind(null, story.id, sprintId, teamId);
                  const assignee = sprint.team.developers.find((d) => d.id === story.assigneeId);
                  return (
                    <div key={story.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm text-gray-800 leading-snug">{story.title}</span>
                        <form action={removeStoryAction}>
                          <button type="submit" className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{story.storyPoints} SP</Badge>
                          {assignee && (
                            <span className="text-xs text-gray-400">{assignee.name}</span>
                          )}
                        </div>
                        <form action={updateStatusAction}>
                          <input type="hidden" name="status" value={cfg.next} />
                          <button
                            type="submit"
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                          >
                            → {storyStatusConfig[cfg.next as keyof typeof storyStatusConfig]?.label ?? cfg.next}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add story */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-indigo-500" />
          Add User Story
        </h3>
        <form action={addStoryAction} className="flex gap-3 flex-wrap sm:flex-nowrap">
          <Input name="title" placeholder="Story title or description" required className="flex-1 min-w-0" />
          <Input name="storyPoints" type="number" min="1" max="100" defaultValue="3" className="w-24 flex-shrink-0" required />
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
      </div>
    </div>
  );
}
