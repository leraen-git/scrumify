"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
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

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Chart point ────────────────────────────────────────────────────────────

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
  pastPlanned:    "#c7d2fe", // indigo-200
  pastDone:       "#6366f1", // indigo-500
  activePlanned:  "#fde68a", // amber-200
  activeDone:     "#f59e0b", // amber-400
  futureCapacity: "#e5e7eb", // gray-200
  forecast:       "#9ca3af", // gray-400
  overflowCap:    "#d1d5db", // gray-300
  overflowFcst:   "#6b7280", // gray-500
  separator:      "#d1d5db",
  activeBg:       "#fffbeb",
  activeBorder:   "#f59e0b",
  futureSeparator:"#9ca3af",
  overflowSeparator: "#6b7280",
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
        {d.isActive && <span className="ml-1.5 text-amber-500">(active)</span>}
        {d.isFuture && !d.isOverflow && (
          <span className="ml-1.5 text-gray-400">
            {d.hasCapacityData ? "planned" : "estimated"}
          </span>
        )}
        {d.isOverflow && <span className="ml-1.5 text-gray-500">overflow</span>}
      </p>

      {!d.isFuture ? (
        <>
          <Row label="Planned"   value={d.barA} color={C.pastPlanned} />
          <Row label="Delivered" value={d.barB} color={C.pastDone} bold />
        </>
      ) : (
        <>
          <Row label="Capacity" value={d.barA} color={d.isOverflow ? C.overflowCap : C.futureCapacity} bold />
          {d.assignedSP > 0 && (
            <Row label="  assigned" value={d.assignedSP} color={C.forecast} />
          )}
          {d.backlogFillSP > 0 && (
            <Row label="  backlog fill" value={d.backlogFillSP} color="#9ca3af" />
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

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 7;

// ── Component ──────────────────────────────────────────────────────────────

export function ForecastChart({ past, future, summary }: Props) {
  // Build the full dataset (all sprints, past + future + overflow)
  const allData: ChartPoint[] = useMemo(() => [
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
      barB: 0,
      isFuture: true,
      isActive: false,
      isOverflow: s.isOverflow,
      hasCapacityData: s.hasCapacityData,
      assignedSP: s.assignedSP,
      backlogFillSP: s.backlogFillSP,
    })),
  ], [past, future]);

  const totalPages = Math.max(1, Math.ceil(allData.length / PAGE_SIZE));

  // Default page: show the page containing the active sprint, otherwise the last page
  const [page, setPage] = useState(() => {
    const activeIdx = allData.findIndex((d) => d.isActive);
    if (activeIdx >= 0) return Math.floor(activeIdx / PAGE_SIZE);
    return Math.max(0, totalPages - 1);
  });

  if (allData.length === 0) return null;

  const clampedPage = Math.min(page, totalPages - 1);
  const visible = allData.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  // Reference lines inside the visible slice
  const firstFutureName = visible.find((d) => d.isFuture && !d.isOverflow)?.name ?? null;
  const firstOverflowName = visible.find((d) => d.isOverflow)?.name ?? null;
  const activeName = visible.find((d) => d.isActive)?.name ?? null;

  const hasFuture = future.length > 0;
  const overflowFuture = future.filter((s) => s.isOverflow);

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
              <div className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs text-gray-600">
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
        {past.some((s) => s.isActive) && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
            Active sprint
          </span>
        )}
        {hasFuture && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 border border-gray-300" />
            Capacity (forecast)
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={visible} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
              label={{ value: "▶ active", position: "insideTop", fontSize: 10, fill: C.activeBorder, fontWeight: 600 }}
            />
          )}


          {firstOverflowName && (
            <ReferenceLine
              x={firstOverflowName}
              stroke={C.overflowSeparator}
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}

          <Bar dataKey="barA" name="Planned / Capacity" radius={[4, 4, 0, 0]} barSize={20}>
            {visible.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.isFuture
                    ? d.isOverflow ? C.overflowCap : C.futureCapacity
                    : d.isActive ? C.activePlanned : C.pastPlanned
                }
                stroke={d.isFuture ? "#d1d5db" : "none"}
                strokeWidth={1}
              />
            ))}
          </Bar>

          <Bar dataKey="barB" name="Delivered / Forecast" radius={[4, 4, 0, 0]} barSize={20}>
            {visible.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.isFuture
                    ? d.isOverflow ? C.overflowFcst : C.forecast
                    : d.isActive ? C.activeDone : C.pastDone
                }
              />
            ))}
          </Bar>

          <Tooltip content={<ForecastTooltip />} cursor={{ fill: "#f9fafb" }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Pagination — always shown when there are more sprints than the page size */}
      {allData.length > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400 mr-auto">
            Showing {clampedPage * PAGE_SIZE + 1}–{Math.min((clampedPage + 1) * PAGE_SIZE, allData.length)} of {allData.length} sprints
          </span>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous sprints"
          >
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <span className="text-xs text-gray-400 tabular-nums">
            {clampedPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next sprints"
          >
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
