"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DayPoint, StatusSlice } from "@/lib/services/analytics-service";

// Emerald is the single accent; a second, dimmer teal distinguishes the
// "activated" series from "generated". Grid and axes are muted so the data
// reads first. Colours come from the CSS theme tokens where practical.
const GENERATED = "hsl(152 60% 46%)";
const ACTIVATED = "hsl(190 55% 50%)";
const AXIS = "hsl(217 12% 55%)";
const GRID = "hsl(220 14% 18%)";

const STATUS_COLOR: Record<string, string> = {
  Active: "hsl(152 60% 46%)",
  Unused: "hsl(217 12% 45%)",
  Expired: "hsl(38 92% 55%)",
  Banned: "hsl(0 72% 58%)",
  Revoked: "hsl(0 62% 40%)",
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-medium">{shortDate(label)}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ActivityChart({ data }: { data: DayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="genFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GENERATED} stopOpacity={0.35} />
            <stop offset="100%" stopColor={GENERATED} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="actFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACTIVATED} stopOpacity={0.3} />
            <stop offset="100%" stopColor={ACTIVATED} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          stroke={AXIS}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="generated" name="generated" stroke={GENERATED} strokeWidth={2} fill="url(#genFill)" />
        <Area type="monotone" dataKey="activated" name="activated" stroke={ACTIVATED} strokeWidth={2} fill="url(#actFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusChart({ data }: { data: StatusSlice[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No licenses yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="status"
          stroke={AXIS}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(220 14% 14%)" }} />
        <Bar dataKey="count" name="licenses" radius={[0, 4, 4, 0]}>
          {data.map((slice) => (
            <Cell key={slice.status} fill={STATUS_COLOR[slice.status] ?? GENERATED} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
