import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ImportSprint {
  name: string;
  status: 'planned' | 'active' | 'completed';
  startDate: string;
  endDate: string;
}

export interface ImportDeveloper {
  name: string;
  externalId: string;
}

export interface ImportTicket {
  externalKey: string;
  title: string;
  status: string;
  priority: number;
  storyPoints: number;
  category: string;
  sprintName: string | null;
  assigneeExternalId: string | null;
  labels: string[];
}

export interface JiraImportPayload {
  sprints: ImportSprint[];
  developers: ImportDeveloper[];
  tickets: ImportTicket[];
}

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importJira(teamId: string, payload: JiraImportPayload) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    const { sprints, developers, tickets } = payload;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create sprints
      const sprintMap = new Map<string, string>(); // lowercased name → id
      for (const sprint of sprints) {
        const created = await tx.sprint.create({
          data: {
            name: sprint.name,
            status: sprint.status,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            teamId,
            capacity: 0,
            plannedPoints: 0,
          },
        });
        sprintMap.set(sprint.name.toLowerCase(), created.id);
      }

      // 2. Create developers (skip duplicates by name within team)
      const devMap = new Map<string, string>(); // externalId → prisma id
      for (const dev of developers) {
        const existing = await tx.developer.findFirst({
          where: { teamId, name: dev.name },
        });
        if (existing) {
          devMap.set(dev.externalId, existing.id);
        } else {
          const created = await tx.developer.create({
            data: { name: dev.name, teamId, role: 'developer', storyPointsPerSprint: 10 },
          });
          devMap.set(dev.externalId, created.id);
        }
      }

      // 3. Create tickets
      const ticketData = tickets.map((ticket, i) => {
        const sprintId = ticket.sprintName
          ? (sprintMap.get(ticket.sprintName.toLowerCase()) ?? null)
          : null;
        const assigneeId = ticket.assigneeExternalId
          ? (devMap.get(ticket.assigneeExternalId) ?? null)
          : null;

        return {
          title: ticket.title,
          status: ticket.status,
          priority: i,
          storyPoints: ticket.storyPoints,
          category: ticket.category,
          sprintId,
          teamId,
          assigneeId,
        };
      });

      await tx.userStory.createMany({ data: ticketData });

      // Update plannedPoints for each sprint
      for (const [, sprintId] of sprintMap) {
        const total = ticketData
          .filter((t) => t.sprintId === sprintId)
          .reduce((sum, t) => sum + t.storyPoints, 0);
        if (total > 0) {
          await tx.sprint.update({ where: { id: sprintId }, data: { plannedPoints: total } });
        }
      }

      return {
        sprints: sprintMap.size,
        developers: devMap.size,
        tickets: ticketData.length,
      };
    });
  }
}
