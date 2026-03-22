# Scrumify — How to Run the App

This guide explains how to install, start, and use Scrumify on your computer.
No technical background required — just follow the steps in order.

---

## What is Scrumify?

Scrumify is a project management tool for software teams that use the Scrum method.
It lets you:
- Create and manage teams
- Plan sprints (short work cycles, usually 2 weeks)
- Track user stories (tasks) on a Kanban board
- Log developer days off so the app can estimate how much work your team can handle
- See velocity charts showing how much your team delivered over time

---

## Part 1 — Install the required tools (one-time setup)

### Step 1 — Install Node.js

Node.js is the engine that runs the app.

1. Go to https://nodejs.org
2. Click the button labeled **LTS** (the recommended version)
3. Open the downloaded file and follow the installer
4. When done, open **Terminal** (on Mac: press `Cmd + Space`, type `Terminal`, press Enter)
5. Type the following and press Enter to verify it worked:
   ```
   node --version
   ```
   You should see something like `v20.x.x`. Any number above 18 is fine.

---

### Step 2 — Install Homebrew (Mac only)

Homebrew is a tool that makes it easy to install software on a Mac.

1. Open **Terminal**
2. Paste the following line and press Enter:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. Follow any instructions it shows on screen (it may ask for your Mac password)
4. When it finishes, verify it worked:
   ```
   brew --version
   ```
   You should see something like `Homebrew 4.x.x`

---

### Step 3 — Install PostgreSQL (the database)

PostgreSQL stores all your teams, sprints, and stories.

1. In **Terminal**, run:
   ```
   brew install postgresql@17
   ```
2. When it finishes, start the database:
   ```
   brew services start postgresql@17
   ```
3. Create the app's database:
   ```
   /usr/local/opt/postgresql@17/bin/createdb scrumify
   ```
4. Create the database user the app uses:
   ```
   /usr/local/opt/postgresql@17/bin/psql -d scrumify -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';"
   ```
   You should see: `CREATE ROLE`

---

### Step 4 — Download the project

1. Open **Terminal**
2. Navigate to where you want to put the project. For example, your Desktop:
   ```
   cd ~/Desktop
   ```
3. Download the project:
   ```
   git clone <your-repo-url> scrum-app
   ```
   Replace `<your-repo-url>` with the actual URL of the repository.
4. Go into the project folder:
   ```
   cd scrum-app
   ```

---

### Step 5 — Install the app's dependencies

Still in **Terminal** (inside the `scrum-app` folder), run:

```
npm install
```

This downloads all the code libraries the app needs. It may take a minute or two.

---

### Step 6 — Set up the database tables

Run the following command to create all the tables the app needs:

```
cd apps/api && npx prisma migrate dev --name init && cd ../..
```

You should see:
```
✔ Generated Prisma Client
Your database is now in sync with your schema.
```

---

## Part 2 — Start the app

Every time you want to use the app, follow these steps.

### Step 1 — Make sure the database is running

Open **Terminal** and run:

```
brew services start postgresql@17
```

If it was already running, you'll see: `Service postgresql@17 already started`

---

### Step 2 — Start the app servers

In **Terminal**, go to the project folder and run:

```
cd ~/Desktop/scrum-app
npm run dev
```

Wait about 10 seconds. You'll see output like:

```
[1] ✓ Ready in 855ms
[0] API running on http://localhost:3001
```

Both lines must appear before the app is ready. Leave this Terminal window open — closing it stops the app.

---

### Step 3 — Open the app in your browser

Open any web browser (Chrome, Firefox, Safari, etc.) and go to:

```
http://localhost:3000
```

You should see the Scrumify home page.

---

## Part 3 — Using the app

### Creating your first team

1. Click **New Team** on the home page
2. Enter a team name (e.g. "Backend Team")
3. Choose a sprint duration (how many weeks each sprint lasts — 2 is standard)
4. Click **Create Team**

---

### Adding developers to a team

1. Click on your team
2. Click the **Team** tab
3. Scroll down to the **Add Developer** section
4. Enter the developer's name and their story point capacity per sprint
   (story points = how much work they can do in one sprint — 10 is a good default)
5. Click **Add**

---

### Logging days off

When a developer will be absent during a sprint, log it in the calendar:

1. Go to the **Team** tab
2. Find the calendar at the top
3. Click once on a date cell for a developer → marks a **half day off** (shown as ½)
4. Click again → marks a **full day off** (shown as ✕)
5. Click a third time → clears the day off

The app will automatically adjust that sprint's capacity when days off overlap with sprint dates.

---

### Creating a sprint

1. Click the **Sprints** tab
2. Click **New Sprint**
3. The app pre-fills the name, start date, and end date based on your sprint duration
4. Review the **Estimated Capacity** section — it shows how many story points your team can handle, adjusted for any days off
5. Click **Create Sprint**

---

### Adding user stories to a sprint

1. Click on a sprint to open the sprint board
2. Scroll down to **Add User Story**
3. Enter the story title, select story points, optionally assign a developer
4. Click **Add**

The story appears in the **To Do** column.

---

### Moving stories across the board

Each story card has an arrow button (→) to move it to the next column:
- **To Do → In Progress** (when work starts)
- **In Progress → Done** (when work is complete)

---

### Importing stories from a spreadsheet

If you have stories in a CSV or Excel file:

1. Open a sprint
2. Click **Import CSV / Excel**
3. Upload your file
4. Map the columns (the app tries to detect them automatically)
5. Preview the import and click **Import**

> ⚠️ Importing replaces all existing stories in that sprint.

---

### Exporting stories to CSV

1. Open a sprint
2. Click **Export CSV**
3. The file downloads automatically

---

### Tracking velocity

1. Click the **Velocity** tab
2. You'll see a table of all completed sprints with:
   - Capacity (how much the team could do)
   - Planned (how many points were in the sprint)
   - Delivered (how many points were marked Done)
   - Efficiency (delivered ÷ capacity, as a percentage)

---

## Part 4 — Accessing the database directly

You can browse the database using a free tool called **TablePlus** or the built-in **Prisma Studio**.

### Option A — Prisma Studio (simplest)

1. Open a new **Terminal** window
2. Run:
   ```
   cd ~/Desktop/scrum-app/apps/api && npx prisma studio
   ```
3. Your browser opens at `http://localhost:5555`
4. You can browse all tables, view records, and even edit data directly

---

### Option B — TablePlus (recommended for regular use)

1. Download **TablePlus** from https://tableplus.com (free tier is sufficient)
2. Open TablePlus and click **Create a new connection**
3. Choose **PostgreSQL**
4. Fill in:
   - **Name:** Scrumify (anything you like)
   - **Host:** `localhost`
   - **Port:** `5432`
   - **Database:** `scrumify`
   - **User:** `postgres`
   - **Password:** `postgres`
5. Click **Test** — it should show a green checkmark
6. Click **Connect**

You'll see all the tables:
- **Team** — your teams
- **Developer** — team members
- **DayOff** — logged absences
- **Sprint** — your sprints
- **UserStory** — tasks / user stories
- **SprintAssignment** — capacity assignments
- **SprintRetrospective** — retrospective notes

---

## Part 5 — Stopping the app

1. Go to the **Terminal** window where `npm run dev` is running
2. Press `Ctrl + C` to stop both servers

The database keeps running in the background. Your data is saved and will be there next time you start the app.

To also stop the database (optional):

```
brew services stop postgresql@17
```

---

## Troubleshooting

**The browser shows a blank page or "cannot connect"**
→ Make sure you ran `npm run dev` and saw both "Ready" messages. Wait a few more seconds and refresh.

**Error: "relation does not exist"**
→ The database tables weren't created. Run:
```
cd ~/Desktop/scrum-app/apps/api && npx prisma migrate dev --name init
```

**Error: "connection refused" on port 5432**
→ The database isn't running. Start it:
```
brew services start postgresql@17
```

**Port 3000 or 3001 already in use**
→ Another process is using that port. Restart your computer or find and stop the conflicting process.

**The app was working before but now shows errors**
→ Stop everything with `Ctrl+C`, then restart with `npm run dev`.

---

## Quick reference card

| What | Command | Where to run it |
|---|---|---|
| Start the database | `brew services start postgresql@17` | Terminal |
| Start the app | `npm run dev` | Terminal, inside `scrum-app/` folder |
| Open the app | Go to http://localhost:3000 | Browser |
| Open database browser | `cd apps/api && npx prisma studio` | Terminal |
| Stop the app | `Ctrl + C` | Terminal where dev is running |
| Stop the database | `brew services stop postgresql@17` | Terminal |
