import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';

export const SESSION_COOKIE = 'scrumify_session';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (!sessionId) throw new UnauthorizedException('Not authenticated');

    const user = await this.authService.validateSession(sessionId);
    if (!user) throw new UnauthorizedException('Session expired');

    (req as any)['user'] = user;
    return true;
  }
}
