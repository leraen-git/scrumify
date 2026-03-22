import { SprintDatePicker } from "@/components/sprint-date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { countWorkingDays } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

async function createSprint(teamId: string, formData: FormData) {
  "use server";
  const { apiFetch: api } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const { redirect: redir } = await import("next/navigation");
  const name = formData.get("name") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  await api(`/api/teams/${teamId}/sprints`, {
    method: "POST",
    body: JSON.stringify({ name: name.trim(), startDate, endDate }),
  });
  revalidatePath(`/teams/${teamId}`, "layout");
  redir(`/teams/${teamId}/sprints`);
}

function nextWorkingDay(date: Date): Date {
  const d = new Date(date);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sat → Mon
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sun → Mon
  return d;
}

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default async function NewSprintPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const team = await apiFetch<{
    id: string;
    name: string;
    sprintDuration: number;
    developers: { id: string; name: string; storyPointsPerSprint: number; daysOff: { date: string; type: string }[] }[];
    sprints: { id: string; endDate: string }[];
  }>(`/api/teams/${teamId}`).catch(() => null);

  if (!team) notFound();

  const lastSprint = team.sprints.length > 0
    ? team.sprints.reduce((a, b) => a.endDate > b.endDate ? a : b)
    : null;
  const sprintCount = team.sprints.length;

  // Start date: day after last sprint ends, or tomorrow — skipping weekends
  let startDate: Date;
  if (lastSprint) {
    const afterLast = new Date(lastSprint.endDate);
    afterLast.setDate(afterLast.getDate() + 1);
    startDate = nextWorkingDay(afterLast);
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDate = nextWorkingDay(tomorrow);
  }

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + team.sprintDuration * 7 - 1);

  const startISO = toISO(startDate);
  const endISO = toISO(endDate);

  const workingDays = countWorkingDays(startISO, endISO);
  const fullSprintDays = team.sprintDuration * 5;

  // Per-developer capacity adjusted for days off in the sprint period
  const devCapacities = team.developers.map((dev) => {
    const daysOffInSprint = dev.daysOff
      .filter((d) => d.date >= startISO && d.date <= endISO)
      .reduce((s, d) => s + (d.type === "half" ? 0.5 : 1), 0);
    const effectiveDays = Math.max(0, workingDays - daysOffInSprint);
    const adjustedSP = Math.round((dev.storyPointsPerSprint * effectiveDays) / fullSprintDays);
    return { ...dev, adjustedSP, daysOffInSprint, effectiveDays };
  });

  const totalCapacity = devCapacities.reduce((a, d) => a + d.adjustedSP, 0);
  const totalDaysOff = devCapacities.reduce((a, d) => a + d.daysOffInSprint, 0);
  const suggestedName = `Sprint ${sprintCount + 1}`;

  const createSprintWithTeam = createSprint.bind(null, teamId);

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link
          href={`/teams/${teamId}/sprints`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sprints
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

          <SprintDatePicker
            sprintDuration={team.sprintDuration}
            defaultStartISO={startISO}
            defaultEndISO={endISO}
          />

          {/* Capacity preview */}
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-indigo-800">Estimated Capacity</div>
              <div className="text-xs text-indigo-500">
                {workingDays} working day{workingDays !== 1 ? "s" : ""}
                {totalDaysOff > 0 && (
                  <span className="text-red-400 ml-1">· {totalDaysOff} day{totalDaysOff !== 1 ? "s" : ""} off</span>
                )}
              </div>
            </div>

            {team.developers.length === 0 ? (
              <p className="text-sm text-indigo-600">
                No developers added yet. Add developers in the Team tab.
              </p>
            ) : (
              <>
                <div className="space-y-1 mb-3">
                  {devCapacities.map((dev) => (
                    <div key={dev.id} className="flex justify-between text-sm text-indigo-700">
                      <span className="flex items-center gap-1.5">
                        {dev.name}
                        {dev.daysOffInSprint > 0 && (
                          <span className="text-xs text-red-400">
                            ({dev.daysOffInSprint} day{dev.daysOffInSprint !== 1 ? "s" : ""} off)
                          </span>
                        )}
                      </span>
                      <span>
                        {dev.adjustedSP} SP
                        {dev.adjustedSP !== dev.storyPointsPerSprint && (
                          <span className="text-indigo-400 ml-1">(base: {dev.storyPointsPerSprint})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between text-sm font-semibold text-indigo-900">
                  <span>Total Capacity</span>
                  <span>{totalCapacity} SP</span>
                </div>
                <p className="text-xs text-indigo-500 mt-2">
                  Based on working days minus days off per developer.{" "}
                  Manage days off in the <strong>Team</strong> tab.
                </p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/teams/${teamId}/sprints`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit">Create Sprint</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
