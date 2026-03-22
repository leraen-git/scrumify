import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  IsString, IsNotEmpty, IsInt, Min, IsOptional, IsArray, ValidateNested, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StoriesService } from './stories.service';

class CreateStoryDto {
  @IsString() @IsNotEmpty() title: string;
  @IsInt() @Min(1) storyPoints: number;
  @IsOptional() @IsString() assigneeId?: string | null;
  @IsOptional() @IsString() category?: string;
}

class UpdateStoryDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsInt() @Min(1) storyPoints?: number;
  @IsOptional() @IsString() assigneeId?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() category?: string;
}

class ImportStoryDto {
  @IsString() @IsNotEmpty() title: string;
  @IsNumber() @Min(1) storyPoints: number;
  @IsString() status: string;
  @IsString() @IsNotEmpty() category: string;
  @IsOptional() @IsString() assigneeName?: string;
}

class ImportStoriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStoryDto)
  stories: ImportStoryDto[];
}

@Controller('teams/:teamId/sprints/:sprintId/stories')
export class StoriesController {
  constructor(private readonly service: StoriesService) {}

  @Get()
  findAll(@Param('teamId') teamId: string, @Param('sprintId') sprintId: string) {
    return this.service.findAll(teamId, sprintId);
  }

  @Post()
  create(
    @Param('teamId') teamId: string,
    @Param('sprintId') sprintId: string,
    @Body() dto: CreateStoryDto,
  ) {
    return this.service.create(teamId, sprintId, dto);
  }

  @Post('import')
  @HttpCode(HttpStatus.NO_CONTENT)
  importStories(
    @Param('teamId') teamId: string,
    @Param('sprintId') sprintId: string,
    @Body() dto: ImportStoriesDto,
  ) {
    return this.service.importStories(teamId, sprintId, dto.stories);
  }

  @Patch(':storyId')
  update(
    @Param('teamId') teamId: string,
    @Param('sprintId') sprintId: string,
    @Param('storyId') storyId: string,
    @Body() dto: UpdateStoryDto,
  ) {
    return this.service.update(teamId, sprintId, storyId, dto);
  }

  @Delete(':storyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('teamId') teamId: string,
    @Param('sprintId') sprintId: string,
    @Param('storyId') storyId: string,
  ) {
    return this.service.remove(teamId, sprintId, storyId);
  }
}
