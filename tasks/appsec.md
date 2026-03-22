# Application Security Referential

Reference this file when generating code to ensure secure practices.

---

## Input Validation
- Always validate and sanitize user input at system boundaries (form data, API params)
- Use `String.trim()` on text inputs; parse numbers with `parseInt`/`parseFloat` and validate range
- Never trust `formData.get()` values without type checks

## SQL / ORM Injection
- Always use Prisma's parameterized queries — never interpolate user input into raw SQL
- Avoid `prisma.$queryRaw` with user-supplied values; use `prisma.$queryRaw` with tagged template literals only

## Server Actions
- Server actions are public endpoints — validate all inputs as if they came from an untrusted client
- Never expose internal IDs or sensitive data in client-side state without access checks
- Ensure `teamId` ownership is verified before mutating sprint/story data (user can only touch their own teams)

## XSS
- Never use `dangerouslySetInnerHTML` with user-supplied content
- React escapes JSX expressions by default — don't bypass this

## File Uploads (CSV/XLS import)
- Parse file content client-side with xlsx; never execute imported content
- Validate parsed values (title: string, storyPoints: positive integer, status: enum)
- Cap imported row count to prevent memory issues

## URL / Path Traversal
- Never use user-supplied strings directly in file system operations
- Sanitize filenames in export headers: `filename.replace(/[^a-z0-9]/gi, "_")`

## Secrets
- Never commit `.env` files or hardcode credentials
- Environment variables accessed via `process.env` on server only

## Auth (future)
- All communications must be encrypted (HTTPS/TLS — no plaintext transport)
- JSON only — no sensitive data in query strings (tokens, IDs, credentials)
- Sessions must be managed server-side (e.g. server-stored session with an opaque session ID in an HttpOnly cookie — no JWT in localStorage, no client-decodable session state)
- An interceptor (Next.js middleware) must validate every request before it reaches a handler: check session validity, ownership, and CSRF token
- Passwords must be hashed with Argon2 (argon2id variant, default memory/time params or higher)
- Data encryption at rest must use AES-256-GCM (authenticated encryption — provides both confidentiality and integrity)
- When auth is added: verify session ownership before any DB mutation
- Use middleware to protect all `/teams/[teamId]/*` routes
