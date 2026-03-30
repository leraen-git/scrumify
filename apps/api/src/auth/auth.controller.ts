import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Throttle } from '@nestjs/throttler';

import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard, SESSION_COOKIE } from './session.guard';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

export const CTX_COOKIE = 'argo_ctx';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
};

class LoginDto {
  @IsEmail() @MaxLength(255) email: string;
  @IsString() @MinLength(1) @MaxLength(128) password: string;
}

class RegisterDto {
  @IsEmail() @MaxLength(255) email: string;
  @IsString() @MinLength(8) @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;
}

class AccessDto {
  @IsString() @MaxLength(500) token: string;
}

function setAuthCookies(
  res: Response,
  sessionId: string,
  user: { role: string; assignedTeamId?: string | null },
) {
  res.cookie(SESSION_COOKIE, sessionId, COOKIE_OPTS);
  res.cookie(CTX_COOKIE, `${user.role}:${user.assignedTeamId ?? ''}`, COOKIE_OPTS);
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { session, user } = await this.authService.register(dto.email, dto.password);
    setAuthCookies(res, session.id, user);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { session, user } = await this.authService.login(dto.email, dto.password);
    setAuthCookies(res, session.id, user);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('access')
  @HttpCode(HttpStatus.OK)
  async access(@Body() dto: AccessDto, @Res({ passthrough: true }) res: Response) {
    const { session, user } = await this.authService.loginWithToken(dto.token);
    setAuthCookies(res, session.id, user);
    return { assignedTeamId: user.assignedTeamId };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (sessionId) await this.authService.logout(sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.clearCookie(CTX_COOKIE, { path: '/' });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  refresh(
    @CurrentUser() user: { id: string; role: string; assignedTeamId: string | null },
    @Res({ passthrough: true }) res: Response,
  ) {
    res.cookie(CTX_COOKIE, `${user.role}:${user.assignedTeamId ?? ''}`, COOKIE_OPTS);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: { id: string; email: string | null; name: string | null; role: string; assignedTeamId: string | null }) {
    return { id: user.id, email: user.email, name: user.name, role: user.role, assignedTeamId: user.assignedTeamId };
  }
}
