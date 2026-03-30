import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Ensures the authenticated user can only access their assigned team.
 * Admins bypass this check and can access all teams.
 * Public routes are skipped entirely.
 */
@Injectable()
export class TeamAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for @Public() routes (no session required)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any)['user'] as { role: string; assignedTeamId?: string | null } | undefined;

    // No user means SessionGuard already rejected — let that 401 bubble
    if (!user) return true;

    // Admins can access any team
    if (user.role === 'admin') return true;

    const teamId = req.params?.['teamId'];
    if (!teamId) return true; // not a team-scoped route

    if (user.assignedTeamId !== teamId) {
      throw new ForbiddenException('Access denied to this team');
    }
    return true;
  }
}
