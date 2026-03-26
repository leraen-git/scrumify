import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsString, IsInt, IsNotEmpty, Min, Max, IsOptional } from 'class-validator';
import { TeamsService } from './teams.service';

class CreateTeamDto {
  @IsString() @IsNotEmpty() name: string;
  @IsInt() @Min(1) @Max(4) sprintDuration: number;
}

class UpdateTeamDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(4) sprintDuration?: number;
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  findAll() {
    return this.teams.findAll();
  }

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  @Get(':teamId')
  findOne(@Param('teamId') teamId: string) {
    return this.teams.findOne(teamId);
  }

  @Patch(':teamId')
  update(@Param('teamId') teamId: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(teamId, dto);
  }

  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('teamId') teamId: string) {
    return this.teams.remove(teamId);
  }

  @Patch(':teamId/category-allocations')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateCategoryAllocations(
    @Param('teamId') teamId: string,
    @Body('allocations') allocations: Record<string, number>,
  ) {
    return this.teams.updateCategoryAllocations(teamId, allocations);
  }
}
