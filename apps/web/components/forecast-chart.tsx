"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
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

interface ChartPoint {
  name: string;
  barA: number;
  barB: number;
  isFuture: boolean;
  isActive: boolean;
  isOverflow: boolean;
  hasCapacityData: boolean;
  assignedSP: number;
  backlogFillSP: number;
}

// ── Colours ────────────────────────────────────────────────────────────────

const C = {
  pastPlanned:    "#c7d2fe",
  pastDone:       "#6366f1",
  activePlanned:  "#fde68a",
  activeDone:     "#f59e0b",
  futureCapacity: "#d1fae5",
  forecast:       "#6ee7b7",
  overflowCap:    "#fef3c7", // amber-100
  overflowFcst:   "#fbbf24", // amber-400
  separator:      "#d1d5db",
  activeBg:       "#fffbeb",
  activeBorder:   "#f59e0b",
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
          <Row label="Capacity"          value={d.barA} color={d.isOverflow ? C.overflowCap : C.futureCapacity} />
          <Row label="Forecast delivery" value={d.barB} color={d.isOverflow ? C.overflowFcst : C.forecast} bold />
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

const OVERFLOW_PAGE_SIZE = 2;

export function ForecastChart({ past, future, summary }: Props) {
  const [overflowPage, setOverflowPage] = useState(0);

  if (past.length === 0 && future.length === 0) return null;

  const regularFuture = future.filter((s) => !s.isOverflow);
  const overflowFuture = future.filter((s) => s.isOverflow);

  const totalOverflowPages = Math.ceil(overflowFuture.length / OVERFLOW_PAGE_SIZE);
  const visibleOverflow = overflowFuture.slice(
    overflowPage * OVERFLOW_PAGE_SIZE,
    overflowPage * OVERFLOW_PAGE_SIZE + OVERFLOW_PAGE_SIZE,
  );

  const toChartPoint = (s: FutureSprintPoint): ChartPoint => ({
    name: s.name,
    barA: s.capacity,
    barB: s.forecastDelivery,
    isFuture: true,
    isActive: false,
    isOverflow: s.isOverflow,
    hasCapacityData: s.hasCapacityData,
    assignedSP: s.assignedSP,
    backlogFillSP: s.backlogFillSP,
  });

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
    ...regularFuture.map(toChartPoint),
    ...visibleOverflow.map(toChartPoint),
  ];

  const separatorName = regularFuture[0]?.name ?? (visibleOverflow[0]?.name ?? null);
  const hasFuture = future.length > 0;
  const activeName = past.find((s) => s.isActive)?.name ?? null;
  const firstOverflowName = visibleOverflow[0]?.name ?? null;

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
        {overflowFuture.length > 0 && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" />
              Overflow capacity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
              Overflow forecast
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

          {/* Overflow separator */}
          {firstOverflowName && (
            <ReferenceLine
              x={firstOverflowName}
              stroke="#fcd34d"
              strokeWidth={2}
              strokeDasharray="4 2"
              label={{ value: "overflow →", position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
            />
          )}

          <Bar dataKey="barA" name="Planned / Capacity" radius={[4, 4, 0, 0]} barSize={20}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.isFuture
                    ? d.isOverflow ? C.overflowCap : C.futureCapacity
                    : d.isActive ? C.activePlanned : C.pastPlanned
                }
                stroke={d.isFuture && !d.isOverflow ? "#a7f3d0" : d.isOverflow ? "#fcd34d" : "none"}
                strokeWidth={1}
              />
            ))}
          </Bar>

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

      {/* Overflow pagination */}
      {overflowFuture.length > 0 && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-amber-600 font-medium mr-auto">
            Overflow sprints ({overflowFuture.length} needed to clear backlog)
          </span>
          <span className="text-xs text-gray-400">
            {overflowPage + 1} / {totalOverflowPages}
          </span>
          <button
            onClick={() => setOverflowPage((p) => Math.max(0, p - 1))}
            disabled={overflowPage === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous overflow sprints"
          >
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={() => setOverflowPage((p) => Math.min(totalOverflowPages - 1, p + 1))}
            disabled={overflowPage >= totalOverflowPages - 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next overflow sprints"
          >
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
