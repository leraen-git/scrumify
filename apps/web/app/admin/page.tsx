import { apiFetch } from "@/lib/api";
import { AdminClient } from "./admin-client";

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

export default async function AdminPage() {
  const [teams, users] = await Promise.all([
    apiFetch<Team[]>("/api/teams").catch(() => [] as Team[]),
    apiFetch<User[]>("/api/admin/users").catch(() => [] as User[]),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";

  return <AdminClient initialTeams={teams} users={users} baseUrl={baseUrl} />;
}
