/**
 * A.R.G.O Demo — seed mock data + take business screenshots
 * Run: node tasks/demo/seed-and-screenshot.mjs
 */
import https from "https";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import puppeteer from "puppeteer-core";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "screenshots");
mkdirSync(OUT, { recursive: true });

const API = "https://localhost:3001";
const WEB = "https://localhost:3000";
const EMAIL = "ramy.abouelnay@gmail.com";
const PASSWORD = "Scrumify123!";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const agent = new https.Agent({ rejectUnauthorized: false });

async function apiCall(method, path, body, cookie = "") {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    // @ts-ignore
    dispatcher: undefined,
    agent,
  });
  const text = await res.text();
  if (!res.ok && res.status !== 409) {
    console.warn(`  ⚠  ${method} ${path} → ${res.status}: ${text.slice(0, 120)}`);
    return null;
  }
  return text ? JSON.parse(text) : null;
}

// node-fetch / native fetch doesn't honour the agent option for https in Node 20+
// Use a simple wrapper with http.request instead
function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: "localhost",
      port: 3001,
      path,
      method,
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.status || res.statusCode, headers: res.headers, text });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function api(method, path, body, cookie) {
  const { status, headers, text } = await request(method, path, body, cookie);
  if (status >= 400 && status !== 409) {
    console.warn(`  ⚠  ${method} ${path} → ${status}: ${text.slice(0, 160)}`);
    return null;
  }
  return text ? JSON.parse(text) : { _headers: headers };
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login() {
  console.log("🔐 Logging in…");
  const { status, headers } = await request("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
  if (status !== 200) throw new Error(`Login failed: ${status}`);
  const setCookie = headers["set-cookie"] ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  console.log("  ✓ Session acquired");
  return cookie;
}

// ─── Seed data ────────────────────────────────────────────────────────────────
async function seed(cookie) {
  // 1. Create (or reuse) team
  console.log("\n📋 Creating team…");
  let team = null;
  const teams = await api("GET", "/api/teams", null, cookie);
  if (teams) team = teams.find((t) => t.name === "Digital Banking Platform");
  if (!team) {
    team = await api("POST", "/api/teams", { name: "Digital Banking Platform", sprintDuration: 2 }, cookie);
  }
  if (!team) throw new Error("Could not create/find team");
  console.log(`  ✓ Team: ${team.name} (${team.id})`);
  const teamId = team.id;

  // 2. Add developers
  console.log("👥 Adding developers…");
  const devs = [
    { name: "Sophie", storyPointsPerSprint: 20 },
    { name: "Marcus", storyPointsPerSprint: 18 },
    { name: "Aiden",  storyPointsPerSprint: 22 },
    { name: "Priya",  storyPointsPerSprint: 20 },
  ];
  const existingDevs = await api("GET", `/api/teams/${teamId}/developers`, null, cookie) ?? [];
  for (const d of devs) {
    if (existingDevs.find((e) => e.name === d.name)) {
      console.log(`  · ${d.name} already exists`);
      continue;
    }
    await api("POST", `/api/teams/${teamId}/developers`, d, cookie);
    console.log(`  ✓ Added ${d.name}`);
  }

  // 3. Set category allocations
  console.log("🎨 Setting category allocations…");
  await api("PATCH", `/api/teams/${teamId}/category-allocations`, {
    allocations: { user_story: 55, bug: 15, mco: 15, best_effort: 10, tech_lead: 5 },
  }, cookie);

  // 4. Create sprints
  console.log("🗓  Creating sprints…");
  const sprintDefs = [
    { name: "Sprint 1", start: "2025-10-06", end: "2025-10-17", status: "completed", capacity: 76 },
    { name: "Sprint 2", start: "2025-10-20", end: "2025-10-31", status: "completed", capacity: 78 },
    { name: "Sprint 3", start: "2025-11-03", end: "2025-11-14", status: "completed", capacity: 74 },
    { name: "Sprint 4", start: "2025-11-17", end: "2025-11-28", status: "active",    capacity: 80 },
    { name: "Sprint 5", start: "2025-12-01", end: "2025-12-12", status: "planned",   capacity: 80 },
  ];

  const existingSprints = await api("GET", `/api/teams/${teamId}/sprints`, null, cookie) ?? [];
  const sprintMap = {};
  for (const def of sprintDefs) {
    let sp = existingSprints.find((s) => s.name === def.name);
    if (!sp) {
      sp = await api("POST", `/api/teams/${teamId}/sprints`, {
        name: def.name,
        startDate: def.start,
        endDate: def.end,
        capacity: def.capacity,
        plannedPoints: def.capacity,
      }, cookie);
      console.log(`  ✓ Created ${def.name}`);
    } else {
      console.log(`  · ${def.name} already exists`);
    }
    if (sp) sprintMap[def.name] = { ...sp, targetStatus: def.status };
  }

  // 5. Update sprint statuses
  for (const [name, sp] of Object.entries(sprintMap)) {
    if (sp.status !== sp.targetStatus) {
      await api("PATCH", `/api/teams/${teamId}/sprints/${sp.id}`, { status: sp.targetStatus }, cookie);
      console.log(`  ✓ ${name} → ${sp.targetStatus}`);
    }
  }

  // 6. Import stories from CSV
  console.log("\n📥 Importing stories from CSV…");
  const csv = readFileSync(join(__dirname, "mock-project.csv"), "utf8");
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");
  const titleIdx   = headers.findIndex((h) => /title/i.test(h));
  const spIdx      = headers.findIndex((h) => /point|sp/i.test(h));
  const catIdx     = headers.findIndex((h) => /category|type/i.test(h));
  const assignIdx  = headers.findIndex((h) => /assign/i.test(h));
  const sprintIdx  = headers.findIndex((h) => /sprint/i.test(h));
  const prioIdx    = headers.findIndex((h) => /priority/i.test(h));

  const catMap = {
    user_story: "user_story", bug: "bug", mco: "mco",
    best_effort: "best_effort", tech_lead: "tech_lead",
  };

  // Group by sprint for batch creation
  const bySprintByStory = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const title      = cols[titleIdx]?.trim();
    const storyPoints = parseInt(cols[spIdx]) || 3;
    const category   = catMap[cols[catIdx]?.trim()] ?? "user_story";
    const assigneeName = cols[assignIdx]?.trim();
    const sprintName = cols[sprintIdx]?.trim();
    const priority   = parseInt(cols[prioIdx]) || i;
    if (!title) continue;
    const key = sprintName || "__backlog__";
    if (!bySprintByStory[key]) bySprintByStory[key] = [];
    bySprintByStory[key].push({ title, storyPoints, category, assigneeName, priority });
  }

  for (const [sprintName, stories] of Object.entries(bySprintByStory)) {
    if (sprintName === "__backlog__") continue;
    const sp = Object.values(sprintMap).find((s) => s.name === sprintName);
    if (!sp) { console.warn(`  ⚠ Sprint not found: ${sprintName}`); continue; }

    // Check if stories already exist
    const existing = await api("GET", `/api/teams/${teamId}/sprints/${sp.id}`, null, cookie);
    if (existing?.userStories?.length > 0) {
      console.log(`  · ${sprintName}: already has stories — skipping`);
      continue;
    }

    for (const s of stories) {
      await api("POST", `/api/teams/${teamId}/sprints/${sp.id}/stories`, s, cookie);
    }
    console.log(`  ✓ ${sprintName}: ${stories.length} stories added`);
  }

  // 7. Mark stories in completed sprints as done (to show velocity)
  console.log("\n✅ Completing stories in past sprints…");
  const completedSprintNames = ["Sprint 1", "Sprint 2", "Sprint 3"];
  for (const name of completedSprintNames) {
    const sp = Object.values(sprintMap).find((s) => s.name === name);
    if (!sp) continue;
    const detail = await api("GET", `/api/teams/${teamId}/sprints/${sp.id}`, null, cookie);
    if (!detail?.userStories) continue;
    let doneCount = 0;
    for (const story of detail.userStories) {
      if (story.status === "done") { doneCount++; continue; }
      // Move through statuses with a small delay to simulate real timing
      await api("PATCH", `/api/teams/${teamId}/sprints/${sp.id}/stories/${story.id}`,
        { status: "in_progress" }, cookie);
      await api("PATCH", `/api/teams/${teamId}/sprints/${sp.id}/stories/${story.id}`,
        { status: "dev_done" }, cookie);
      await api("PATCH", `/api/teams/${teamId}/sprints/${sp.id}/stories/${story.id}`,
        { status: "done" }, cookie);
      doneCount++;
    }
    console.log(`  ✓ ${name}: ${doneCount} stories marked done`);
  }

  // 8. Move some Sprint 4 stories to in_progress / dev_done (partial active sprint)
  console.log("🏃 Advancing active sprint stories…");
  const sp4 = Object.values(sprintMap).find((s) => s.name === "Sprint 4");
  if (sp4) {
    const detail = await api("GET", `/api/teams/${teamId}/sprints/${sp4.id}`, null, cookie);
    if (detail?.userStories) {
      const stories = detail.userStories;
      for (let i = 0; i < Math.min(3, stories.length); i++) {
        if (stories[i].status !== "todo") continue;
        await api("PATCH", `/api/teams/${teamId}/sprints/${sp4.id}/stories/${stories[i].id}`,
          { status: "done" }, cookie);
      }
      for (let i = 3; i < Math.min(6, stories.length); i++) {
        if (stories[i].status !== "todo") continue;
        await api("PATCH", `/api/teams/${teamId}/sprints/${sp4.id}/stories/${stories[i].id}`,
          { status: "in_progress" }, cookie);
      }
      for (let i = 6; i < Math.min(8, stories.length); i++) {
        if (stories[i].status !== "todo") continue;
        await api("PATCH", `/api/teams/${teamId}/sprints/${sp4.id}/stories/${stories[i].id}`,
          { status: "dev_done" }, cookie);
      }
      console.log(`  ✓ Sprint 4 stories advanced`);
    }
  }

  console.log("\n✅ Seed complete!\n");
  return { teamId, sprintMap };
}

// ─── Screenshots ──────────────────────────────────────────────────────────────
async function takeScreenshots(teamId, sprintMap) {
  console.log("📸 Launching browser…");

  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    ignoreHTTPSErrors: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1600,900"],
    defaultViewport: { width: 1600, height: 900 },
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);

  // Login via the Next.js proxy so cookies are set on :3000
  console.log("  Logging in via web…");
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle2" });
  await page.type('input[name="email"]', EMAIL);
  await page.type('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('button[type="submit"]'),
  ]);
  console.log("  ✓ Logged in");

  const snap = async (name, url, waitFor, delay = 1500) => {
    console.log(`  📷 ${name}…`);
    await page.goto(url, { waitUntil: "networkidle2" });
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, delay));
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
    console.log(`     → screenshots/${name}.png`);
  };

  const sp4 = Object.values(sprintMap).find((s) => s.name === "Sprint 4");
  const sp1 = Object.values(sprintMap).find((s) => s.name === "Sprint 1");

  await snap("01-dashboard",   `${WEB}/teams/${teamId}`,           "h1", 2000);
  await snap("02-sprint-board",`${WEB}/teams/${teamId}/sprints/${sp4?.id}`, ".grid", 2000);
  await snap("03-velocity",    `${WEB}/teams/${teamId}/velocity`,  "table", 2500);
  await snap("04-team-tab",    `${WEB}/teams/${teamId}/team`,      "table", 1500);
  await snap("05-sprint1-completed", `${WEB}/teams/${teamId}/sprints/${sp1?.id}`, ".grid", 1500);

  await browser.close();
  console.log(`\n🎉 All screenshots saved to tasks/demo/screenshots/`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const cookie = await login();
const { teamId, sprintMap } = await seed(cookie);
await takeScreenshots(teamId, sprintMap);
