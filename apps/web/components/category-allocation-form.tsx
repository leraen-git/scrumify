"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { key: "user_story", label: "User Story", sub: "Business" },
  { key: "bug", label: "Bug", sub: "Defect" },
  { key: "mco", label: "MCO", sub: "" },
  { key: "best_effort", label: "Best-effort", sub: "" },
  { key: "tech_lead", label: "Tech Lead", sub: "" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

interface Props {
  teamId: string;
  initial: Record<string, number>;
  developers: { id: string; name: string; role: string; storyPointsPerSprint: number }[];
}

export function CategoryAllocationForm({ teamId, initial, developers }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<Record<CategoryKey, number>>({
    user_story: initial["user_story"] ?? 0,
    bug: initial["bug"] ?? 0,
    mco: initial["mco"] ?? 0,
    best_effort: initial["best_effort"] ?? 0,
    tech_lead: initial["tech_lead"] ?? 0,
  });

  const valuesRef = useRef(values);

  const totalCapacity = developers.reduce((a, d) => a + d.storyPointsPerSprint, 0);
  const techLead = developers.find((d) => d.role === "tech_lead") ?? null;

  const othersTotal = values.bug + values.mco + values.best_effort + values.tech_lead;
  const userStory = Math.max(0, 100 - othersTotal);

  const techLeadSP = totalCapacity > 0 ? Math.round(totalCapacity * values.tech_lead / 100) : 0;

  function set(key: Exclude<CategoryKey, "user_story">, raw: string) {
    const v = Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
    setValues((prev) => {
      const next = { ...prev, [key]: v };
      valuesRef.current = next;
      return next;
    });
  }

  function handleSave() {
    const current = valuesRef.current;
    const othersTotalCurrent = current.bug + current.mco + current.best_effort + current.tech_lead;
    if (othersTotalCurrent > 100) return;
    const userStoryCurrent = Math.max(0, 100 - othersTotalCurrent);
    const techLeadSPCurrent = totalCapacity > 0 ? Math.round(totalCapacity * current.tech_lead / 100) : 0;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    startTransition(async () => {
      await fetch(`${apiUrl}/api/teams/${teamId}/category-allocations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations: { ...current, user_story: userStoryCurrent } }),
      });
      if (techLead && techLeadSPCurrent > 0) {
        await fetch(`${apiUrl}/api/teams/${teamId}/developers/${techLead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyPointsPerSprint: techLeadSPCurrent }),
        });
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Category Allocation</h3>
      <div className="space-y-3">
        {CATEGORIES.map(({ key, label, sub }) => {
          const isAuto = key === "user_story";
          const displayValue = isAuto ? userStory : values[key as Exclude<CategoryKey, "user_story">];
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-36">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                {sub && <span className="ml-1.5 text-xs text-gray-400">({sub})</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={displayValue}
                  readOnly={isAuto}
                  onChange={isAuto ? undefined : (e) => set(key as Exclude<CategoryKey, "user_story">, e.target.value)}
                  onBlur={isAuto ? undefined : handleSave}
                  className={`w-16 h-8 rounded-md border px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isAuto
                      ? "border-gray-200 bg-gray-50 text-gray-500 cursor-default"
                      : "border-gray-300 bg-white"
                  }`}
                />
                <span className="text-sm text-gray-400">%</span>
                {isAuto && <span className="text-xs text-gray-400 italic">auto</span>}
                {totalCapacity > 0 && displayValue > 0 && (
                  <span className="text-xs text-gray-500 ml-1">
                    → {Math.round(totalCapacity * displayValue / 100)} SP
                    {key === "tech_lead" && techLead ? ` for ${techLead.name}` : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {othersTotal > 100 && (
        <p className="mt-3 text-xs text-red-500">Other categories exceed 100%</p>
      )}
    </div>
  );
}
