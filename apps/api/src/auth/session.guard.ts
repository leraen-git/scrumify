import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

export const SESSION_COOKIE = 'argo_session';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (!sessionId) throw new UnauthorizedException('Not authenticated');

    const user = await this.authService.validateSession(sessionId);
    if (!user) throw new UnauthorizedException('Session expired');

    (req as any)['user'] = user;
    return true;
  }
}
