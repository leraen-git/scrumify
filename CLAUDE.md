# ARGO — Claude Code context

A.R.G.O — Agile Reporting & Goal Observer. Scrum team management app.

---

## New machine setup

### 1. Clone & install
```bash
git clone git@github.com:leraen-git/scrumify.git scrum-app
cd scrum-app
npm install
```

### 2. Local HTTPS certs (required — dev runs HTTPS)
```bash
brew install mkcert
mkcert -install
cd apps/api && mkdir certs && cd certs
mkcert localhost
# produces: localhost.pem + localhost-key.pem
```

### 3. Environment variables

**`apps/api/.env`**
```
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/scrumify?sslmode=no-verify
PORT=3001
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_API_URL=https://localhost:3001
NEXT_PUBLIC_APP_URL=https://localhost:3000
API_INTERNAL_URL=https://localhost:3001
NODE_EXTRA_CA_CERTS=/Users/<YOU>/Library/Application Support/mkcert/rootCA.pem
```

### 4. Database
```bash
docker compose up -d          # start Postgres
npm run db:migrate             # run Prisma migrations
npm run db:generate            # generate Prisma client
```

### 5. Start dev
```bash
npm run dev                    # both API + web in parallel
# or separately:
cd apps/api && npm run start:dev    # NestJS → https://localhost:3001
cd apps/web && npm run dev          # Next.js → https://localhost:3000
```

---

## Stack

- **Frontend:** Next.js 16.2.1 + React 19 + Tailwind CSS 4 + Recharts 3 + Radix UI
- **Backend:** NestJS + Prisma ORM + PostgreSQL
- **Auth:** Cookie-based (argon2 hash + accessToken for link login)
- **Monorepo:** npm workspaces (`apps/api`, `apps/web`)
- **Export:** pptxgenjs ^4 + html2canvas ^1.4.1 (in `apps/web/package.json`)

---

## Deployment

- Frontend (Vercel, project: `argo-web`): https://argo-web.vercel.app
- API (Railway, root dir: `apps/api`):
  - Build: `npx prisma generate && npm run build`
  - Start: `node dist/main`
- Vercel env vars: `NEXT_PUBLIC_API_URL=/api/proxy`, `API_INTERNAL_URL=<Railway URL>`, `NEXT_PUBLIC_APP_URL=https://argo-web.vercel.app`, `ANTHROPIC_API_KEY`
- All API calls go through Next.js rewrite proxy `/api/proxy/...` → Railway (cross-domain cookie fix)

---

## Architecture rules

- All `apiFetch` calls use `cache: 'no-store'` — never trust Next.js cache
- Cookie: `sameSite: 'lax'` (NOT strict — strict breaks through Vercel→Railway proxy)
- `next.config.ts` has `turbopack: {}` — required for Next.js 16, no webpack fallback needed
- After `npm install --workspace=apps/web <pkg>`: always commit `apps/web/package.json` before pushing to Vercel

---

## Features & key files

### Export (PPT + PNG)
- `apps/web/components/sprint-export-modal.tsx` — export modal, visible to all users
- Formats: PowerPoint (pptxgenjs, dynamic import) + PNG (html2canvas, dynamic import)
- **Critical pattern:** modal closes BEFORE html2canvas runs, then waits 2 `requestAnimationFrame` cycles — the `bg-black/40` backdrop was blocking DOM capture
- PPT charts = html2canvas screenshots of real DOM elements → `addImage` (NOT pptxgenjs chart API — it looks nothing like Recharts)
- PNG = captures real `[data-export-section]` elements, stitches vertically, downloads via `toBlob`

### data-export-section / data-export-chart attributes
Sprint detail page (`apps/web/app/teams/[teamId]/sprints/[sprintId]/page.tsx`):
- `data-export-section="summary"` → stats grid
- `data-export-section="charts"` → SprintCategoryChart wrapper
- `data-export-section="categories"` → category breakdown table
- `data-export-section="times"` → avg transition times panel
- `data-export-section="stories"` → kanban div

Dashboard page (`apps/web/app/teams/[teamId]/page.tsx`):
- `data-export-section="summary"` → Project Overview div
- `data-export-section="charts"` → velocity + donut charts flex div
- `data-export-chart="bug-env"` → on `bug-environment-chart.tsx` root div

### Charts
- `apps/web/components/forecast-chart.tsx` — velocity forecast, Recharts, sliding window (7 desktop / 5 mobile), centered on active sprint
- `apps/web/components/bug-environment-chart.tsx` — bugs by env bar chart, on dashboard, conditional on bug tickets existing
- `apps/web/components/sprint-category-chart.tsx` — SP done vs total grouped bar per category, on sprint detail page

### Category filter on kanban
- `apps/web/components/kanban-category-filter.tsx` — multi-select pills, `?categories=bug,mco` URL params
- Used on both sprint detail page and dashboard active sprint

### Status workflow
- Flow: `todo → in_progress → dev_done → done`
- Back-transition: `dev_done → in_progress` ("← Back to Dev", admin only)
- `statusHistory` JSON column: `{from, to, at}[]` per transition
- `accumulateStatusMs` accumulates all stints in a status (handles back-and-forth)

### Avg completion (dashboard)
- Denominator: `plannedPoints > 0 ? plannedPoints : capacity > 0 ? capacity : totalSP`
- No `Math.min(1, ...)` cap — allows >100% to show
- File: `apps/web/app/teams/[teamId]/page.tsx`

### Avg dev/test time
- Computed at render from `statusHistory`, not stored in DB
- `calcAvgStatusDuration` + `accumulateStatusMs` in dashboard page
- Fallback for imported tickets: if no `to: status` entry, use first exit as start

### Jira CSV import
- `apps/web/lib/csvImportService.ts` — PapaParse parser
- Category priority: Category > Type > Issue Type > Labels
- `normalizeCategory` → user_story / bug / mco / best_effort / tech_lead
- `apps/api/src/import/import.service.ts` — transactional import

### Days-off calendar
- `apps/web/components/days-off-calendar.tsx`
- French public holidays via `easterSunday(year)` (Anonymous Gregorian algorithm)
- Weekends: `bg-gray-100`, non-clickable

### Forecast chart
- Overflow sprints named `Sprint N - forecast`
- Overflow capacity uses `calcSprintCapacity` (real dev capacity, not average)
- Delivery = `avgTeamVelocityPerDay × sprintWorkingDays`, capped at capacity
- `apps/api/src/forecast/forecast.service.ts`

### Security
- `@Throttle` on login (10/min), register (5/min), access (10/min)
- `AdminGuard` on admin routes
- Input validation: `@IsIn`, `@IsDateString`, `@Max`, Zod on all mutations
- CSV export: strips `=`, `+`, `-`, `@` prefix (formula injection protection)

### RGPD positioning (for client questions)
- Art.32: hébergement maîtrisé, accès cloisonné par équipe
- Art.44: Railway Europe = données ne quittent pas l'UE (vs Jira Cloud US)
- Module IA rétrospective: désactivé par défaut; envoie seulement métriques agrégées (pas de titres ni noms)

---

## Key files reference

| File | Purpose |
|------|---------|
| `apps/web/next.config.ts` | Proxy rewrite + `turbopack: {}` |
| `apps/web/lib/api.ts` | `apiFetch` with `cache: 'no-store'` |
| `apps/web/lib/utils.ts` | `sprintWeeks`, `countWorkingDays`, `formatDate` |
| `apps/web/lib/csvImportService.ts` | Jira CSV parser |
| `apps/web/components/nav.tsx` | Header "A.R.G.O" + subtitle |
| `apps/web/components/forecast-chart.tsx` | Forecast bar chart |
| `apps/web/components/kanban-category-filter.tsx` | Category filter pills |
| `apps/web/components/bug-environment-chart.tsx` | Bugs by env chart |
| `apps/web/components/sprint-category-chart.tsx` | SP by category chart |
| `apps/web/components/sprint-export-modal.tsx` | Export PPT + PNG |
| `apps/web/components/days-off-calendar.tsx` | Days-off + French holidays |
| `apps/web/app/teams/[teamId]/page.tsx` | Dashboard |
| `apps/web/app/teams/[teamId]/sprints/[sprintId]/page.tsx` | Sprint detail |
| `apps/api/src/teams/teams.service.ts` | `syncSprintDates` |
| `apps/api/src/forecast/forecast.service.ts` | Forecast logic |
| `apps/api/src/import/import.service.ts` | Jira import transaction |
| `apps/api/src/admin/admin.service.ts` | User CRUD |
| `tasks/docs/user-manual.html` | User manual |
| `tasks/docs/admin-manual.html` | Admin manual |
