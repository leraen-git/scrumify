import Papa from 'papaparse';

export interface JiraCSVRow {
  'Issue Key'?: string;
  'Summary'?: string;
  'Issue Type'?: string;
  'Status'?: string;
  'Priority'?: string;
  'Assignee'?: string;
  'Assignee Id'?: string;
  'Story Points'?: string;
  'Story point estimate'?: string;
  'Custom field (Story Points)'?: string;
  'Sprint'?: string;
  'Created'?: string;
  'Updated'?: string;
  'Epic Link'?: string;
  'Labels'?: string;
  'Description'?: string;
  'Category'?: string;
  'category'?: string;
  'Type'?: string;
  'type'?: string;
  [key: string]: string | undefined;
}

export interface ParsedSprint {
  name: string;
  status: 'planned' | 'active' | 'completed';
  startDate: string;
  endDate: string;
}

export interface ParsedDeveloper {
  name: string;
  externalId: string;
}

export interface ParsedTicket {
  externalKey: string;
  title: string;
  status: string;
  priority: number;
  storyPoints: number;
  category: string;
  sprintName: string | null;
  assigneeExternalId: string | null;
  labels: string[];
}

export interface ImportSummary {
  totalTickets: number;
  sprintsDetected: number;
  pastSprints: number;
  activeSprints: number;
  futureSprints: number;
  developersFound: number;
  ticketsWithNoSprint: number;
  ticketsWithNoAssignee: number;
  warnings: string[];
}

export interface ParsedImportData {
  sprints: ParsedSprint[];
  developers: ParsedDeveloper[];
  tickets: ParsedTicket[];
  summary: ImportSummary;
}

function normalizeHeader(headers: string[]): (row: Record<string, string>) => JiraCSVRow {
  return (row) => {
    const normalized: JiraCSVRow = {};
    for (const key of headers) {
      normalized[key] = row[key] ?? '';
    }
    return normalized;
  };
}

function getStoryPoints(row: JiraCSVRow): number {
  const raw =
    row['Story Points'] ||
    row['Story point estimate'] ||
    row['Custom field (Story Points)'] ||
    '';
  const n = parseFloat(raw.trim());
  return isNaN(n) ? 0 : Math.round(n);
}

function mapStatus(jiraStatus: string): string {
  const s = jiraStatus.trim().toLowerCase();
  if (s === 'done' || s === 'closed' || s === 'resolved') return 'done';
  if (s === 'in progress') return 'in_progress';
  if (s === 'dev done') return 'dev_done';
  return 'todo';
}

function mapPriority(jiraPriority: string): number {
  const p = jiraPriority.trim().toLowerCase();
  if (p === 'highest') return 4;
  if (p === 'high') return 3;
  if (p === 'medium') return 2;
  if (p === 'low') return 1;
  return 0;
}

const VALID_CATEGORIES = new Set(['user_story', 'bug', 'mco', 'best_effort', 'tech_lead']);

function normalizeCategory(raw: string): string {
  const s = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (VALID_CATEGORIES.has(s)) return s;
  if (s === 'userstory' || s === 'us' || s === 'business' || s === 'user story' || s === 'story') return 'user_story';
  if (s === 'defect' || s === 'fix' || s === 'bug') return 'bug';
  if (s === 'tech' || s === 'techlead' || s === 'tl' || s === 'task') return 'tech_lead';
  if (s === 'be' || s === 'bestef' || s === 'best effort') return 'best_effort';
  return 'user_story';
}

function mapCategory(row: JiraCSVRow): string {
  // Check columns in priority order: Category > Type > Issue Type > Labels
  const candidates = [
    row['Category'],
    row['category'],
    row['Type'],
    row['type'],
    row['Issue Type'],
    // Labels: use first label only
    (row['Labels'] ?? '').split(',')[0],
  ];
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const mapped = normalizeCategory(raw.trim());
    if (mapped !== 'user_story') return mapped; // found a specific category
  }
  // If all candidates map to user_story (or are empty), still use Issue Type result
  const issueType = row['Issue Type'] ?? row['Type'] ?? '';
  return normalizeCategory(issueType);
}

function extractSprintNumber(name: string): number {
  const match = name.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
}

function generateSprintDates(
  sprints: { name: string; status: 'planned' | 'active' | 'completed' }[],
  sprintDurationWeeks: number = 2,
): ParsedSprint[] {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const durationMs = sprintDurationWeeks * MS_PER_WEEK;

  const activeIdx = sprints.findIndex((s) => s.status === 'active');
  const anchor = activeIdx >= 0 ? activeIdx : sprints.findIndex((s) => s.status === 'planned');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return sprints.map((sprint, i) => {
    const offset = i - (anchor >= 0 ? anchor : sprints.length - 1);
    const startMs = today.getTime() + offset * durationMs;
    const endMs = startMs + durationMs - 1;
    return {
      ...sprint,
      startDate: new Date(startMs).toISOString().slice(0, 10),
      endDate: new Date(endMs).toISOString().slice(0, 10),
    };
  });
}

export function parseJiraCSV(file: File): Promise<ParsedImportData> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete(results) {
        try {
          const rows = results.data;
          if (rows.length === 0) {
            reject(new Error('No tickets found in this file.'));
            return;
          }

          const headers = Object.keys(rows[0]);
          const toRow = normalizeHeader(headers);
          const warnings: string[] = [];

          const hasSprintCol = headers.some((h) => h.toLowerCase() === 'sprint');
          const hasAssigneeIdCol = headers.some((h) => h.toLowerCase() === 'assignee id');

          if (!hasSprintCol) warnings.push('No "Sprint" column found — all tickets will go to Backlog.');
          if (!hasAssigneeIdCol) warnings.push('No "Assignee Id" column found — tickets will be unassigned.');

          // Filter out sub-tasks
          const validRows = rows
            .map(toRow)
            .filter((r) => {
              const type = (r['Issue Type'] ?? '').trim().toLowerCase();
              return type !== 'sub-task' && type !== 'subtask';
            });

          if (validRows.length === 0) {
            reject(new Error('No tickets found in this file.'));
            return;
          }

          // Build sprint → ticket status map
          const sprintTicketStatuses = new Map<string, string[]>();
          for (const row of validRows) {
            const sprintCell = row['Sprint']?.trim() ?? '';
            if (!sprintCell) continue;
            const sprintNames = sprintCell.split(',').map((s) => s.trim()).filter(Boolean);
            const lastSprint = sprintNames[sprintNames.length - 1];
            const status = (row['Status'] ?? '').trim().toLowerCase();
            if (!sprintTicketStatuses.has(lastSprint)) sprintTicketStatuses.set(lastSprint, []);
            sprintTicketStatuses.get(lastSprint)!.push(status);
          }

          // Determine sprint status + sort
          type SprintMeta = { name: string; status: 'planned' | 'active' | 'completed' };
          const sprintMetas: SprintMeta[] = [];
          for (const [name, statuses] of sprintTicketStatuses) {
            const allDone = statuses.every((s) => s === 'done' || s === 'closed' || s === 'resolved');
            const anyInProgress = statuses.some((s) => s === 'in progress');
            const allTodo = statuses.every((s) => s === 'to do' || s === 'open');

            let status: 'planned' | 'active' | 'completed';
            if (anyInProgress) status = 'active';
            else if (allTodo) status = 'planned';
            else if (allDone) status = 'completed';
            else status = 'completed'; // mixed → treat as past

            sprintMetas.push({ name, status });
          }

          // Only one active sprint: keep most recently numbered, demote others to completed
          const activeOnes = sprintMetas.filter((s) => s.status === 'active');
          if (activeOnes.length > 1) {
            const sorted = [...activeOnes].sort(
              (a, b) => extractSprintNumber(b.name) - extractSprintNumber(a.name),
            );
            for (const s of sorted.slice(1)) s.status = 'completed';
          }

          sprintMetas.sort(
            (a, b) => extractSprintNumber(a.name) - extractSprintNumber(b.name),
          );

          const sprints = generateSprintDates(sprintMetas);

          // Build developer map
          const devMap = new Map<string, string>(); // externalId → name (most frequent)
          const devNameCount = new Map<string, Map<string, number>>();
          for (const row of validRows) {
            const id = row['Assignee Id']?.trim() ?? '';
            const name = row['Assignee']?.trim() ?? '';
            if (!id || !name) continue;
            if (!devNameCount.has(id)) devNameCount.set(id, new Map());
            const nc = devNameCount.get(id)!;
            nc.set(name, (nc.get(name) ?? 0) + 1);
          }
          for (const [id, nc] of devNameCount) {
            let best = '';
            let bestCount = 0;
            for (const [name, count] of nc) {
              if (count > bestCount) { best = name; bestCount = count; }
            }
            devMap.set(id, best);
          }

          const developers: ParsedDeveloper[] = Array.from(devMap.entries()).map(([externalId, name]) => ({
            externalId,
            name,
          }));

          // Build sprint name lookup
          const sprintNameSet = new Set(sprints.map((s) => s.name));

          // Build tickets
          const tickets: ParsedTicket[] = [];
          let noSprint = 0;
          let noAssignee = 0;

          for (const row of validRows) {
            const title = (row['Summary'] ?? '').trim();
            if (!title) continue;

            const sprintCell = row['Sprint']?.trim() ?? '';
            const sprintNames = sprintCell.split(',').map((s) => s.trim()).filter(Boolean);
            const lastSprint = sprintNames[sprintNames.length - 1] ?? null;
            const resolvedSprint = lastSprint && sprintNameSet.has(lastSprint) ? lastSprint : null;

            const assigneeExternalId = row['Assignee Id']?.trim() || null;

            if (!resolvedSprint) noSprint++;
            if (!assigneeExternalId) noAssignee++;

            tickets.push({
              externalKey: row['Issue Key']?.trim() ?? '',
              title,
              status: mapStatus(row['Status'] ?? ''),
              priority: mapPriority(row['Priority'] ?? ''),
              storyPoints: getStoryPoints(row),
              category: mapCategory(row),
              sprintName: resolvedSprint,
              assigneeExternalId,
              labels: (row['Labels'] ?? '').split(',').map((l) => l.trim()).filter(Boolean),
            });
          }

          const summary: ImportSummary = {
            totalTickets: tickets.length,
            sprintsDetected: sprints.length,
            pastSprints: sprints.filter((s) => s.status === 'completed').length,
            activeSprints: sprints.filter((s) => s.status === 'active').length,
            futureSprints: sprints.filter((s) => s.status === 'planned').length,
            developersFound: developers.length,
            ticketsWithNoSprint: noSprint,
            ticketsWithNoAssignee: noAssignee,
            warnings,
          };

          resolve({ sprints, developers, tickets, summary });
        } catch (err) {
          reject(err);
        }
      },
      error(err) {
        reject(new Error(`Invalid file format. Please upload a Jira CSV export. (${err.message})`));
      },
    });
  });
}
