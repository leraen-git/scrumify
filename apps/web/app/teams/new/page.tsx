import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

async function createTeam(formData: FormData) {
  "use server";
  const { apiFetch } = await import("@/lib/api");
  const { revalidatePath } = await import("next/cache");
  const name = formData.get("name") as string;
  const sprintDuration = parseInt(formData.get("sprintDuration") as string, 10);
  if (!name?.trim()) return;
  const team = await apiFetch<{ id: string }>("/api/teams", {
    method: "POST",
    body: JSON.stringify({ name: name.trim(), sprintDuration }),
  });
  revalidatePath("/teams");
  redirect(`/teams/${team.id}/team`);
}

export default async function NewTeamPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Teams
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Team</h1>
        <p className="text-gray-500 mt-1">Set up a new scrum team. You can add developers after.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
        <form action={createTeam} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Team Name</Label>
            <Input id="name" name="name" placeholder="e.g. Frontend Team" required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sprintDuration">Sprint Duration</Label>
            <select
              id="sprintDuration"
              name="sprintDuration"
              defaultValue="2"
              className="flex h-9 w-full items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="1">1 week</option>
              <option value="2">2 weeks</option>
              <option value="3">3 weeks</option>
              <option value="4">4 weeks</option>
            </select>
            <p className="text-xs text-gray-400">This can be changed later in team settings.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/teams">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit">Create Team</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
