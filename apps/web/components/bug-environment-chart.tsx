"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const ENVIRONMENTS = ["dev", "staging", "preprod", "prod"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

const ENV_CONFIG: Record<Environment, { label: string; color: string }> = {
  dev:     { label: "Dev",     color: "#9ca3af" },
  staging: { label: "Staging", color: "#60a5fa" },
  preprod: { label: "Preprod", color: "#f59e0b" },
  prod:    { label: "Prod",    color: "#ef4444" },
};

interface SprintBugData {
  name: string;
  dev: number;
  staging: number;
  preprod: number;
  prod: number;
  unset: number;
}

interface Props {
  sprints: {
    name: string;
    stories: { category: string; environment: string | null }[];
  }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BugTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: { value: number }) => s + p.value, 0);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-2">{label} — {total} bug{total !== 1 ? "s" : ""}</p>
      {payload.map((p: { name: string; value: number; color: string }) =>
        p.value > 0 ? (
          <div key={p.name} className="flex items-center justify-between gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-gray-900">{p.value}</span>
          </div>
        ) : null
      )}
    </div>
  );
}

export function BugEnvironmentChart({ sprints }: Props) {
  const data: SprintBugData[] = sprints.map((sprint) => {
    const bugs = sprint.stories.filter((s) => s.category === "bug");
    const counts = { dev: 0, staging: 0, preprod: 0, prod: 0, unset: 0 };
    for (const bug of bugs) {
      const env = bug.environment as Environment | null;
      if (env && env in counts) counts[env]++;
      else counts.unset++;
    }
    return { name: sprint.name, ...counts };
  });

  const hasAnyBug = data.some((d) => d.dev + d.staging + d.preprod + d.prod + d.unset > 0);

  return (
    <div data-export-chart="bug-env" className="bg-white rounded-xl border border-gray-200 p-5 w-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Bugs by Environment</h3>
        <p className="text-xs text-gray-400 mt-0.5">Number of bug tickets per environment across sprints</p>
      </div>

      {!hasAnyBug ? (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">
          No bug tickets found across sprints.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} label={{ value: "Bugs", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "#9ca3af" } }} />
            <Tooltip content={<BugTooltip />} cursor={{ fill: "#f9fafb" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            {ENVIRONMENTS.map((env) => (
              <Bar key={env} dataKey={env} name={ENV_CONFIG[env].label} stackId="a" fill={ENV_CONFIG[env].color} radius={env === "prod" ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={ENV_CONFIG[env].color} />)}
              </Bar>
            ))}
            {data.some((d) => d.unset > 0) && (
              <Bar dataKey="unset" name="Unknown" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill="#e5e7eb" />)}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
