import { Controller, Get, Param } from '@nestjs/common';
import { ForecastService } from './forecast.service';

@Controller('teams/:teamId/forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get()
  getForecast(@Param('teamId') teamId: string) {
    return this.forecastService.getForecast(teamId);
  }
}
