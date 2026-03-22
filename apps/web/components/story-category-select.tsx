"use client";

import { useState } from "react";

export const CATEGORY_CONFIG: Record<string, { label: string; abbr: string; color: string }> = {
  user_story: { label: "User Story", abbr: "US", color: "#6366f1" },
  bug:        { label: "Bug",        abbr: "Bug", color: "#ef4444" },
  mco:        { label: "MCO",        abbr: "MCO", color: "#f59e0b" },
  best_effort:{ label: "Best-effort",abbr: "BE",  color: "#22c55e" },
  tech_lead:  { label: "Tech Lead",  abbr: "TL",  color: "#a855f7" },
};

interface Props {
  action: (formData: FormData) => Promise<void>;
  defaultValue: string;
}

export function StoryCategorySelect({ action, defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue || "user_story");
  const config = CATEGORY_CONFIG[value] ?? CATEGORY_CONFIG.user_story;

  return (
    <form action={action} className="flex items-center gap-1 shrink-0">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
      <select
        name="category"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.currentTarget.form!.requestSubmit();
        }}
        className="h-6 rounded border border-gray-200 bg-white px-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-600 cursor-pointer"
      >
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <option key={key} value={key}>{cfg.abbr}</option>
        ))}
      </select>
    </form>
  );
}
