import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewTeamForm } from "./new-team-form";

export default function NewTeamPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Teams
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Team</h1>
        <p className="text-gray-500 mt-1">Set up a new scrum team. Optionally bootstrap it from a Jira CSV export.</p>
      </div>

      <NewTeamForm />
    </div>
  );
}
