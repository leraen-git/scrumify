# Getting Started — Scrumify Monorepo

## Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Docker Desktop** — [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)

---

## Step 1 — Install dependencies

From the repo root:

```bash
npm install
```

---

## Step 2 — Start the database

Make sure Docker Desktop is running, then:

```bash
npm run db:up
```

This starts:
- **PostgreSQL 17** on port `5432`
- **pgAdmin 4** on port `5050`

Wait ~5 seconds for PostgreSQL to be ready before the next step.

---

## Step 3 — Run database migrations

```bash
npm run db:migrate
```

This runs `prisma migrate dev` inside `apps/api/`, creating all tables in the `scrumify` database.

If prompted for a migration name, enter anything (e.g. `init`).

---

## Step 4 — Generate the Prisma client

```bash
npm run db:generate
```

> This is only needed on first setup or after schema changes. The generated client lands in `apps/api/generated/prisma/`.

---

## Step 5 — Start the dev servers

```bash
npm run dev
```

This starts both servers concurrently with hot reload:

| Service | URL |
|---|---|
| Next.js frontend | http://localhost:3000 |
| NestJS API | http://localhost:3001 |

---

## Step 6 — Open the app

Navigate to **http://localhost:3000** in your browser.

The root redirects you to your first team, or to the Teams page if none exist yet.

---

## Accessing the database with pgAdmin

1. Open **http://localhost:5050** in your browser
2. Log in with:
   - **Email:** `admin@scrumify.local`
   - **Password:** `admin`
3. In the left panel, right-click **Servers** → **Register** → **Server...**
4. Fill in the form:
   - **Name:** `Scrumify` (anything you like)
   - **Host:** `postgres` *(use `localhost` if connecting from outside Docker)*
   - **Port:** `5432`
   - **Database:** `scrumify`
   - **Username:** `postgres`
   - **Password:** `postgres`
5. Click **Save** — you'll see all tables under `scrumify > Schemas > public > Tables`

---

## Stopping everything

```bash
# Stop the dev servers
Ctrl+C

# Stop and remove the Docker containers (data is preserved in a volume)
npm run db:down

# Stop and also delete all data
docker compose down -v
```

---

## Environment variables

| File | Variable | Default |
|---|---|---|
| `apps/api/.env` | `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/scrumify` |
| `apps/api/.env` | `PORT` | `3001` |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:3001` |

---

## Useful commands

```bash
# Run only the API
npm run start:dev -w apps/api

# Run only the frontend
npm run dev -w apps/web

# Open Prisma Studio (visual DB browser, alternative to pgAdmin)
cd apps/api && npx prisma studio

# Reset the database (wipes all data)
cd apps/api && npx prisma migrate reset
```
