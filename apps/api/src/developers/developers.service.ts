import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';

@Injectable()
export class DevelopersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
  ) {}

  async create(teamId: string, data: { name: string; role?: string; storyPointsPerSprint: number }) {
    await this.prisma.developer.create({ data: { ...data, teamId } });
    await this.teams.syncSprintCapacities(teamId);
    await this.teams.syncTechLeadAllocation(teamId);
  }

  async update(teamId: string, devId: string, data: { name?: string; role?: string; storyPointsPerSprint?: number }) {
    const dev = await this.prisma.developer.findUnique({ where: { id: devId } });
    if (!dev || dev.teamId !== teamId) throw new NotFoundException(`Developer ${devId} not found`);
    await this.prisma.developer.update({ where: { id: devId }, data });
    await this.teams.syncSprintCapacities(teamId);
    await this.teams.syncTechLeadAllocation(teamId);
  }

  async remove(teamId: string, devId: string) {
    const dev = await this.prisma.developer.findUnique({ where: { id: devId } });
    if (!dev || dev.teamId !== teamId) throw new NotFoundException(`Developer ${devId} not found`);
    await this.prisma.developer.delete({ where: { id: devId } });
    await this.teams.syncSprintCapacities(teamId);
  }

  async toggleDayOff(teamId: string, devId: string, date: string) {
    const dev = await this.prisma.developer.findUnique({ where: { id: devId } });
    if (!dev || dev.teamId !== teamId) throw new NotFoundException(`Developer ${devId} not found`);

    const existing = await this.prisma.dayOff.findFirst({ where: { developerId: devId, date } });
    if (!existing) {
      await this.prisma.dayOff.create({ data: { developerId: devId, date, type: 'half' } });
    } else if (existing.type === 'half') {
      await this.prisma.dayOff.update({ where: { id: existing.id }, data: { type: 'full' } });
    } else {
      await this.prisma.dayOff.delete({ where: { id: existing.id } });
    }

    await this.teams.syncSprintCapacities(teamId);
  }
}
