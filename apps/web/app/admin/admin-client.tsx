"use client";

import { useState } from "react";
import { TeamManager } from "./team-manager";
import { UserManager } from "./user-manager";

type Team = {
  id: string;
  name: string;
  sprintDuration: number;
  _count: { developers: number; sprints: number };
  sprints: { id: string; status: string }[];
};

type User = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  accessToken: string | null;
  assignedTeamId: string | null;
  assignedTeam: { id: string; name: string } | null;
};

export function AdminClient({
  initialTeams,
  users,
  baseUrl,
}: {
  initialTeams: Team[];
  users: User[];
  baseUrl: string;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const simpleTeams = teams.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Teams</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage scrum teams.</p>
        </div>
        <TeamManager teams={teams} onTeamsChange={setTeams} />
      </section>

      <hr className="border-gray-200" />

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Add users and assign them to teams. Each user gets a unique access link.
          </p>
        </div>
        <UserManager users={users} teams={simpleTeams} baseUrl={baseUrl} />
      </section>
    </div>
  );
}
