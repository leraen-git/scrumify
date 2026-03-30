import {
  Controller, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, MaxLength, IsDateString } from 'class-validator';
import { DevelopersService } from './developers.service';

class CreateDeveloperDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(100) role?: string;
  @IsInt() @Min(1) @Max(200) storyPointsPerSprint: number;
}

class UpdateDeveloperDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) role?: string;
  @IsOptional() @IsInt() @Min(1) @Max(200) storyPointsPerSprint?: number;
}

class ToggleDayOffDto {
  @IsDateString() date: string;
}

@Controller('teams/:teamId/developers')
export class DevelopersController {
  constructor(private readonly devs: DevelopersService) {}

  @Post()
  create(@Param('teamId') teamId: string, @Body() dto: CreateDeveloperDto) {
    return this.devs.create(teamId, dto);
  }

  @Patch(':devId')
  update(
    @Param('teamId') teamId: string,
    @Param('devId') devId: string,
    @Body() dto: UpdateDeveloperDto,
  ) {
    return this.devs.update(teamId, devId, dto);
  }

  @Delete(':devId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('teamId') teamId: string, @Param('devId') devId: string) {
    return this.devs.remove(teamId, devId);
  }

  @Post(':devId/days-off')
  @HttpCode(HttpStatus.NO_CONTENT)
  toggleDayOff(
    @Param('teamId') teamId: string,
    @Param('devId') devId: string,
    @Body() dto: ToggleDayOffDto,
  ) {
    return this.devs.toggleDayOff(teamId, devId, dto.date);
  }
}
