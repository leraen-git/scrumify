import {
  Controller, Get, Post, Patch, Param, Body, Res,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Response } from 'express';
import { SprintsService } from './sprints.service';

class CreateSprintDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsString() @IsNotEmpty() startDate: string;
  @IsString() @IsNotEmpty() endDate: string;
}

class UpdateSprintDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() status?: string;
}

@Controller('teams/:teamId/sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get()
  findAll(@Param('teamId') teamId: string) {
    return this.sprints.findAll(teamId);
  }

  @Post()
  create(@Param('teamId') teamId: string, @Body() dto: CreateSprintDto) {
    return this.sprints.create(teamId, dto);
  }

  @Get(':sprintId')
  findOne(@Param('teamId') teamId: string, @Param('sprintId') sprintId: string) {
    return this.sprints.findOne(teamId, sprintId);
  }

  @Patch(':sprintId')
  update(
    @Param('teamId') teamId: string,
    @Param('sprintId') sprintId: string,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprints.update(teamId, sprintId, dto);
  }

  @Get(':sprintId/export')
  async exportCsv(
    @Param('teamId') teamId: string,
    @Param('sprintId') sprintId: string,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.sprints.exportCsv(teamId, sprintId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const encoded = encodeURIComponent(filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`);
    res.send(csv);
  }
}
