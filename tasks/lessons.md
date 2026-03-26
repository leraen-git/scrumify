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

## Workflow

### Plan mode skipped for multi-step tasks
Several multi-step features (category allocation, status history, HTTPS) were implemented without writing a plan to `tasks/todo.md` first. This led to mid-implementation surprises and path bugs.
**Rule**: Any task with 3+ steps → write plan to `tasks/todo.md`, check in with user, THEN implement.

### appsec.md not consulted before security-sensitive code
HTTPS setup and DB credential changes were done without referencing `tasks/appsec.md`.
**Rule**: Before writing any API, auth, or infrastructure code, open `tasks/appsec.md` and verify compliance.
