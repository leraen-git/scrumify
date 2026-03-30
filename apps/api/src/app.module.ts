import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { TeamsModule } from './teams/teams.module';
import { DevelopersModule } from './developers/developers.module';
import { SprintsModule } from './sprints/sprints.module';
import { StoriesModule } from './stories/stories.module';
import { ForecastModule } from './forecast/forecast.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ImportModule } from './import/import.module';
import { SessionGuard } from './auth/session.guard';
import { TeamAccessGuard } from './auth/team-access.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    AdminModule,
    TeamsModule,
    DevelopersModule,
    SprintsModule,
    StoriesModule,
    ForecastModule,
    ImportModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: TeamAccessGuard },
  ],
})
export class AppModule {}
