"use client";

import { useState } from "react";

const ENV_CONFIG: Record<string, { label: string; color: string }> = {
  "":       { label: "env?",   color: "#d1d5db" },
  dev:      { label: "Dev",    color: "#9ca3af" },
  staging:  { label: "Staging",color: "#60a5fa" },
  preprod:  { label: "Preprod",color: "#f59e0b" },
  prod:     { label: "Prod",   color: "#ef4444" },
};

interface Props {
  action: (formData: FormData) => Promise<void>;
  defaultValue: string | null;
}

export function StoryEnvironmentSelect({ action, defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue ?? "");
  const config = ENV_CONFIG[value] ?? ENV_CONFIG[""];

  return (
    <form action={action} className="flex items-center gap-1 shrink-0">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
      <select
        name="environment"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.currentTarget.form!.requestSubmit();
        }}
        className="h-6 rounded border border-gray-200 bg-white px-1 text-[10px] text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
      >
        {Object.entries(ENV_CONFIG).map(([key, cfg]) => (
          <option key={key} value={key}>{cfg.label}</option>
        ))}
      </select>
    </form>
  );
}
