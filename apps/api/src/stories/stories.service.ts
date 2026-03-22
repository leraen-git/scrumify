import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(teamId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.teamId !== teamId) throw new NotFoundException();
    return this.prisma.userStory.findMany({
      where: { sprintId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    teamId: string,
    sprintId: string,
    data: { title: string; storyPoints: number; assigneeId?: string | null; category?: string },
  ) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.teamId !== teamId) throw new NotFoundException();
    return this.prisma.userStory.create({
      data: { title: data.title.trim(), storyPoints: data.storyPoints, assigneeId: data.assigneeId ?? null, category: data.category ?? 'user_story', sprintId },
    });
  }

  async update(
    teamId: string,
    sprintId: string,
    storyId: string,
    data: { title?: string; storyPoints?: number; assigneeId?: string | null; status?: string; category?: string },
  ) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.teamId !== teamId) throw new NotFoundException();

    const current = await this.prisma.userStory.findUnique({ where: { id: storyId } });
    if (!current || current.sprintId !== sprintId) throw new NotFoundException();

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.status !== undefined) updateData.status = data.status;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId ?? null;

    if (data.storyPoints !== undefined && data.storyPoints !== current.storyPoints) {
      const history = JSON.parse(current.spChanges ?? '[]') as { from: number; to: number; at: string }[];
      history.push({ from: current.storyPoints, to: data.storyPoints, at: new Date().toISOString() });
      updateData.storyPoints = data.storyPoints;
      updateData.spChanges = JSON.stringify(history);
    }

    return this.prisma.userStory.update({ where: { id: storyId }, data: updateData });
  }

  async remove(teamId: string, sprintId: string, storyId: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.teamId !== teamId) throw new NotFoundException();
    await this.prisma.userStory.delete({ where: { id: storyId } });
  }

  async importStories(
    teamId: string,
    sprintId: string,
    stories: { title: string; storyPoints: number; status: string; category: string; assigneeName?: string }[],
  ) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.teamId !== teamId) throw new NotFoundException();

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { developers: { select: { id: true, name: true } } },
    });
    const devsByName = new Map(
      (team?.developers ?? []).map((d: { id: string; name: string }) => [d.name.toLowerCase(), d.id]),
    );

    await this.prisma.userStory.deleteMany({ where: { sprintId } });
    await this.prisma.userStory.createMany({
      data: stories.map((s) => ({
        title: s.title,
        storyPoints: s.storyPoints,
        status: s.status,
        category: s.category ?? 'user_story',
        sprintId,
        assigneeId: (s.assigneeName
          ? (devsByName.get(s.assigneeName.toLowerCase()) ?? null)
          : null) as string | null,
      })),
    });

    // Freeze plannedPoints on first import only
    if (sprint.plannedPoints === 0) {
      const total = stories.reduce((sum, s) => sum + s.storyPoints, 0);
      await this.prisma.sprint.update({
        where: { id: sprintId },
        data: { plannedPoints: total },
      });
    }
  }
}
