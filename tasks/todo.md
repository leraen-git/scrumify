# Current App State & Backlog

Last updated: 2026-03-26

---

## What's built

### Core
- [x] Teams CRUD (create, edit, delete)
- [x] Sprints (create, manage, sprint board)
- [x] Developers per team
- [x] Stories / backlog
- [x] Velocity tab
- [x] Category allocation (settings + sprint board + velocity)

### Auth system (API)
- [x] `POST /api/auth/register` — first user becomes admin
- [x] `POST /api/auth/login` — email + password
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me`
- [x] `POST /api/auth/access` — token-based login (regular users)
- [x] `POST /api/auth/refresh` — re-issues ctx cookie
- [x] SessionGuard + CurrentUser decorator

### Admin page (`/admin`)
- [x] Team manager (create, edit sprint duration, delete)
- [x] User manager (create user, assign team, access link copy, delete, regenerate token)
- [x] Teams state shared between both sections (creating team updates user form instantly)
- [x] Admin icon in nav (Settings2 → /admin)

### Access link flow
- [x] `/access/[token]` page — calls POST /api/auth/access → redirects to team

---

## Known issues / gaps

### Auth guards disabled
- [ ] All controllers (teams, sprints, stories, developers, admin) have guards removed
- [ ] Anyone can call any API endpoint without being logged in
- **Fix needed**: Re-enable `SessionGuard` on controllers + scope data by user

### No route protection on frontend
- [ ] `/admin` is accessible without being logged in
- [ ] `/teams/*` is accessible without being logged in
- [ ] Root `page.tsx` redirects to first team blindly (no auth check)
- **Fix needed**: middleware.ts to protect routes, redirect unauthenticated users to /login

### `/access/[token]` hardcodes `https://localhost:3001`
- [ ] Should use `http://localhost:3001` (API is plain HTTP now)
- **Fix needed**: change to `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"`

### Login / register pages exist but untested
- [ ] `/login` and `/register` pages were scaffolded — need verification they work end-to-end

---

## Backlog (planned, not started)

### Category allocation plan
- See `.claude/plans/golden-jumping-horizon.md` for full spec
- Steps 1–5 cover: schema, API, team settings UI, sprint board breakdown, velocity breakdown
- Status: plan written, implementation not started

---

## Rules reminder
- Plan in this file before implementing anything 3+ steps
- Consult `tasks/appsec.md` before any auth/API/infra change
- Update `tasks/lessons.md` after every correction
