"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CategoryEntry {
  label: string;
  color: string;
  sp: number;
  spDone: number;
}

interface Props {
  categories: CategoryEntry[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CategoryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const done  = payload.find((p: { name: string }) => p.name === "Done")?.value  ?? 0;
  const total = payload.find((p: { name: string }) => p.name === "Total")?.value ?? 0;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs min-w-[140px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-gray-500">Done</span>
        <span className="font-semibold text-gray-900">{done} SP</span>
      </div>
      <div className="flex items-center justify-between gap-4 mt-1">
        <span className="text-gray-500">Total</span>
        <span className="font-semibold text-gray-900">{total} SP</span>
      </div>
      <div className="flex items-center justify-between gap-4 mt-1 border-t border-gray-100 pt-1">
        <span className="text-gray-500">Completion</span>
        <span className="font-semibold text-indigo-600">{pct}%</span>
      </div>
    </div>
  );
}

export function SprintCategoryChart({ categories }: Props) {
  const data = categories.map((c) => ({
    name:  c.label,
    Total: c.sp,
    Done:  c.spDone,
    fill:  c.color,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 w-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Story Points by Category</h3>
        <p className="text-xs text-gray-400 mt-0.5">Done vs total SP per category</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false}
            label={{ value: "SP", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "#9ca3af" } }}
          />
          <Tooltip content={<CategoryTooltip />} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="Total" name="Total" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.22} />)}
          </Bar>
          <Bar dataKey="Done" name="Done" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
