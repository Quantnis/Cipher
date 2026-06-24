"use client";

import { useEffect, useState } from "react";
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
  YAxis
} from "recharts";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const chartTooltip = {
  background: "rgba(3, 7, 18, 0.94)",
  border: "1px solid rgba(39, 39, 42, 0.9)",
  borderRadius: 8,
  color: "#e4e4e7",
  boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
};

export function RiskTrendChart({ data }: { data: Array<{ date: string; risk: number; alerts: number }> }) {
  const mounted = useMounted();
  if (!mounted) return <div className="h-64 rounded-md border border-zinc-800/70 bg-black/20" />;
  return (
    <div className="h-64 w-full min-w-0" aria-label="Risk trend area chart">
      <ResponsiveContainer width="100%" height={256}>
        <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="riskStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="52%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.26} />
              <stop offset="45%" stopColor="#4f46e5" stopOpacity={0.11} />
              <stop offset="100%" stopColor="#030712" stopOpacity={0} />
            </linearGradient>
            <filter id="riskGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid stroke="rgba(63,63,70,0.48)" strokeDasharray="2 8" vertical={false} />
          <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickMargin={12} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={42} />
          <Tooltip contentStyle={chartTooltip} labelStyle={{ color: "#67e8f9" }} cursor={{ stroke: "rgba(34,211,238,0.22)", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="risk" stroke="url(#riskStroke)" fill="url(#riskFill)" strokeWidth={2.4} filter="url(#riskGlow)" activeDot={{ r: 4, fill: "#67e8f9", stroke: "#030712", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function gradientForCategory(category: string) {
  const value = category.toLowerCase();
  if (value.includes("risk") || value.includes("leak") || value.includes("threat") || value.includes("fraud")) {
    return "url(#barDanger)";
  }
  if (value.includes("crypto") || value.includes("wallet") || value.includes("tech")) {
    return "url(#barCrypto)";
  }
  return "url(#barDefault)";
}

export function CategoryChart({ data }: { data: Array<{ category: string; count: number }> }) {
  const mounted = useMounted();
  if (!mounted) return <div className="h-64 rounded-md border border-zinc-800/70 bg-black/20" />;
  return (
    <div className="h-64 w-full min-w-0" aria-label="Category distribution horizontal bar chart">
      <ResponsiveContainer width="100%" height={256}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 18, bottom: 0, left: 8 }} barCategoryGap={14}>
          <defs>
            <linearGradient id="barDanger" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="barCrypto" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="barDefault" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <filter id="barGlow" x="-20%" y="-80%" width="150%" height="260%">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid stroke="rgba(63,63,70,0.4)" strokeDasharray="2 8" horizontal={false} />
          <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis dataKey="category" type="category" width={132} stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
          <Tooltip contentStyle={chartTooltip} labelStyle={{ color: "#c4b5fd" }} cursor={{ fill: "rgba(39,39,42,0.22)" }} />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={12} filter="url(#barGlow)">
            {data.map((entry) => (
              <Cell key={entry.category} fill={gradientForCategory(entry.category)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
