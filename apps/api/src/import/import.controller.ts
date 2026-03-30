import { Controller, Post, Param, Body } from '@nestjs/common';
import { IsString, IsArray, IsOptional, IsNumber, IsIn, ValidateNested, MaxLength, Min, Max, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ImportService, JiraImportPayload, ImportSprint, ImportDeveloper, ImportTicket } from './import.service';

class ImportSprintDto implements ImportSprint {
  @IsString() @MaxLength(200) name: string;
  @IsIn(['planned', 'active', 'completed']) status: 'planned' | 'active' | 'completed';
  @IsString() startDate: string;
  @IsString() endDate: string;
}

class ImportDeveloperDto implements ImportDeveloper {
  @IsString() @MaxLength(200) name: string;
  @IsString() @MaxLength(500) externalId: string;
}

class ImportTicketDto implements ImportTicket {
  @IsString() @MaxLength(50) externalKey: string;
  @IsString() @MaxLength(500) title: string;
  @IsIn(['todo', 'in_progress', 'dev_done', 'done']) status: string;
  @IsNumber() @Min(0) @Max(9999) priority: number;
  @IsNumber() @Min(0) @Max(200) storyPoints: number;
  @IsIn(['user_story', 'bug', 'mco', 'best_effort', 'tech_lead']) category: string;
  @IsOptional() @IsString() sprintName: string | null;
  @IsOptional() @IsString() assigneeExternalId: string | null;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) labels: string[];
}

class JiraImportDto implements JiraImportPayload {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ImportSprintDto) sprints: ImportSprintDto[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ImportDeveloperDto) developers: ImportDeveloperDto[];
  @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => ImportTicketDto) tickets: ImportTicketDto[];
}

@Controller('teams/:teamId/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('jira')
  importJira(@Param('teamId') teamId: string, @Body() dto: JiraImportDto) {
    return this.importService.importJira(teamId, dto);
  }
}
