import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { calcSprintCapacity } from '../lib/utils';

function csvEscape(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
  ) {}

  async findAll(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        sprints: {
          orderBy: { startDate: 'asc' },
          include: { userStories: { select: { status: true, storyPoints: true } } },
        },
      },
    });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);
    return team.sprints;
  }

  async findOne(teamId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: { include: { developers: { orderBy: { name: 'asc' } } } },
        userStories: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!sprint || sprint.teamId !== teamId) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }
    return sprint;
  }

  async create(teamId: string, data: { name: string; startDate: string; endDate: string }) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { developers: { include: { daysOff: true } } },
    });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    const capacity = calcSprintCapacity(
      team.developers,
      team.sprintDuration,
      data.startDate,
      data.endDate,
    );

    return this.prisma.sprint.create({
      data: { ...data, capacity, teamId, status: 'planned' },
    });
  }

  async update(
    teamId: string,
    sprintId: string,
    data: { name?: string; startDate?: string; endDate?: string; status?: string },
  ) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.teamId !== teamId) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }

    const updateData: Record<string, unknown> = { ...data };

    if (data.startDate || data.endDate) {
      const newStart = data.startDate ?? sprint.startDate;
      const newEnd = data.endDate ?? sprint.endDate;
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        include: { developers: { include: { daysOff: true } } },
      });
      if (team) {
        updateData.capacity = calcSprintCapacity(
          team.developers,
          team.sprintDuration,
          newStart,
          newEnd,
        );
      }
    }

    return this.prisma.sprint.update({ where: { id: sprintId }, data: updateData });
  }

  async exportCsv(teamId: string, sprintId: string): Promise<{ csv: string; filename: string }> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        userStories: { orderBy: { createdAt: 'asc' } },
        team: { include: { developers: true } },
      },
    });
    if (!sprint || sprint.teamId !== teamId) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }

    const devMap = new Map(sprint.team.developers.map((d: { id: string; name: string }) => [d.id, d.name]));
    const header = ['ID', 'Title', 'Story Points', 'Status', 'Assignee'];
    const rows = sprint.userStories.map((s: { id: string; title: string; storyPoints: number; status: string; assigneeId: string | null }) => [
      s.id,
      s.title,
      s.storyPoints,
      s.status,
      s.assigneeId ? (devMap.get(s.assigneeId) ?? '') : '',
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const filename = `${sprint.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
    return { csv, filename };
  }
}
