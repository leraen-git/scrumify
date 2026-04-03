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
    data: { title?: string; storyPoints?: number; assigneeId?: string | null; status?: string; category?: string; sprintId?: string; environment?: string | null },
  ) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.teamId !== teamId) throw new NotFoundException();

    const current = await this.prisma.userStory.findUnique({ where: { id: storyId } });
    if (!current || current.sprintId !== sprintId) throw new NotFoundException();

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.status !== undefined && data.status !== current.status) {
      updateData.status = data.status;
      const history = JSON.parse(current.statusHistory ?? '[]') as { from: string; to: string; at: string }[];
      history.push({ from: current.status, to: data.status, at: new Date().toISOString() });
      updateData.statusHistory = JSON.stringify(history);
    }
    if (data.category !== undefined) updateData.category = data.category;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId ?? null;
    if (data.environment !== undefined) updateData.environment = data.environment ?? null;

    if (data.storyPoints !== undefined && data.storyPoints !== current.storyPoints) {
      const history = JSON.parse(current.spChanges ?? '[]') as { from: number; to: number; at: string }[];
      history.push({ from: current.storyPoints, to: data.storyPoints, at: new Date().toISOString() });
      updateData.storyPoints = data.storyPoints;
      updateData.spChanges = JSON.stringify(history);
    }

    // Sprint move — only allowed for non-done stories
    if (data.sprintId !== undefined && data.sprintId !== current.sprintId && current.status !== 'done') {
      const toSprint = await this.prisma.sprint.findUnique({ where: { id: data.sprintId } });
      if (!toSprint || toSprint.teamId !== teamId) throw new NotFoundException();

      const fromSprint = current.sprintId
        ? await this.prisma.sprint.findUnique({ where: { id: current.sprintId } })
        : null;

      const sprintHistory = JSON.parse(current.sprintHistory ?? '[]') as {
        fromSprintId: string | null;
        fromSprintName: string | null;
        toSprintId: string;
        toSprintName: string;
        at: string;
      }[];
      sprintHistory.push({
        fromSprintId: current.sprintId ?? null,
        fromSprintName: fromSprint?.name ?? null,
        toSprintId: data.sprintId,
        toSprintName: toSprint.name,
        at: new Date().toISOString(),
      });
      updateData.sprintHistory = JSON.stringify(sprintHistory);
      updateData.sprintId = data.sprintId;
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
        teamId,
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

  async importBacklog(
    teamId: string,
    stories: {
      title: string;
      storyPoints: number;
      status: string;
      category: string;
      assigneeName?: string;
      sprintName?: string;
      priority?: number;
    }[],
  ) {
    // Security: verify team exists before any mutation
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        sprintDuration: true,
        developers: { select: { id: true, name: true } },
        sprints: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });
    if (!team) throw new NotFoundException();

    const devsByName = new Map(
      team.developers.map((d) => [d.name.toLowerCase(), d.id]),
    );

    // Build sprint name → id map (case-insensitive)
    const sprintsByName = new Map(
      team.sprints.map((s) => [s.name.toLowerCase().trim(), s.id]),
    );

    // Separate stories by sprint assignment
    const backlogRows: typeof stories = [];
    const sprintGroups = new Map<string, { sprintId: string; rows: typeof stories }>();

    for (const story of stories) {
      const sprintKey = story.sprintName?.toLowerCase().trim() ?? '';
      if (!sprintKey) {
        backlogRows.push(story);
        continue;
      }

      const sprintId = sprintsByName.get(sprintKey);
      if (sprintId) {
        if (!sprintGroups.has(sprintId)) {
          sprintGroups.set(sprintId, { sprintId, rows: [] });
        }
        sprintGroups.get(sprintId)!.rows.push(story);
      } else {
        // Sprint name not found → treat as backlog (safer than auto-creating with unknown dates)
        backlogRows.push(story);
      }
    }

    // Upsert backlog stories (teamId set, sprintId null)
    if (backlogRows.length > 0) {
      await this.prisma.userStory.createMany({
        data: backlogRows.map((s, i) => ({
          title: s.title.trim(),
          storyPoints: s.storyPoints,
          status: s.status,
          category: s.category ?? 'user_story',
          priority: s.priority ?? i,
          teamId,
          sprintId: null,
          assigneeId: (s.assigneeName
            ? (devsByName.get(s.assigneeName.toLowerCase()) ?? null)
            : null) as string | null,
        })),
      });
    }

    // Insert sprint-assigned stories (replace existing for each sprint)
    for (const { sprintId, rows } of sprintGroups.values()) {
      await this.prisma.userStory.deleteMany({ where: { sprintId } });
      await this.prisma.userStory.createMany({
        data: rows.map((s, i) => ({
          title: s.title.trim(),
          storyPoints: s.storyPoints,
          status: s.status,
          category: s.category ?? 'user_story',
          priority: s.priority ?? i,
          teamId,
          sprintId,
          assigneeId: (s.assigneeName
            ? (devsByName.get(s.assigneeName.toLowerCase()) ?? null)
            : null) as string | null,
        })),
      });
    }
  }
}
