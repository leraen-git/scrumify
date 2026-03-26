"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";

export interface VelocityDataPoint {
  name: string;
  spPlanned: number;
  spDone: number;
  velocityPerDay: number;
  active?: boolean;
}

interface Props {
  data: VelocityDataPoint[];
  avgVelocityPerDay: number;
}

export function VelocityChart({ data, avgVelocityPerDay }: Props) {
  const completedData = data.filter((d) => !d.active);
  const activeData = data.filter((d) => d.active);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(completedData.map((d) => d.name))
  );

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const visibleData = [...completedData.filter((d) => selected.has(d.name)), ...activeData];

  const visibleAvg =
    visibleData.filter((d) => !d.active).length > 0
      ? Math.round(
          (visibleData.filter((d) => !d.active).reduce((a, d) => a + d.velocityPerDay, 0) /
            visibleData.filter((d) => !d.active).length) *
            100
        ) / 100
      : avgVelocityPerDay;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 w-1/2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Sprint Overview</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-200" />
            SP Planned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" />
            SP Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-amber-400" />
            SP / dev·day
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={visibleData} margin={{ top: 8, right: 40, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="sp"
            orientation="left"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "SP", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "#9ca3af" } }}
          />
          <YAxis
            yAxisId="vpd"
            orientation="right"
            tick={{ fontSize: 12, fill: "#f59e0b" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "SP/dev·day", angle: 90, position: "insideRight", offset: 10, style: { fontSize: 11, fill: "#f59e0b" } }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            labelFormatter={(label, payload) => {
              const isActive = payload?.[0]?.payload?.active;
              return isActive ? `${label} (in progress)` : label;
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: number, name: string) => {
              if (name === "SP Planned") return [value, "SP Planned"];
              if (name === "SP Done") return [value, "SP Done"];
              return [`${value.toFixed(2)}`, "SP / dev·day"];
            }) as any}
          />
          <Bar yAxisId="sp" dataKey="spPlanned" name="SP Planned" radius={[4, 4, 0, 0]} barSize={20}>
            {visibleData.map((entry, i) => (
              <Cell key={i} fill={entry.active ? "#e0e7ff" : "#c7d2fe"} fillOpacity={entry.active ? 0.7 : 1} />
            ))}
          </Bar>
          <Bar yAxisId="sp" dataKey="spDone" name="SP Done" radius={[4, 4, 0, 0]} barSize={20}>
            {visibleData.map((entry, i) => (
              <Cell key={i} fill={entry.active ? "#a5b4fc" : "#6366f1"} fillOpacity={entry.active ? 0.7 : 1} />
            ))}
          </Bar>
          <Line
            yAxisId="vpd"
            type="monotone"
            dataKey="velocityPerDay"
            name="SP / dev·day"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          {visibleAvg > 0 && (
            <ReferenceLine
              yAxisId="vpd"
              y={visibleAvg}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: `avg ${visibleAvg.toFixed(2)}`, position: "right", fontSize: 11, fill: "#f59e0b" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {completedData.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {completedData.map((d) => (
            <button
              key={d.name}
              onClick={() => toggle(d.name)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                selected.has(d.name)
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
