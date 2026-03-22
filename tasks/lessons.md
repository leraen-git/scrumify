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
