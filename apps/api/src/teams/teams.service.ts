import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcSprintCapacity } from '../lib/utils';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.team.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { developers: true, sprints: true } },
        sprints: { where: { status: 'active' }, take: 1 },
      },
    });
  }

  async findOne(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        developers: { orderBy: { name: 'asc' }, include: { daysOff: true } },
        sprints: {
          orderBy: { startDate: 'desc' },
          include: { userStories: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);
    return team;
  }

  async create(data: { name: string; sprintDuration: number }) {
    return this.prisma.team.create({ data });
  }

  async update(teamId: string, data: { name?: string; sprintDuration?: number }) {
    await this.prisma.team.update({ where: { id: teamId }, data });
    if (data.sprintDuration !== undefined) {
      await this.syncSprintDates(teamId, data.sprintDuration);
    }
    await this.syncSprintCapacities(teamId);
  }

  async syncSprintDates(teamId: string, durationWeeks: number) {
    const DAY_MS = 86_400_000;
    const durationMs = durationWeeks * 7 * DAY_MS;

    const sprints = await this.prisma.sprint.findMany({
      where: { teamId, status: { in: ['active', 'planned'] } },
      orderBy: { startDate: 'asc' },
    });
    if (sprints.length === 0) return;

    const activeSprint = sprints.find((s) => s.status === 'active');
    const plannedSprints = sprints
      .filter((s) => s.status === 'planned')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    let lastEnd: Date | null = null;

    // Active sprint: keep startDate, extend endDate
    if (activeSprint) {
      const start = new Date(activeSprint.startDate);
      const end = new Date(start.getTime() + durationMs - DAY_MS);
      await this.prisma.sprint.update({
        where: { id: activeSprint.id },
        data: { endDate: end.toISOString().slice(0, 10) },
      });
      lastEnd = end;
    }

    // Planned sprints: chain sequentially after previous sprint
    for (const sprint of plannedSprints) {
      const start = lastEnd
        ? new Date(lastEnd.getTime() + DAY_MS)
        : new Date(sprint.startDate);
      const end = new Date(start.getTime() + durationMs - DAY_MS);
      await this.prisma.sprint.update({
        where: { id: sprint.id },
        data: {
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
        },
      });
      lastEnd = end;
    }
  }

  async updateCategoryAllocations(teamId: string, allocations: Record<string, number>) {
    await this.prisma.team.update({ where: { id: teamId }, data: { categoryAllocations: allocations } });
  }

  async syncTechLeadAllocation(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { developers: true },
    });
    if (!team) return;

    const totalCapacity = team.developers.reduce((sum, d) => sum + d.storyPointsPerSprint, 0);
    const techLead = team.developers.find((d) => d.role === 'tech_lead') ?? null;
    const current = (team.categoryAllocations as Record<string, number>) ?? {};

    const techLeadPct = techLead && totalCapacity > 0
      ? Math.round((techLead.storyPointsPerSprint / totalCapacity) * 100)
      : 0;

    const othersTotal = (current.bug ?? 0) + (current.mco ?? 0) + (current.best_effort ?? 0) + techLeadPct;
    const userStoryPct = Math.max(0, 100 - othersTotal);

    await this.prisma.team.update({
      where: { id: teamId },
      data: { categoryAllocations: { ...current, tech_lead: techLeadPct, user_story: userStoryPct } },
    });
  }

  async remove(teamId: string) {
    await this.prisma.team.delete({ where: { id: teamId } });
  }

  async syncSprintCapacities(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { developers: { include: { daysOff: true } } },
    });
    if (!team) return;

    const sprints = await this.prisma.sprint.findMany({ where: { teamId } });
    for (const sprint of sprints) {
      const capacity = calcSprintCapacity(team.developers, team.sprintDuration, sprint.startDate, sprint.endDate);
      await this.prisma.sprint.update({ where: { id: sprint.id }, data: { capacity } });
    }
  }
}
