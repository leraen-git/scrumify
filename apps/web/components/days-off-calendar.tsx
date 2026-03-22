"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTransition, useState } from "react";

interface Developer {
  id: string;
  name: string;
  daysOff: { date: string; type: string }[];
}

interface Props {
  developers: Developer[];
  teamId: string;
}

type DayOffType = "half" | "full";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getAllDaysOfMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date) {
  return d.getDay() === 0 || d.getDay() === 6;
}

export function DaysOffCalendar({ developers, teamId }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [pending, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useState<Map<string, DayOffType>>(() => {
    const m = new Map<string, DayOffType>();
    developers.forEach((dev) =>
      dev.daysOff.forEach((d) => m.set(`${dev.id}|${d.date}`, d.type as DayOffType))
    );
    return m;
  });

  const days = getAllDaysOfMonth(year, month);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function handleToggle(developerId: string, date: string) {
    const key = `${developerId}|${date}`;
    const current = optimistic.get(key);
    setOptimistic((prev) => {
      const next = new Map(prev);
      if (!current) next.set(key, "half");
      else if (current === "half") next.set(key, "full");
      else next.delete(key);
      return next;
    });
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    startTransition(async () => {
      await fetch(`${apiUrl}/api/teams/${teamId}/developers/${developerId}/days-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
    });
  }

  if (developers.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Days Off</h3>
          <p className="text-xs text-gray-400 mt-0.5">Click once for half-day (½), twice for full day (✕), thrice to clear</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 w-32 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex w-6 h-5 rounded items-center justify-center bg-amber-100 text-amber-600 font-semibold">½</span>
          Half day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex w-6 h-5 rounded items-center justify-center bg-red-100 text-red-600 font-semibold">✕</span>
          Full day
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="text-xs border-collapse w-full" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 px-4 py-2 text-left text-gray-500 font-medium border-b border-r border-gray-100 min-w-[160px]">
                Developer
              </th>
              <th className="px-3 py-2 text-right text-gray-400 font-medium border-b border-r border-gray-100 min-w-[40px]">
                Off
              </th>
              {days.map((d) => {
                const weekend = isWeekend(d);
                const isToday = toISO(d) === toISO(today);
                const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0..Sun=6
                return (
                  <th
                    key={toISO(d)}
                    className={`px-0 py-2 text-center font-medium border-b border-r border-gray-100 w-9 ${
                      weekend
                        ? "bg-gray-50 text-gray-300"
                        : isToday
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-gray-400"
                    }`}
                  >
                    <div className="text-[10px]">{DAY_LABELS[dow]}</div>
                    <div className={`text-sm font-semibold ${weekend ? "text-gray-300" : isToday ? "text-indigo-600" : "text-gray-700"}`}>
                      {d.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {developers.map((dev, i) => {
              const daysOffCount = days.reduce((a, d) => {
                if (isWeekend(d)) return a;
                const t = optimistic.get(`${dev.id}|${toISO(d)}`);
                return a + (t === "half" ? 0.5 : t === "full" ? 1 : 0);
              }, 0);

              return (
                <tr key={dev.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="sticky left-0 z-10 px-4 py-2 border-r border-gray-100 bg-inherit">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold shrink-0 text-xs">
                        {dev.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{dev.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right border-r border-gray-100 font-semibold">
                    {daysOffCount > 0
                      ? <span className="text-red-500">{daysOffCount}</span>
                      : <span className="text-gray-200">0</span>}
                  </td>
                  {days.map((d) => {
                    const iso = toISO(d);
                    const weekend = isWeekend(d);
                    const isToday = iso === toISO(today);

                    if (weekend) {
                      return (
                        <td key={iso} className="border-r border-gray-100 bg-gray-50 w-9" />
                      );
                    }

                    const type = optimistic.get(`${dev.id}|${iso}`);
                    return (
                      <td
                        key={iso}
                        className={`border-r border-gray-100 text-center p-0 ${isToday ? "bg-indigo-50/30" : ""}`}
                      >
                        <button
                          onClick={() => handleToggle(dev.id, iso)}
                          disabled={pending}
                          title={
                            !type
                              ? `Mark ${dev.name} half day off`
                              : type === "half"
                              ? `Mark ${dev.name} full day off`
                              : `Clear day off for ${dev.name}`
                          }
                          className={`w-9 h-8 transition-colors rounded font-semibold text-xs ${
                            type === "full"
                              ? "bg-red-100 hover:bg-red-200 text-red-600"
                              : type === "half"
                              ? "bg-amber-100 hover:bg-amber-200 text-amber-600"
                              : "hover:bg-gray-100 text-transparent"
                          }`}
                        >
                          {type === "full" ? "✕" : type === "half" ? "½" : "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
