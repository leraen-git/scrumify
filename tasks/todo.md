# Feature: Full Backlog Import + Sprint Forecast

## Status: COMPLETE ✓

All items implemented and verified.

---

## Schema
- [x] Add `teamId String?` + `team Team?` relation to `UserStory` (nullable — backfill via migration)

## API
- [x] `ForecastModule` — service + controller
  - `GET /api/teams/:teamId/forecast`
  - Algorithm: avgEfficiency from completed sprints → per-sprint forecastDelivery → distribute backlog
  - Overflow sprints (up to 6) generated if backlog exceeds planned horizon
- [x] `POST /api/teams/:teamId/backlog/import` in BacklogController
  - Groups by sprintName → match existing sprint; blank = backlog (teamId set, sprintId null)

## Web
- [x] `ForecastChart` component — grouped bars (past indigo, active amber, future gray/light-indigo)
  - Active sprint: `ReferenceArea` amber highlight + "▶ Active sprint" label
  - Overflow sprints shown in amber
  - Tooltip shows planned/delivered (past) or capacity/forecast/breakdown (future)
- [x] Extend `stories-importer.tsx` — Sprint column detection + backlog import mode
- [x] `velocity/page.tsx` — ForecastChart + BacklogImporter card (shown even with 0 completed sprints)

## Security checklist
- [x] teamId ownership verified on all new endpoints
- [x] All DTOs validated (title MaxLength 500, SP Min 1, category enum, ArrayMaxSize 500)
- [x] Sprint name: trim + MaxLength(100), never in raw SQL

---

## Review

Feature complete. Key design decisions:
- Efficiency = mean(delivered/capacity) per completed sprint, fallback 0.85
- Capacity = 0 triggers recalculation via developers' SP rate × working days
- teamId added to UserStory to scope backlog stories per team
- Two NestJS controllers in stories module: StoriesController + BacklogController
