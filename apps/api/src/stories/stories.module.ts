import { Module } from '@nestjs/common';
import { BacklogController, StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  controllers: [StoriesController, BacklogController],
  providers: [StoriesService],
})
export class StoriesModule {}
