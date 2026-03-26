# Lessons Learned

This file captures patterns from corrections and mistakes to prevent recurrence.
Updated after every correction during development.

---

## Prisma / Next.js

### Stale Prisma client after schema change
After any `prisma migrate dev` or `prisma generate`:
1. Run `rm -rf .next`
2. Kill all existing dev servers: `kill $(pgrep -f "next dev")`
3. Restart: `npm run dev`
**Why:** Turbopack caches old Prisma bundles. New fields cause `PrismaClientValidationError` until cache is cleared.

### Duplicate dev server processes
Always check for existing `next dev` processes before starting a new one.
Two concurrent servers cause HMR conflicts → "missing required error components, refreshing..." in browser.
Check: `ps aux | grep "next dev"`

### notFound() in route handlers
`notFound()` is for page components only. In route handlers, return `new Response("Not found", { status: 404 })`.

### RouteContext typed helper
`RouteContext<"/path/[param]">` requires running `next typegen` first. Use plain `{ params: Promise<{ ... }> }` instead to avoid type errors.

---

## React / Next.js Patterns

### scroll={false} on Link for inline edit
When using URL search params to toggle inline edit state (e.g. `?editStory=id`), add `scroll={false}` to the Link to prevent scrolling to the top of the page.

### Server actions + "use server" in page files
Inline server actions in page files work, but imports inside them must use dynamic `await import(...)` to avoid bundling issues with server-only modules.

### space-y-* does not work on inline elements
`space-y-*` only creates vertical gaps between block-level children. `<Link>` renders as `<a>` (inline) — add `className="block"` to the Link for spacing to take effect.

### Conditional early return hides cards when data is empty
Returning `null` from an IIFE when a list is empty means the card disappears entirely. Instead, always render the card and show a placeholder (`<p className="text-xs text-gray-400 italic">No data yet.</p>`). Only use `null` if the entire section is truly irrelevant.

### onChange / onBlur timing with React state closures
When using `onBlur={handleSave}` after `onChange` updates state, `handleSave` closes over the *old* state value — the re-render from `onChange` hasn't happened yet. Fix: use a `ref` that is updated synchronously inside the state setter:
```ts
setValues(prev => {
  const next = { ...prev, [key]: v };
  valuesRef.current = next; // always latest
  return next;
});
```
Then `handleSave` reads from `valuesRef.current`.

---

## NestJS / Node.js

### process.cwd() vs __dirname in NestJS watch mode
`process.cwd()` in NestJS `start:dev` resolves to the `apps/api/` directory, not the monorepo root.
`__dirname` in compiled output (`dist/src/`) also differs from the source location.
**Rule**: For paths relative to the `apps/api` package, use `resolve(process.cwd(), '../relative/path')`.
For paths relative to the monorepo root, use `resolve(process.cwd(), '../../relative/path')` or pass an env var.

---

## Next.js Proxy / Auth

### RSC requests and prefetch don't carry cookies in VS Code's browser
In VS Code's embedded Simple Browser, RSC navigation requests and prefetch requests are sent **without cookies**. If the proxy does auth checks on these, it redirects to login, poisoning the Next.js router cache. Subsequent real navigations then follow the cached redirect.

**Fix**: Check for RSC/prefetch headers in the proxy function and skip auth for those request types. Only enforce cookie-based auth for full-page loads:
```ts
const isRSC = req.headers.has("rsc") || req.headers.has("next-router-prefetch");
if (isRSC) return NextResponse.next();
```
**Why**: This lets full-page loads (which DO carry cookies) be protected, while RSC requests are handled by page-level server components that validate sessions via API calls.

### Server action redirects are RSC navigations
When a server action calls `redirect("/")`, the client performs an RSC-style client-side navigation — not a browser 302 redirect. If the proxy matcher excludes RSC requests (via matcher `missing` config), the post-login redirect to `/admin` never fires.
**Rule**: Use the function-body `if (isRSC) return NextResponse.next()` pattern — not the matcher `missing` config — so server action redirects still pass through the proxy for root-path handling.

---

## Workflow

### Plan mode skipped for multi-step tasks
Several multi-step features (category allocation, status history, HTTPS) were implemented without writing a plan to `tasks/todo.md` first. This led to mid-implementation surprises and path bugs.
**Rule**: Any task with 3+ steps → write plan to `tasks/todo.md`, check in with user, THEN implement.

### appsec.md not consulted before security-sensitive code
HTTPS setup and DB credential changes were done without referencing `tasks/appsec.md`.
**Rule**: Before writing any API, auth, or infrastructure code, open `tasks/appsec.md` and verify compliance.

---

## Prisma / Schema

### prisma db push for dev drift
When `prisma migrate dev` fails with "Drift detected" (schema was modified outside migration history), use `prisma db push` to sync the dev database directly.
**Rule**: In development, `prisma db push` is safe for fast iteration. In production, always use `prisma migrate deploy` (never `db push`).

### Nullable FK fields need the relation model updated too
When adding a nullable FK (`teamId String?`) to a model, the _other_ side of the relation (Team) also needs a reverse relation field (`userStories UserStory[]`). Missing it causes Prisma schema validation errors.

---

## NestJS

### Two controllers in one file — both must be exported and registered
When a single controller file exports two `@Controller` classes (e.g. `StoriesController` + `BacklogController`), both must be:
1. Named exports from the file
2. Listed in the module's `controllers: []` array
Forgetting either silently drops the routes.

### Split controller prefix when routes have different base paths
If two route groups share the same service but different URL prefixes (e.g. `/teams/:teamId/sprints/:sprintId/stories` vs `/teams/:teamId/backlog`), split into two `@Controller` classes rather than one. Using a shared prefix forces awkward method-level path repetition.

---

## TypeScript / Next.js

### Two functions with the same name at different scopes — shadowing bug
When a module-level function and a component-level function share the same name, the inner one silently shadows the outer one. TypeScript does NOT warn about this. Both compile fine but callers inside the component always get the inner version.
**Rule**: Give module-level utility functions distinct names from local component helpers. If one takes `ms` and the other takes `hours`, name them `formatElapsed` vs `formatDuration` — never the same name.

### Status names must match the Prisma schema exactly
The real statuses in `UserStory` are `todo`, `in_progress`, `dev_done`, `done`. Using a label like `"testing"` (a UI label, not the DB value) in status history lookups silently returns `null` — no error, no data.
**Rule**: Always use the DB enum value (from schema) in status history computations, not the display label. Double-check with `schema.prisma` when unsure.



### Keep fetch interfaces complete — add fields as you use them
When a page fetches API data, the TypeScript interface only declares fields the original author needed. Adding new features often requires fields the API already returns (e.g. `developer.name`, `userStory.assigneeId`) but aren't in the interface yet.
**Rule**: Before computing new derived data from fetched objects, check the local interface and add any missing fields. TypeScript will silently cast the runtime value even if the field isn't in the interface — you won't get a type error, but you also won't get type safety.

---

## Architecture

### Forecast efficiency: use historical delivered/capacity ratio, not raw SP average
Raw average SP delivered per sprint is misleading if sprint capacity varies (holidays, team size changes). The correct efficiency metric is `mean(delivered / capacity)` across completed sprints. This ratio stays stable across capacity changes and gives more accurate forecasts when multiplied by each future sprint's capacity.

### Backlog stories need teamId for team-scoped queries
Stories with `sprintId = null` have no team context via the sprint relation. Without `teamId` on `UserStory`, it's impossible to query "all backlog stories for team X". Always set `teamId` when creating backlog stories. Sprint-assigned stories should also have `teamId` set for consistency.
