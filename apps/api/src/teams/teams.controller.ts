import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { IsString, IsInt, IsNotEmpty, Min, Max, IsOptional, MaxLength, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TeamsService } from './teams.service';
import { AdminGuard } from '../auth/admin.guard';

class CreateTeamDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsInt() @Min(1) @Max(4) sprintDuration: number;
}

class UpdateTeamDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(4) sprintDuration?: number;
}

class CategoryAllocationsDto {
  @IsNumber() @Min(0) @Max(100) user_story?: number;
  @IsNumber() @Min(0) @Max(100) bug?: number;
  @IsNumber() @Min(0) @Max(100) mco?: number;
  @IsNumber() @Min(0) @Max(100) best_effort?: number;
  @IsNumber() @Min(0) @Max(100) tech_lead?: number;
  @IsOptional() @IsString() @MaxLength(20) user_story_color?: string;
  @IsOptional() @IsString() @MaxLength(20) bug_color?: string;
  @IsOptional() @IsString() @MaxLength(20) mco_color?: string;
  @IsOptional() @IsString() @MaxLength(20) best_effort_color?: string;
  @IsOptional() @IsString() @MaxLength(20) tech_lead_color?: string;
}

class UpdateCategoryAllocationsDto {
  @ValidateNested()
  @Type(() => CategoryAllocationsDto)
  allocations: CategoryAllocationsDto;
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.teams.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('teamId') teamId: string) {
    return this.teams.remove(teamId);
  }

  @Patch(':teamId/category-allocations')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateCategoryAllocations(
    @Param('teamId') teamId: string,
    @Body() dto: UpdateCategoryAllocationsDto,
  ) {
    return this.teams.updateCategoryAllocations(teamId, dto.allocations as Record<string, number>);
  }
}
