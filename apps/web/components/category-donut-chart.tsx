"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  user_story:  "#6366f1",
  bug:         "#ef4444",
  mco:         "#f59e0b",
  best_effort: "#22c55e",
  tech_lead:   "#a855f7",
};

const LABELS: Record<string, string> = {
  user_story:  "User Story",
  bug:         "Bug",
  mco:         "MCO",
  best_effort: "Best-effort",
  tech_lead:   "Tech Lead",
};

const CATEGORY_KEYS = ["user_story", "bug", "mco", "best_effort", "tech_lead"];

interface SprintOption {
  id: string;
  name: string;
  active?: boolean;
  stories: { category: string; storyPoints: number }[];
}

interface Props {
  sprints: SprintOption[];
}

export function CategoryDonutChart({ sprints }: Props) {
  const lastCompleted = [...sprints].reverse().find((s) => !s.active);
  const [selectedId, setSelectedId] = useState<string>((lastCompleted ?? sprints[sprints.length - 1])?.id ?? "");

  const sprint = sprints.find((s) => s.id === selectedId) ?? sprints[sprints.length - 1];
  if (!sprint) return null;

  const data = CATEGORY_KEYS
    .map((key) => ({
      key,
      name: LABELS[key] ?? key,
      value: sprint.stories.filter((s) => s.category === key).reduce((sum, s) => sum + s.storyPoints, 0),
      color: COLORS[key] ?? "#94a3b8",
    }))
    .filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 w-1/2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Category Breakdown</h3>
        <span className="text-xs text-gray-400">
          {sprint.name}{sprint.active ? " (in progress)" : ""} · {total} SP
        </span>
      </div>

      <div className="flex gap-4 items-center" style={{ height: 300 }}>
        <ResponsiveContainer width="55%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={108}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value} SP`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-3">
          {data.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-600">{entry.name}</span>
              </div>
              <div className="text-right tabular-nums">
                <span className="font-semibold text-gray-800">{entry.value} SP</span>
                <span className="ml-1.5 text-xs text-gray-400">{Math.round(entry.value / total * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {sprints.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {sprints.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                s.id === selectedId
                  ? s.active
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              {s.name}{s.active ? " ·" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
