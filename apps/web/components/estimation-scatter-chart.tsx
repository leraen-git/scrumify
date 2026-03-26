"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ScatterPoint {
  sp: number;
  hours: number;
  devHours: number;
  testHours: number;
  title: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EstimationTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ScatterPoint & { trend?: number };
  if (!d?.title) return null; // trendline points have no title

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs min-w-[170px]">
      <p className="font-semibold text-gray-800 mb-2 max-w-[200px] truncate">{d.title}</p>
      <div className="space-y-1">
        <Row label="Estimate" value={`${d.sp} SP`} />
        {d.devHours > 0 && <Row label="Dev time" value={`${d.devHours}h`} />}
        {d.testHours > 0 && <Row label="Test time" value={`${d.testHours}h`} />}
        <div className="border-t border-gray-100 pt-1 mt-1">
          <Row label="Total" value={`${d.hours}h`} bold />
          {d.sp > 0 && (
            <Row
              label="h / SP"
              value={String(Math.round((d.hours / d.sp) * 10) / 10)}
              color="#6366f1"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span
        className={bold ? "font-semibold text-gray-900" : "text-gray-700"}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function EstimationScatterChart({ data }: { data: ScatterPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 w-full">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Estimation Accuracy</h3>
        <p className="text-xs text-gray-400 italic">
          No data yet — appears once stories complete the full dev → test → done flow.
        </p>
      </div>
    );
  }

  const validData = data.filter((d) => d.sp > 0);
  if (validData.length === 0) return null;

  const avgRatio = validData.reduce((a, d) => a + d.hours / d.sp, 0) / validData.length;

  const maxSP = Math.max(...validData.map((d) => d.sp));
  const trendData = [1, 2, 3, 5, 8, 13, 21]
    .filter((sp) => sp <= maxSP + 2)
    .map((sp) => ({ sp, trend: Math.round(avgRatio * sp * 10) / 10 }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 w-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Estimation Accuracy</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Each dot is a completed story — dashed line shows average{" "}
          <strong>{Math.round(avgRatio * 10) / 10}h / SP</strong>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="sp"
            type="number"
            domain={[0, maxSP + 1]}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Story Points",
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 11, fill: "#9ca3af" },
            }}
          />
          <YAxis
            type="number"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Hours",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fontSize: 11, fill: "#9ca3af" },
            }}
          />
          <Scatter data={validData} dataKey="hours" fill="#6366f1" fillOpacity={0.65} />
          <Line
            data={trendData}
            dataKey="trend"
            dot={false}
            strokeDasharray="4 3"
            stroke="#d1d5db"
            strokeWidth={1.5}
            type="linear"
            legendType="none"
          />
          <Tooltip content={<EstimationTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
