import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  findAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accessToken: true,
        assignedTeamId: true,
        assignedTeam: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async createUser(data: { name: string; teamId: string }) {
    const team = await this.prisma.team.findUnique({ where: { id: data.teamId } });
    if (!team) throw new NotFoundException(`Team ${data.teamId} not found`);

    const accessToken = randomUUID();
    return this.prisma.user.create({
      data: {
        name: data.name,
        role: 'user',
        accessToken,
        assignedTeamId: data.teamId,
      },
      select: {
        id: true,
        name: true,
        role: true,
        accessToken: true,
        assignedTeamId: true,
        assignedTeam: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async updateUser(userId: string, data: { name?: string; teamId?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.role === 'admin') throw new ForbiddenException('Cannot modify admin users');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.teamId !== undefined ? { assignedTeamId: data.teamId } : {}),
      },
      select: {
        id: true,
        name: true,
        role: true,
        accessToken: true,
        assignedTeamId: true,
        assignedTeam: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.role === 'admin') throw new ForbiddenException('Cannot delete admin users');
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async regenerateToken(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.role === 'admin') throw new ForbiddenException('Admin users do not use access tokens');

    const accessToken = randomUUID();
    return this.prisma.user.update({
      where: { id: userId },
      data: { accessToken },
      select: { id: true, accessToken: true },
    });
  }
}
