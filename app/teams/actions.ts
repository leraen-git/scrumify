"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTeam(formData: FormData) {
  const name = formData.get("name") as string;
  const sprintDuration = parseInt(formData.get("sprintDuration") as string, 10);

  if (!name?.trim()) throw new Error("Team name is required");

  const team = await prisma.team.create({
    data: { name: name.trim(), sprintDuration },
  });

  revalidatePath("/teams");
  redirect(`/teams/${team.id}/settings`);
}

export async function updateTeam(teamId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const sprintDuration = parseInt(formData.get("sprintDuration") as string, 10);

  if (!name?.trim()) throw new Error("Team name is required");

  await prisma.team.update({
    where: { id: teamId },
    data: { name: name.trim(), sprintDuration },
  });

  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
  redirect(`/teams/${teamId}`);
}

export async function deleteTeam(teamId: string) {
  await prisma.team.delete({ where: { id: teamId } });
  revalidatePath("/teams");
  redirect("/teams");
}

export async function addDeveloper(teamId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const storyPointsPerSprint = parseInt(formData.get("storyPointsPerSprint") as string, 10);

  if (!name?.trim()) throw new Error("Developer name is required");

  await prisma.developer.create({
    data: { name: name.trim(), storyPointsPerSprint, teamId },
  });

  revalidatePath(`/teams/${teamId}`);
  revalidatePath(`/teams/${teamId}/settings`);
}

export async function updateDeveloper(teamId: string, developerId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const storyPointsPerSprint = parseInt(formData.get("storyPointsPerSprint") as string, 10);

  await prisma.developer.update({
    where: { id: developerId },
    data: { name: name.trim(), storyPointsPerSprint },
  });

  revalidatePath(`/teams/${teamId}/settings`);
}

export async function removeDeveloper(teamId: string, developerId: string) {
  await prisma.developer.delete({ where: { id: developerId } });
  revalidatePath(`/teams/${teamId}/settings`);
  revalidatePath(`/teams/${teamId}`);
}
