import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const userCount = await this.prisma.user.count();
    const role = userCount === 0 ? 'admin' : 'user';

    const user = await this.prisma.user.create({
      data: { email, passwordHash, role },
    });

    return { session: await this.createSession(user.id), user };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { session: await this.createSession(user.id), user };
  }

  async loginWithToken(accessToken: string) {
    const user = await this.prisma.user.findUnique({ where: { accessToken } });
    if (!user) throw new UnauthorizedException('Invalid access link');

    return { session: await this.createSession(user.id), user };
  }

  async logout(sessionId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async validateSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      if (session) await this.prisma.session.delete({ where: { id: sessionId } });
      return null;
    }
    return session.user;
  }

  private async createSession(userId: string) {
    return this.prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
  }
}
