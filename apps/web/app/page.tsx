import { apiFetch } from "@/lib/api";
import { redirect } from "next/navigation";

export default async function Home() {
  const teams = await apiFetch<{ id: string }[]>("/api/teams").catch(() => []);
  redirect(teams.length > 0 ? `/teams/${teams[0].id}` : "/teams");
}
