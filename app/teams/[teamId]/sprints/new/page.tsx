import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

async function createSprint(teamId: string, formData: FormData) {
  "use server";
  const { prisma: db } = await import("@/lib/db");
  const { revalidatePath } = await import("next/cache");

  const name = formData.get("name") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  const team = await db.team.findUnique({
    where: { id: teamId },
    include: { developers: true },
  });

  if (!team) throw new Error("Team not found");

  const capacity = team.developers.reduce((a, d) => a + d.storyPointsPerSprint, 0);

  const sprint = await db.sprint.create({
    data: {
      name: name.trim(),
      startDate,
      endDate,
      capacity,
      teamId,
      status: "planned",
    },
  });

  revalidatePath(`/teams/${teamId}`);
  redirect(`/teams/${teamId}/sprints/${sprint.id}`);
}

export default async function NewSprintPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { developers: true },
  });

  if (!team) notFound();

  // Suggest start/end dates
  const today = new Date();
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
  const endDate = new Date(nextMonday);
  endDate.setDate(nextMonday.getDate() + team.sprintDuration * 7 - 1);

  const toISO = (d: Date) => d.toISOString().split("T")[0];

  // Suggest sprint name
  const sprintCount = await prisma.sprint.count({ where: { teamId } });
  const suggestedName = `Sprint ${sprintCount + 1}`;

  const totalCapacity = team.developers.reduce((a, d) => a + d.storyPointsPerSprint, 0);

  const createSprintWithTeam = createSprint.bind(null, teamId);

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link href={`/teams/${teamId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to {team.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Sprint</h1>
        <p className="text-gray-500 mt-1">Plan a new sprint for {team.name}.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
        <form action={createSprintWithTeam} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Sprint Name</Label>
            <Input id="name" name="name" defaultValue={suggestedName} required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={toISO(nextMonday)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={toISO(endDate)} required />
            </div>
          </div>

          {/* Capacity preview */}
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
            <div className="text-sm font-medium text-indigo-800 mb-2">Estimated Capacity</div>
            {team.developers.length === 0 ? (
              <p className="text-sm text-indigo-600">No developers added yet. Add developers in team settings.</p>
            ) : (
              <>
                <div className="space-y-1 mb-3">
                  {team.developers.map((dev) => (
                    <div key={dev.id} className="flex justify-between text-sm text-indigo-700">
                      <span>{dev.name}</span>
                      <span>{dev.storyPointsPerSprint} SP</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between text-sm font-semibold text-indigo-900">
                  <span>Total Capacity</span>
                  <span>{totalCapacity} SP</span>
                </div>
                <p className="text-xs text-indigo-500 mt-2">
                  Note: this is the base capacity. You can adjust for days off after creating the sprint.
                </p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/teams/${teamId}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit">Create Sprint</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
