"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const chartTooltip = {
  background: "rgba(9, 9, 11, 0.96)",
  border: "1px solid rgba(63, 63, 70, 0.86)",
  borderRadius: 10,
  color: "#f4f4f5",
  boxShadow: "0 18px 50px rgba(0,0,0,0.42)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 12
};

const axisTick = { fill: "#71717a", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };

export function RiskTrendChart({ data }: { data: Array<{ date: string; risk: number; alerts: number }> }) {
  const mounted = useMounted();
  if (!mounted) return <div className="h-full min-h-0 rounded-lg border border-zinc-800/80 bg-zinc-950/40" />;
  return (
    <div className="h-full min-h-0 w-full min-w-0 overflow-hidden" aria-label="Risk trend chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 14, right: 14, bottom: 4, left: -12 }}>
          <defs>
            <linearGradient id="riskStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.72} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.58} />
            </linearGradient>
            <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#09090b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(63,63,70,0.68)" strokeWidth={1} vertical horizontal />
          <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: "rgba(63,63,70,0.8)" }} tickMargin={10} />
          <YAxis tick={axisTick} tickLine={false} axisLine={{ stroke: "rgba(63,63,70,0.8)" }} width={42} />
          <Tooltip contentStyle={chartTooltip} labelStyle={{ color: "#d4d4d8" }} cursor={{ stroke: "rgba(129,140,248,0.24)", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="risk" stroke="url(#riskStroke)" fill="url(#riskFill)" strokeWidth={2} activeDot={{ r: 4, fill: "#a78bfa", stroke: "#09090b", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: Array<{ category: string; count: number }> }) {
  const mounted = useMounted();
  if (!mounted) return <div className="h-full min-h-0 rounded-lg border border-zinc-800/80 bg-zinc-950/40" />;
  return (
    <div className="h-full min-h-0 w-full min-w-0 overflow-hidden" aria-label="Category distribution bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 14, bottom: 4, left: 6 }} barCategoryGap={16}>
          <defs>
            <linearGradient id="categoryBar" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#312e81" stopOpacity={0.88} />
              <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.72} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(63,63,70,0.68)" strokeWidth={1} horizontal={false} vertical />
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: "rgba(63,63,70,0.8)" }} />
          <YAxis dataKey="category" type="category" width={112} tick={axisTick} tickLine={false} axisLine={{ stroke: "rgba(63,63,70,0.8)" }} tickMargin={10} />
          <Tooltip contentStyle={chartTooltip} labelStyle={{ color: "#d4d4d8" }} cursor={{ fill: "rgba(39,39,42,0.36)" }} />
          <Bar dataKey="count" fill="url(#categoryBar)" radius={[999, 999, 999, 999]} barSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}