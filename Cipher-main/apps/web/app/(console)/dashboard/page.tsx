"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, Database, GitBranch, RadioTower, Siren, Wallet, Zap } from "lucide-react";
import { CategoryChart, RiskTrendChart } from "@/components/charts";
import { BorderBeam } from "@/components/ui/border-beam";
import { api } from "@/lib/api";
import type { Alert, CaseRecord } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Summary = {
  total_crawled_sources?: number;
  high_risk_alerts?: number;
  new_entities_discovered?: number;
  high_risk_wallets?: number;
  leak_mentions?: number;
  system_health?: Record<string, unknown>;
  top_risky_clusters?: CaseRecord[];
};

type MetricTone = "neutral" | "danger" | "intel" | "violet" | "amber";

const metricMeta: Record<MetricTone, { trend: string; icon: string; accent: string }> = {
  neutral: { trend: "+12% vs last week", icon: "text-zinc-300", accent: "bg-zinc-700" },
  danger: { trend: "+8 critical events", icon: "text-rose-400", accent: "bg-rose-500" },
  intel: { trend: "+19% entity growth", icon: "text-cyan-400", accent: "bg-cyan-500" },
  violet: { trend: "wallet risk delta +4", icon: "text-violet-300", accent: "bg-violet-500" },
  amber: { trend: "+6 indexed leaks", icon: "text-amber-400", accent: "bg-amber-500" }
};

function Surface({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("relative min-h-0 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/20 shadow-sm backdrop-blur-md", className)}>{children}</section>;
}

function MonoLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-mono text-xs tracking-normal text-zinc-500", className)}>{children}</p>;
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="mb-3 flex flex-shrink-0 items-start justify-between gap-4">
      <div className="min-w-0">
        <MonoLabel className="uppercase tracking-[0.18em]">{eyebrow}</MonoLabel>
        <h2 className="mt-1 truncate font-sans text-sm font-bold tracking-tight text-zinc-100">{title}</h2>
      </div>
      <MonoLabel className="hidden max-w-[280px] text-right leading-5 xl:block">{detail}</MonoLabel>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: MetricTone }) {
  const meta = metricMeta[tone];
  return (
    <Surface className="h-full p-4">
      <div className="flex h-full min-h-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <MonoLabel className="truncate uppercase">{label}</MonoLabel>
          <div className="mt-1 truncate font-sans text-2xl font-bold tracking-tight text-zinc-100 tabular-nums">{value.toLocaleString()}</div>
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-zinc-800/80 bg-zinc-950/55 px-2 py-1 font-mono text-[11px] text-zinc-500">
            <span className={cn("size-1.5 flex-shrink-0 rounded-full", meta.accent)} />
            <ArrowUpRight className="size-3 flex-shrink-0" />
            <span className="truncate">{meta.trend}</span>
          </div>
        </div>
        <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/60">
          <Icon className={cn("size-4", meta.icon)} />
        </div>
      </div>
    </Surface>
  );
}

function RiskBadge({ score }: { score: number }) {
  const isHigh = score >= 60;
  return (
    <span className={cn("inline-flex size-9 items-center justify-center rounded-md font-mono text-xs font-bold tabular-nums", isHigh ? "border border-rose-800/40 bg-rose-950/40 text-rose-400" : "border border-amber-800/40 bg-amber-950/30 text-amber-400")}>{score}</span>
  );
}

function CodeTag({ children }: { children: React.ReactNode }) {
  return <code className="mx-0.5 rounded border border-zinc-700/50 bg-zinc-800/40 px-1.5 py-0.5 font-mono text-xs text-zinc-400">{children}</code>;
}

function HighlightedReason({ text }: { text: string }) {
  const parts = text.split(/(@[\w.-]+|0x[a-fA-F0-9]{6,}|\b(?:\d{1,3}\.){3}\d{1,3}\b|\bKZ\b|\bKazakhstan\b|\bTelegram\b|\bwallet\b|\bleak\b)/g);
  return (
    <span>
      {parts.map((part, index) => {
        const isToken = /^(?:@[\w.-]+|0x[a-fA-F0-9]{6,}|(?:\d{1,3}\.){3}\d{1,3}|KZ|Kazakhstan|Telegram|wallet|leak)$/i.test(part);
        return isToken ? <CodeTag key={`${part}-${index}`}>{part}</CodeTag> : <span key={`${part}-${index}`}>{part}</span>;
      })}
    </span>
  );
}

function StatusPill({ value }: { value: unknown }) {
  const normalized = String(value).toLowerCase();
  const state = normalized.includes("offline") || normalized.includes("down") || normalized.includes("error") ? "error" : normalized.includes("setup") || normalized.includes("warning") ? "warning" : "healthy";
  return (
    <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wider", state === "error" && "border border-rose-800/40 bg-rose-950/40 text-rose-400", state === "warning" && "border border-amber-800/40 bg-amber-950/30 text-amber-400", state === "healthy" && "border border-emerald-800/50 bg-emerald-950/35 text-emerald-400")}>{String(value)}</span>
  );
}

function HealthBar({ name, value, progress, color = "bg-emerald-500" }: { name: string; value: unknown; progress: number; color?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <MonoLabel className="truncate uppercase">{name}</MonoLabel>
        <StatusPill value={value} />
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <tr className="grid min-w-[820px] grid-cols-[64px_150px_minmax(280px,1fr)_112px_132px] items-center gap-4 border-b border-zinc-800/60 px-4 py-2.5 transition-colors hover:bg-zinc-900/35">
      <td><RiskBadge score={alert.risk_score} /></td>
      <td><span className="inline-flex max-w-full rounded-md border border-zinc-700/50 bg-zinc-800/40 px-2 py-1 font-mono text-xs text-zinc-400"><span className="truncate">{alert.category}</span></span></td>
      <td className="truncate text-sm leading-6 text-zinc-400"><HighlightedReason text={alert.reason_summary} /></td>
      <td><span className="w-fit rounded-md border border-zinc-800 bg-zinc-950/45 px-2 py-1 font-mono text-xs uppercase text-zinc-500">{alert.status}</span></td>
      <td className="truncate text-right font-mono text-xs text-zinc-500">{formatDate(alert.created_at)}</td>
    </tr>
  );
}

function ClusterRow({ item }: { item: CaseRecord }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-3">
      <div className="min-w-0">
        <div className="truncate font-sans text-sm font-bold tracking-tight text-zinc-100">{item.title}</div>
        <MonoLabel className="mt-1 uppercase">CASE-{String(item.id).padStart(4, "0")} / {item.status}</MonoLabel>
      </div>
      <RiskBadge score={item.overall_risk_score} />
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [riskTrends, setRiskTrends] = useState<Array<{ date: string; risk: number; alerts: number }>>([]);
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);

  useEffect(() => {
    api.summary().then(setSummary);
    api.alerts().then(setAlerts);
    api.riskTrends().then(setRiskTrends);
    api.categoryDistribution().then(setCategories);
  }, []);

  const stats = [
    { label: "Total crawled sources", value: summary?.total_crawled_sources ?? 0, icon: RadioTower, tone: "neutral" as const },
    { label: "High-risk alerts", value: summary?.high_risk_alerts ?? 0, icon: AlertTriangle, tone: "danger" as const },
    { label: "New entities", value: summary?.new_entities_discovered ?? 0, icon: GitBranch, tone: "intel" as const },
    { label: "High-risk wallets", value: summary?.high_risk_wallets ?? 0, icon: Wallet, tone: "violet" as const },
    { label: "Leak mentions", value: summary?.leak_mentions ?? 0, icon: Database, tone: "amber" as const }
  ];

  const healthEntries = useMemo(() => Object.entries(summary?.system_health ?? { api: "healthy", crawler: "active", database: "healthy" }), [summary]);
  const visibleAlerts = alerts.slice(0, 64);
  const clusters = summary?.top_risky_clusters ?? [];

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-6 overflow-hidden text-zinc-100">
      <section className="grid h-24 w-full flex-shrink-0 grid-cols-5 gap-4">
        {stats.map((stat) => <MetricCard key={stat.label} {...stat} />)}
      </section>

      <section className="grid min-h-0 w-full flex-1 grid-cols-3 gap-6">
        <Surface className="flex h-full min-h-0 flex-col p-5 col-span-2">
          <SectionTitle eyebrow="Signal analytics" title="Risk Trend" detail="Recharts scales inside h-full min-h-0 without forcing document scroll." />
          <div className="min-h-0 flex-1 rounded-lg border border-zinc-800/70 bg-zinc-950/35 p-3">
            <RiskTrendChart data={riskTrends} />
          </div>
        </Surface>

        <Surface className="flex h-full min-h-0 flex-col p-5">
          <SectionTitle eyebrow="Classifier mix" title="Categories" detail="Desaturated category volume by active alert class." />
          <div className="min-h-0 flex-1 rounded-lg border border-zinc-800/70 bg-zinc-950/35 p-3">
            <CategoryChart data={categories} />
          </div>
        </Surface>
      </section>

      <section className="grid h-[35vh] min-h-0 w-full flex-shrink-0 grid-cols-3 gap-6">
        <Surface className="col-span-2 flex h-full min-h-0 flex-col overflow-hidden p-0">
          <BorderBeam size={360} duration={18} borderWidth={1} colorFrom="#3f3f46" colorTo="#e11d48" delay={4} />
          <div className="flex-shrink-0 p-5 pb-3">
            <SectionTitle eyebrow="Advanced threat feed" title="Recent Alerts" detail="Only tbody scrolls; shell and page stay fixed." />
          </div>
          <div className="min-h-0 flex-1 overflow-x-auto">
            <table className="flex h-full min-w-[820px] flex-col overflow-hidden">
              <thead className="flex-shrink-0 border-y border-zinc-800/60 bg-zinc-950/35">
                <tr className="grid grid-cols-[64px_150px_minmax(280px,1fr)_112px_132px] gap-4 px-4 py-2 font-mono text-xs uppercase tracking-normal text-zinc-500">
                  <th className="text-left font-medium">Risk</th><th className="text-left font-medium">Category</th><th className="text-left font-medium">Reason</th><th className="text-left font-medium">Status</th><th className="text-right font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="block min-h-0 flex-1 overflow-y-auto pr-1">
                {visibleAlerts.length === 0 ? (
                  <tr className="block px-5 py-12 text-center font-mono text-xs text-zinc-500"><td className="block">No observations in the current window.</td></tr>
                ) : (
                  visibleAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
                )}
              </tbody>
            </table>
          </div>
        </Surface>

        <Surface className="flex h-full min-h-0 flex-col overflow-hidden p-5">
          <SectionTitle eyebrow="Ops telemetry" title="System Health" detail="Load bars and clusters fit inside the fixed right rail." />
          <div className="grid flex-shrink-0 gap-3">
            {healthEntries.slice(0, 3).map(([key, value], index) => <HealthBar key={key} name={key} value={value} progress={96 - index * 7} color={index === 1 ? "bg-cyan-500" : "bg-emerald-500"} />)}
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-normal text-zinc-500"><Siren className="size-3.5 text-rose-400" /> Risk clusters</div>
            <div className="grid gap-2">
              {clusters.slice(0, 8).map((item) => <ClusterRow key={item.id} item={item} />)}
              {clusters.length === 0 ? <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-3 font-mono text-xs text-zinc-500">No active high-risk clusters.</div> : null}
            </div>
          </div>
          <div className="mt-4 grid flex-shrink-0 grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-3"><Activity className="mb-2 size-4 text-emerald-400" /><div className="font-sans text-lg font-bold tracking-tight text-zinc-100">99.7%</div><MonoLabel className="uppercase">uptime</MonoLabel></div>
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-3"><Zap className="mb-2 size-4 text-cyan-400" /><div className="font-sans text-lg font-bold tracking-tight text-zinc-100">42ms</div><MonoLabel className="uppercase">api p95</MonoLabel></div>
          </div>
        </Surface>
      </section>
    </div>
  );
}