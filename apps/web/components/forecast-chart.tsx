"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Types (mirrored from API response) ────────────────────────────────────

export interface PastSprintPoint {
  name: string;
  capacity: number;
  spPlanned: number;
  spDone: number;
  velocityPerDay: number;
  isActive: boolean;
}

export interface FutureSprintPoint {
  name: string;
  capacity: number;
  forecastDelivery: number;
  assignedSP: number;
  backlogFillSP: number;
  remainingCapacity: number;
  isOverflow: boolean;
  hasCapacityData: boolean;
}

export interface ForecastSummary {
  totalBacklogStories: number;
  totalBacklogSP: number;
  sprintsAhead: number;
  avgEfficiency: number;
  avgVelocitySP: number;
  avgVelocityPerDay: number;
}

interface Props {
  past: PastSprintPoint[];
  future: FutureSprintPoint[];
  summary: ForecastSummary;
}

// ── Unified chart point ────────────────────────────────────────────────────
// Two bars per sprint: barA = "planned / capacity", barB = "delivered / forecast"

interface ChartPoint {
  name: string;
  barA: number;   // past → spPlanned | future → capacity
  barB: number;   // past → spDone    | future → forecastDelivery
  // tooltip extras
  isFuture: boolean;
  isActive: boolean;
  isOverflow: boolean;
  hasCapacityData: boolean;
  assignedSP: number;
  backlogFillSP: number;
}

// ── Colours ────────────────────────────────────────────────────────────────

const C = {
  pastPlanned:    "#c7d2fe", // indigo-200
  pastDone:       "#6366f1", // indigo-500
  activePlanned:  "#fde68a", // amber-200  — warm "in-progress" signal
  activeDone:     "#f59e0b", // amber-400
  futureCapacity: "#d1fae5", // emerald-100
  forecast:       "#6ee7b7", // emerald-300
  overflowCap:    "#d1fae5", // emerald-100 (same as future)
  overflowFcst:   "#6ee7b7", // emerald-300 (same as future)
  separator:      "#d1d5db", // gray-300
  activeBg:       "#fffbeb", // amber-50  — column highlight
  activeBorder:   "#f59e0b", // amber-400
};

// ── Tooltip ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: ChartPoint = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs min-w-[180px]">
      <p className="font-semibold text-gray-800 mb-2">
        {label}
        {d.isActive && <span className="ml-1.5 text-indigo-400">(active)</span>}
        {d.isFuture && !d.isOverflow && (
          <span className="ml-1.5 text-gray-400">
            {d.hasCapacityData ? "planned" : "estimated"}
          </span>
        )}
        {d.isOverflow && <span className="ml-1.5 text-amber-500">overflow</span>}
      </p>

      {!d.isFuture ? (
        <>
          <Row label="Planned"   value={d.barA} color={C.pastPlanned} />
          <Row label="Delivered" value={d.barB} color={C.pastDone} bold />
        </>
      ) : (
        <>
          <Row label="Capacity"          value={d.barA} color={C.futureCapacity} />
          <Row label="Forecast delivery" value={d.barB} color={C.forecast} bold />
          {d.assignedSP > 0 && (
            <Row label="  of which assigned" value={d.assignedSP} color={C.forecast} />
          )}
          {d.backlogFillSP > 0 && (
            <Row label="  of which backlog"  value={d.backlogFillSP} color="#6ee7b7" />
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 mt-1">
      <span className="flex items-center gap-1.5 text-gray-500">
        <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
        {label}
      </span>
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-700"}>{value} SP</span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function ForecastChart({ past, future, summary }: Props) {
  if (past.length === 0 && future.length === 0) return null;

  const chartData: ChartPoint[] = [
    ...past.map((s) => ({
      name: s.name,
      barA: s.spPlanned,
      barB: s.spDone,
      isFuture: false,
      isActive: s.isActive,
      isOverflow: false,
      hasCapacityData: true,
      assignedSP: 0,
      backlogFillSP: 0,
    })),
    ...future.map((s) => ({
      name: s.name,
      barA: s.capacity,
      barB: s.forecastDelivery,
      isFuture: true,
      isActive: false,
      isOverflow: s.isOverflow,
      hasCapacityData: s.hasCapacityData,
      assignedSP: s.assignedSP,
      backlogFillSP: s.backlogFillSP,
    })),
  ];

  const separatorName = future[0]?.name ?? null;
  const hasFuture = future.length > 0;
  const activeName = past.find((s) => s.isActive)?.name ?? null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Project Forecast</h3>
          {hasFuture && (
            <p className="text-xs text-gray-400 mt-0.5">
              {summary.avgEfficiency > 0
                ? `Based on ${Math.round(summary.avgEfficiency * 100)}% historical efficiency`
                : "No completed sprints yet — using 85% default efficiency"}
            </p>
          )}
        </div>

        {hasFuture && (
          <div className="flex flex-wrap gap-2">
            {summary.totalBacklogStories > 0 && (
              <div className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs text-emerald-700">
                Backlog: <strong>{summary.totalBacklogStories} stories</strong>{" "}
                ({summary.totalBacklogSP} SP)
              </div>
            )}
            {summary.sprintsAhead > 0 && (
              <div className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs text-indigo-700">
                <strong>{summary.sprintsAhead} sprint{summary.sprintsAhead !== 1 ? "s" : ""} ahead</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-indigo-200" />
          Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" />
          Delivered
        </span>
        {activeName && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
            Active sprint
          </span>
        )}
        {hasFuture && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-200" />
              Capacity (forecast)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-300" />
              Forecast delivery
            </span>
          </>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "SP", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "#9ca3af" } }}
          />

          {/* Active sprint background highlight — rendered before bars so it sits behind */}
          {activeName && (
            <ReferenceArea
              x1={activeName}
              x2={activeName}
              fill={C.activeBg}
              fillOpacity={1}
              stroke={C.activeBorder}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              label={{ value: "▶ Active sprint", position: "insideTop", fontSize: 10, fill: C.activeBorder, fontWeight: 600 }}
            />
          )}

          {separatorName && (
            <ReferenceLine
              x={separatorName}
              stroke={C.separator}
              strokeWidth={2}
              strokeDasharray="4 2"
              label={{ value: "forecast →", position: "insideTopRight", fontSize: 10, fill: "#9ca3af" }}
            />
          )}

          {/* Left bar: planned (past) / capacity (future) */}
          <Bar dataKey="barA" name="Planned / Capacity" radius={[4, 4, 0, 0]} barSize={20}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.isFuture
                    ? d.isOverflow ? C.overflowCap : C.futureCapacity
                    : d.isActive ? C.activePlanned : C.pastPlanned
                }
                stroke={d.isFuture && !d.isOverflow ? "#a7f3d0" : "none"}
                strokeWidth={1}
              />
            ))}
          </Bar>

          {/* Right bar: delivered (past) / forecast (future) */}
          <Bar dataKey="barB" name="Delivered / Forecast" radius={[4, 4, 0, 0]} barSize={20}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.isFuture
                    ? d.isOverflow ? C.overflowFcst : C.forecast
                    : d.isActive ? C.activeDone : C.pastDone
                }
                fillOpacity={1}
              />
            ))}
          </Bar>

          <Tooltip content={<ForecastTooltip />} cursor={{ fill: "#f9fafb" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
