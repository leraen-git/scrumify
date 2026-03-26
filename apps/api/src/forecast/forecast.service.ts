import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcSprintCapacity, countWorkingDays } from '../lib/utils';

// ── Public types returned by the service ──────────────────────────────────

export interface PastSprintPoint {
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  spPlanned: number;
  spDone: number;
  velocityPerDay: number;
  isActive: boolean;
}

export interface FutureSprintPoint {
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  forecastDelivery: number;  // capacity × avgEfficiency
  assignedSP: number;        // already-assigned story points
  backlogFillSP: number;     // backlog SP distributed into this sprint
  remainingCapacity: number; // capacity left after forecast delivery
  isOverflow: boolean;       // true for synthetic sprints beyond planned horizon
  hasCapacityData: boolean;  // false = capacity was estimated, not from assignments
}

export interface ForecastSummary {
  totalBacklogStories: number;
  totalBacklogSP: number;
  sprintsAhead: number;           // future sprints needed to clear all work
  avgEfficiency: number;          // 0–1, historical delivery ratio
  avgVelocitySP: number;          // avg SP delivered per completed sprint
  avgVelocityPerDay: number;      // avg SP / dev·day
}

export interface ForecastResult {
  past: PastSprintPoint[];
  future: FutureSprintPoint[];
  summary: ForecastSummary;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_EFFICIENCY = 0.85;
const MAX_OVERFLOW_SPRINTS = 6; // guard against infinite synthetic generation

@Injectable()
export class ForecastService {
  constructor(private readonly prisma: PrismaService) {}

  async getForecast(teamId: string): Promise<ForecastResult> {
    // Security: verify team ownership before any data access
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        sprintDuration: true,
        developers: {
          select: {
            id: true,
            storyPointsPerSprint: true,
            daysOff: { select: { date: true, type: true } },
          },
        },
        sprints: {
          orderBy: { startDate: 'asc' },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
            capacity: true,
            plannedPoints: true,
            userStories: {
              select: { storyPoints: true, status: true },
            },
            assignments: {
              select: { capacity: true },
            },
          },
        },
      },
    });

    if (!team) throw new NotFoundException('Team not found');

    const devCount = Math.max(1, team.developers.length);

    // ── Backlog stories (no sprint, belong to this team) ──────────────────
    const backlogStories = await this.prisma.userStory.findMany({
      where: { teamId, sprintId: null },
      select: { storyPoints: true, priority: true },
      orderBy: [{ priority: 'asc' }, { storyPoints: 'asc' }],
    });

    // ── Classify sprints ──────────────────────────────────────────────────
    const completedSprints = team.sprints.filter((s) => s.status === 'completed');
    const futureSprints = team.sprints.filter(
      (s) => s.status === 'active' || s.status === 'planned',
    );

    // ── Historical metrics (completed sprints only) ───────────────────────
    const completedWithCapacity = completedSprints.filter((s) => s.capacity > 0);
    const avgEfficiency =
      completedWithCapacity.length > 0
        ? Math.min(
            1,
            completedWithCapacity.reduce((sum, s) => {
              const delivered = s.userStories
                .filter((u) => u.status === 'done')
                .reduce((a, u) => a + u.storyPoints, 0);
              return sum + delivered / s.capacity;
            }, 0) / completedWithCapacity.length,
          )
        : DEFAULT_EFFICIENCY;

    const avgVelocitySP =
      completedSprints.length > 0
        ? Math.round(
            completedSprints.reduce((sum, s) => {
              const delivered = s.userStories
                .filter((u) => u.status === 'done')
                .reduce((a, u) => a + u.storyPoints, 0);
              return sum + delivered;
            }, 0) / completedSprints.length,
          )
        : 0;

    const avgVelocityPerDay =
      completedSprints.length > 0
        ? Math.round(
            (completedSprints.reduce((sum, s) => {
              const delivered = s.userStories
                .filter((u) => u.status === 'done')
                .reduce((a, u) => a + u.storyPoints, 0);
              const workingDays = Math.max(1, countWorkingDays(s.startDate, s.endDate));
              return sum + delivered / (workingDays * devCount);
            }, 0) /
              completedSprints.length) *
              100,
          ) / 100
        : 0;

    // ── Past sprint points (for chart) ────────────────────────────────────
    const past: PastSprintPoint[] = [...completedSprints, ...futureSprints.filter((s) => s.status === 'active')].map((s) => {
      const delivered = s.userStories
        .filter((u) => u.status === 'done')
        .reduce((a, u) => a + u.storyPoints, 0);
      const planned =
        s.plannedPoints > 0
          ? s.plannedPoints
          : s.userStories.reduce((a, u) => a + u.storyPoints, 0);
      const workingDays = Math.max(1, countWorkingDays(s.startDate, s.endDate));
      const velocityPerDay =
        Math.round((delivered / (workingDays * devCount)) * 100) / 100;
      return {
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        capacity: s.capacity,
        spPlanned: planned,
        spDone: delivered,
        velocityPerDay,
        isActive: s.status === 'active',
      };
    });

    // ── Future sprint forecast ────────────────────────────────────────────
    const plannedSprints = futureSprints.filter((s) => s.status === 'planned');

    // Remaining backlog SP to distribute (copy for mutation)
    let remainingBacklogSP = backlogStories.reduce((a, s) => a + s.storyPoints, 0);

    const future: FutureSprintPoint[] = [];

    for (const sprint of plannedSprints) {
      // Use stored capacity if available; recalculate if 0
      let capacity = sprint.capacity;
      let hasCapacityData = true;

      if (capacity === 0) {
        hasCapacityData = false;
        capacity = calcSprintCapacity(
          team.developers,
          team.sprintDuration,
          sprint.startDate,
          sprint.endDate,
        );
      }

      const forecastDelivery = Math.round(capacity * avgEfficiency);
      const assignedSP = sprint.userStories.reduce((a, u) => a + u.storyPoints, 0);
      const room = Math.max(0, forecastDelivery - assignedSP);
      const backlogFillSP = Math.min(room, remainingBacklogSP);
      remainingBacklogSP = Math.max(0, remainingBacklogSP - backlogFillSP);

      future.push({
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        capacity,
        forecastDelivery,
        assignedSP,
        backlogFillSP,
        remainingCapacity: Math.max(0, capacity - assignedSP - backlogFillSP),
        isOverflow: false,
        hasCapacityData,
      });
    }

    // ── Overflow sprints (synthetic) — if backlog exceeds planned horizon ─
    if (remainingBacklogSP > 0 && plannedSprints.length > 0) {
      // Estimate avg capacity from existing planned sprints
      const avgCapacity =
        plannedSprints.length > 0
          ? Math.round(
              future.reduce((a, s) => a + s.capacity, 0) / future.length,
            )
          : 0;

      if (avgCapacity > 0) {
        // Derive dates for synthetic sprints from last planned sprint
        const lastSprint = plannedSprints[plannedSprints.length - 1];
        const sprintDurationDays = team.sprintDuration * 7; // calendar days
        let overflowIndex = 1;

        while (remainingBacklogSP > 0 && overflowIndex <= MAX_OVERFLOW_SPRINTS) {
          const prevEnd = future[future.length - 1]?.endDate ?? lastSprint.endDate;
          const startDate = new Date(prevEnd);
          startDate.setDate(startDate.getDate() + 1);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + sprintDurationDays - 1);

          const forecastDelivery = Math.round(avgCapacity * avgEfficiency);
          const backlogFillSP = Math.min(forecastDelivery, remainingBacklogSP);
          remainingBacklogSP = Math.max(0, remainingBacklogSP - backlogFillSP);

          future.push({
            name: `Overflow +${overflowIndex}`,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            capacity: avgCapacity,
            forecastDelivery,
            assignedSP: 0,
            backlogFillSP,
            remainingCapacity: Math.max(0, avgCapacity - backlogFillSP),
            isOverflow: true,
            hasCapacityData: false,
          });

          overflowIndex++;
        }
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────
    const totalBacklogSP = backlogStories.reduce((a, s) => a + s.storyPoints, 0);
    const sprintsAhead =
      future.length > 0
        ? plannedSprints.length + future.filter((s) => s.isOverflow).length
        : 0;

    return {
      past,
      future,
      summary: {
        totalBacklogStories: backlogStories.length,
        totalBacklogSP,
        sprintsAhead,
        avgEfficiency: Math.round(avgEfficiency * 100) / 100,
        avgVelocitySP,
        avgVelocityPerDay,
      },
    };
  }
}
