import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TeamsModule } from './teams/teams.module';
import { DevelopersModule } from './developers/developers.module';
import { SprintsModule } from './sprints/sprints.module';
import { StoriesModule } from './stories/stories.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TeamsModule,
    DevelopersModule,
    SprintsModule,
    StoriesModule,
  ],
})
export class AppModule {}
