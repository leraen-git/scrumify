import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

/**
 * Ensures the authenticated user can only access their assigned team.
 * Admins bypass this check and can access all teams.
 */
@Injectable()
export class TeamAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any)['user'] as { role: string; assignedTeamId?: string | null } | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (user.role === 'admin') return true;

    const teamId = req.params?.['teamId'];
    if (!teamId) return true; // no teamId param — not a team-scoped route

    if (user.assignedTeamId !== teamId) {
      throw new ForbiddenException('Access denied to this team');
    }
    return true;
  }
}
