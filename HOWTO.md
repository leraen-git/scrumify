# Scrumify — How to Run and Use the App

This guide explains how to install, start, and use Scrumify.
No technical background required — just follow the steps in order.

---

## What is Scrumify?

Scrumify is a project management tool for software teams that use the Scrum method.
It lets you:
- Create and manage teams with developers and sprint capacity
- Plan and run sprints on a 4-column Kanban board
- Track how long each story spends in development and testing
- Move unfinished stories to a future sprint and track carryover
- See velocity charts, a project forecast, and estimation accuracy
- Give team members a read-only access link (no login required)
- Import your backlog from a CSV or Excel file

---

## Part 1 — Install the required tools (one-time setup)

### Step 1 — Install Node.js

1. Go to https://nodejs.org
2. Click **LTS** (the recommended version)
3. Open the downloaded file and follow the installer
4. Verify in **Terminal**:
   ```
   node --version
   ```
   You should see something like `v20.x.x`. Any number above 18 is fine.

---

### Step 2 — Install Homebrew (Mac only)

1. Open **Terminal**
2. Paste and press Enter:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. When it finishes, verify:
   ```
   brew --version
   ```

---

### Step 3 — Install PostgreSQL (the database)

1. In **Terminal**:
   ```
   brew install postgresql@17
   brew services start postgresql@17
   /usr/local/opt/postgresql@17/bin/createdb scrumify
   /usr/local/opt/postgresql@17/bin/psql -d scrumify -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';"
   ```
   The last command should print `CREATE ROLE`.

---

### Step 4 — Download the project

```
cd ~/Desktop
git clone https://github.com/leraen-git/scrumify.git scrum-app
cd scrum-app
```

---

### Step 5 — Install dependencies

Inside the `scrum-app` folder:
```
npm install
```

---

### Step 6 — Set up the database tables

```
cd apps/api && npx prisma db push && cd ../..
```

You should see: `Your database is now in sync with your Prisma schema.`

---

### Step 7 — Create your admin account

```
cd apps/api && npx ts-node -e "
const {PrismaClient} = require('./generated/prisma');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
prisma.user.create({data:{email:'admin@scrumify.com',passwordHash:bcrypt.hashSync('changeme',10),role:'admin'}}).then(()=>console.log('Admin created')).finally(()=>prisma.\$disconnect());
" && cd ../..
```

This creates an admin account with email `admin@scrumify.com` and password `changeme`.
Change the password after your first login.

---

## Part 2 — Start the app

### Step 1 — Make sure the database is running

```
brew services start postgresql@17
```

### Step 2 — Start the servers

```
cd ~/Desktop/scrum-app
npm run dev
```

Wait about 10 seconds. You'll see:
```
[1] ✓ Ready in 855ms
[0] API running on https://localhost:3001
```

Leave this Terminal window open — closing it stops the app.

### Step 3 — Open the app

Go to: **https://localhost:3000**

Your browser may warn about the certificate — click "Advanced" → "Proceed anyway". This is normal for local development.

---

## Part 3 — Using the app

### Admin login

The first page is the login screen. Enter your admin email and password.

After logging in you land on the **Admin panel** (`/admin`), which has two sections:
- **Teams** — create, rename, or delete teams; click the external link icon to open a team's dashboard
- **Users** — create user accounts, assign them to a team, generate an access link

---

### Creating a team

1. In the Admin panel, go to **Teams**
2. Click **New Team**
3. Enter a name and sprint duration (weeks)
4. Click **Create**

---

### Creating user access links

Each team member can get a personal access link — no password needed.

1. In the Admin panel, go to **Users**
2. Click **New User**, enter a name, select a team
3. Click **Create**
4. Click the **copy** icon next to the user to copy their access link
5. Share the link with the team member

When someone opens the link, they land directly on their team's dashboard with read-only access — they can see the board and project stats but cannot edit anything.

---

### Adding developers to a team

1. Open a team (click the external link icon in the Admin panel, or navigate from the top)
2. Click the **Team** tab
3. Scroll to **Add Developer** and enter their name and story-point capacity per sprint
4. Click **Add**

---

### Logging days off

1. Go to the **Team** tab
2. Find the absence calendar
3. Click once on a date cell for a developer → **half day off** (shown as ½)
4. Click again → **full day off** (shown as ✕)
5. Click a third time → clears it

The sprint capacity calculation adjusts automatically when days off overlap with sprint dates.

---

### Category allocation

Teams can set target percentages per category of work:

1. Go to the **Team** tab → **Category Allocation** section
2. Enter a percentage for each category:
   - User Story (Business)
   - Bug (Defect)
   - MCO
   - Best-effort
   - Tech Lead
3. The total must equal 100% — the Save button is disabled otherwise
4. Click **Save**

You can also assign a custom colour to each category. These colours appear on the sprint board and the donut chart.

---

### Creating a sprint

1. Click the **Sprints** tab → **New Sprint**
2. The app pre-fills the name and dates based on your sprint duration
3. Review the **Estimated Capacity** section — adjusted for developer days off
4. Click **Create Sprint**

---

### The sprint board

Each sprint has a 4-column Kanban board:

| Column | Meaning |
|---|---|
| **To Do** | Not started yet |
| **In Progress** | Developer is working on it |
| **Dev Done / Testing** | Development complete, in QA |
| **Done** | Fully complete |

**Moving a story forward:** Click the → button on the story card to move it to the next column.

**Timer badges:** Stories in *In Progress* (amber) and *Dev Done* (purple) show how long they've been in that status — e.g. `⏱ 3h`. Done stories show the total dev and test time — e.g. `dev 4h` / `test 2h`.

**SP history:** If a story's points were changed, the SP number turns red. Hover over it to see the history.

**Category:** Each card shows its category. Admins can change it with the inline dropdown.

---

### Adding a story to a sprint

1. Open a sprint board
2. Scroll to **Add User Story** at the bottom
3. Enter the title, select story points, category, and assignee
4. Click **Add**

---

### Moving a story to a future sprint (carryover)

When a non-done story won't be finished in the current sprint, an admin can move it to a planned sprint:

1. Find the story card (not in the Done column)
2. Click the **↩ move** dropdown on the card
3. Select the target sprint

The story disappears from the current sprint and appears in the selected sprint with a **↩ Sprint Name** badge showing where it came from. If a story has been moved multiple times, the badge shows **↩ ×2** (or more).

The active sprint header shows an amber **↩ N carried over** badge when any stories were moved into it.

---

### Importing stories from a file

**Sprint import** — replaces all stories in a sprint:
1. Open a sprint board → **Import CSV / Excel**
2. Upload your file, map columns, preview, and click **Import**

**Backlog import** — adds stories to the backlog (used for forecasting):
1. Go to the **Velocity** tab → **Backlog Import**
2. Upload a CSV/Excel file
3. Use a **Sprint** column to assign stories to specific sprints; leave it blank to add to the backlog
4. Use a **Priority** column to set ordering

---

### Project Forecast

The forecast appears on:
- The **Dashboard** tab, inside the Project Overview section
- The **Velocity** tab

It shows past, active, and future sprints as grouped bars:
- **Indigo** — past sprints (planned vs delivered)
- **Amber highlight** — active sprint
- **Gray/light indigo** — future sprints (capacity vs forecast delivery)

The forecast is calculated from your average efficiency (delivered ÷ capacity) across completed sprints. Backlog stories fill future sprint slots until they run out.

---

### Velocity tab

The Velocity tab shows:

- **Velocity chart** — SP planned vs delivered per sprint, with avg velocity/day
- **Category donut** — proportion of SP per category across sprints
- **Project Forecast** chart
- **Backlog Import** card
- **Estimation Accuracy** scatter plot — each dot is a completed story; X = story points, Y = actual hours (dev + test). The dashed line is the average hours/SP ratio. Helps you see whether high-point stories actually take more time.
- **Developer Contributions** — per developer: SP done in the active sprint and average SP per completed sprint
- **AI Retro Assistant** — suggests retrospective actions based on the last 3 completed sprints
- **Sprint history table** — capacity, planned, delivered, **carryover SP** (amber if > 0), and efficiency %

---

### Dashboard overview (Project Overview)

The top of the Dashboard tab shows 5 stat cards visible to all users:
- Total Sprints
- Avg Velocity (SP)
- Avg Dev Time
- Avg Test Time
- Avg Completion %

Below the cards is the **Project Forecast** chart.

---

### What team members see (access link)

Users who access via their personal link see:
- The **Dashboard** tab only (other tabs are hidden)
- The Project Overview stats and forecast
- The active sprint Kanban board in read-only mode — no edit, delete, or status-transition controls
- No Select Team dropdown in the navigation

---

## Part 4 — Accessing the database directly

### Option A — Prisma Studio (simplest)

```
cd ~/Desktop/scrum-app/apps/api && npx prisma studio
```

Opens at `http://localhost:5555`. Browse and edit all tables.

### Option B — TablePlus

1. Download from https://tableplus.com
2. New connection → PostgreSQL
3. Host: `localhost`, Port: `5432`, Database: `scrumify`, User: `postgres`, Password: `postgres`
4. Click **Test** then **Connect**

---

## Part 5 — Stopping the app

1. Press `Ctrl + C` in the Terminal running `npm run dev`

To also stop the database:
```
brew services stop postgresql@17
```

---

## Troubleshooting

**Browser shows a certificate warning**
→ Click "Advanced" → "Proceed anyway". This is expected for local HTTPS in development.

**The app redirects to /login but login fails**
→ Make sure you created the admin account in Step 7 of Part 1.

**"Cannot connect" or blank page**
→ Make sure `npm run dev` is running and you see both "Ready" messages.

**"Relation does not exist" error**
→ Run: `cd apps/api && npx prisma db push`

**"Connection refused" on port 5432**
→ Start the database: `brew services start postgresql@17`

**Port 3000 or 3001 already in use**
→ Restart your computer, or find and stop the conflicting process.

---

## Quick reference

| What | Command / URL |
|---|---|
| Start database | `brew services start postgresql@17` |
| Start app | `npm run dev` (inside `scrum-app/`) |
| Open app | https://localhost:3000 |
| Admin panel | https://localhost:3000/admin |
| Database browser | `cd apps/api && npx prisma studio` |
| Stop app | `Ctrl + C` in dev terminal |
| Stop database | `brew services stop postgresql@17` |
