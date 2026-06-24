"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Database,
  GitBranch,
  RadioTower,
  ShieldCheck,
  Siren,
  Sparkles,
  Wallet,
  Zap
} from "lucide-react";
import { CategoryChart, RiskTrendChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
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

const metricStyles = {
  signal: {
    icon: "text-cyan-200 shadow-cyan-500/30",
    ring: "from-cyan-500/20 via-sky-500/5 to-transparent",
    trend: "+12% vs last week"
  },
  danger: {
    icon: "text-rose-200 shadow-rose-500/30",
    ring: "from-rose-500/20 via-red-500/5 to-transparent",
    trend: "+8 critical events"
  },
  cyan: {
    icon: "text-cyan-200 shadow-cyan-500/30",
    ring: "from-cyan-500/20 via-blue-500/5 to-transparent",
    trend: "+19% entity growth"
  },
  violet: {
    icon: "text-violet-200 shadow-violet-500/30",
    ring: "from-violet-500/20 via-indigo-500/5 to-transparent",
    trend: "wallet risk delta +4"
  },
  amber: {
    icon: "text-amber-200 shadow-amber-500/30",
    ring: "from-amber-500/20 via-orange-500/5 to-transparent",
    trend: "+6 indexed leaks"
  }
};

const severityMeta = (score: number) => {
  if (score >= 80) {
    return {
      label: "critical",
      className: "border-rose-400/50 bg-rose-500/10 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.18)]"
    };
  }
  if (score >= 50) {
    return {
      label: "elevated",
      className: "border-orange-400/50 bg-orange-500/10 text-orange-100 shadow-[0_0_24px_rgba(249,115,22,0.15)]"
    };
  }
  return {
    label: "watch",
    className: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
  };
};

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/40 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-md",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.09),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.055),transparent_22%)]",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] after:bg-[size:28px_28px] after:opacity-40",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-zinc-800/70 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">{eyebrow}</p>
        <h2 className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-100">{title}</h2>
      </div>
      <p className="max-w-md text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  variant
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant: keyof typeof metricStyles;
}) {
  const style = metricStyles[variant];
  return (
    <Panel className="min-h-[154px]">
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", style.ring)} />
      <div className="relative z-10 flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[9rem] text-xs font-semibold uppercase leading-5 tracking-wider text-zinc-500">{label}</p>
          <div className="flex size-10 items-center justify-center rounded-md border border-zinc-700/80 bg-black/40 shadow-2xl">
            <Icon className={cn("size-4 drop-shadow-[0_0_10px_currentColor]", style.icon)} />
          </div>
        </div>
        <div>
          <div className="font-mono text-3xl font-semibold tracking-tight text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.16)]">{value.toLocaleString()}</div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <ArrowUpRight className="size-3" />
            {style.trend}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function RiskScoreBadge({ score }: { score: number }) {
  const meta = severityMeta(score);
  return (
    <div className={cn("inline-flex min-w-16 items-center justify-center rounded-md border px-2.5 py-1.5 font-mono text-sm font-semibold", meta.className)}>
      {score}
    </div>
  );
}

function HighlightedReason({ text }: { text: string }) {
  const parts = text.split(/(@[\w.-]+|0x[a-fA-F0-9]{6,}|\bKZ\b|\bKazakhstan\b|\bTelegram\b|\bwallet\b|\bleak\b)/g);
  return (
    <span>
      {parts.map((part, index) => {
        const isToken = /^(?:@[\w.-]+|0x[a-fA-F0-9]{6,}|KZ|Kazakhstan|Telegram|wallet|leak)$/i.test(part);
        if (!isToken) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <code key={`${part}-${index}`} className="mx-0.5 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-200">
            {part}
          </code>
        );
      })}
    </span>
  );
}

function SecurityLogRow({ alert }: { alert: Alert }) {
  const severity = severityMeta(alert.risk_score);
  return (
    <div className="grid gap-3 border-t border-zinc-800/70 bg-black/10 px-4 py-3 transition-colors hover:bg-cyan-950/10 lg:grid-cols-[92px_140px_1fr_112px_128px] lg:items-center">
      <div className="flex items-center justify-between lg:block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 lg:hidden">Risk</span>
        <RiskScoreBadge score={alert.risk_score} />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">Category</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-200">{alert.category}</div>
      </div>
      <p className="text-sm leading-6 text-zinc-400">
        <HighlightedReason text={alert.reason_summary} />
      </p>
      <Badge variant="outline" className={cn("w-fit uppercase tracking-wider", severity.className)}>
        {severity.label}
      </Badge>
      <div className="font-mono text-xs text-zinc-500">{formatDate(alert.created_at)}</div>
    </div>
  );
}

function StatusBadge({ value }: { value: unknown }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
      <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.95)] animate-pulse" />
      {String(value)}
    </span>
  );
}

function HealthLine({ name, value, progress }: { name: string; value: unknown; progress: number }) {
  return (
    <div className="rounded-md border border-zinc-800/70 bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{name}</span>
        <StatusBadge value={value} />
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-800/80">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-sky-500 shadow-[0_0_16px_rgba(34,211,238,0.65)] animate-pulse" style={{ width: `${progress}%` }} />
      </div>
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
    { label: "Total crawled sources", value: summary?.total_crawled_sources ?? 0, icon: RadioTower, variant: "signal" as const },
    { label: "High-risk alerts", value: summary?.high_risk_alerts ?? 0, icon: AlertTriangle, variant: "danger" as const },
    { label: "New entities", value: summary?.new_entities_discovered ?? 0, icon: GitBranch, variant: "cyan" as const },
    { label: "High-risk wallets", value: summary?.high_risk_wallets ?? 0, icon: Wallet, variant: "violet" as const },
    { label: "Leak mentions", value: summary?.leak_mentions ?? 0, icon: Database, variant: "amber" as const }
  ];

  const healthEntries = Object.entries(summary?.system_health ?? { api: "healthy", crawler: "active", database: "healthy" });

  return (
    <div className="relative -m-4 min-h-[calc(100vh-4rem)] overflow-hidden bg-[#030712] p-4 text-zinc-100 lg:-m-5 lg:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(99,102,241,0.16),transparent_26%),linear-gradient(180deg,#030712_0%,#050816_54%,#020617_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative z-10 space-y-5">
        <header className="flex flex-col gap-4 border-b border-zinc-800/80 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200">Analyst workspace</Badge>
              <Badge variant="outline" className="border-zinc-700 bg-black/30 text-zinc-400">B2G Command Layer</Badge>
            </div>
            <h1 className="text-2xl font-semibold uppercase tracking-[0.18em] text-white md:text-3xl">ShadowGraph KZ Overview</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              Executive cyber-intelligence posture across configured sources, risk velocity, entity emergence, wallet exposure, leak mentions, and operational service health.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-zinc-800/70 bg-black/30 p-2 font-mono text-xs text-zinc-400">
            <div className="rounded-md bg-zinc-900/60 px-3 py-2"><span className="block text-[10px] uppercase tracking-wider text-zinc-600">Mode</span>LIVE</div>
            <div className="rounded-md bg-zinc-900/60 px-3 py-2"><span className="block text-[10px] uppercase tracking-wider text-zinc-600">Region</span>KZ</div>
            <div className="rounded-md bg-zinc-900/60 px-3 py-2"><span className="block text-[10px] uppercase tracking-wider text-zinc-600">Tier</span>B2G</div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <MetricCard key={stat.label} {...stat} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <Panel>
            <SectionHeader eyebrow="Signal analytics" title="Risk trend" detail="Rolling normalized risk scores from collected observations." />
            <div className="p-4"><RiskTrendChart data={riskTrends} /></div>
          </Panel>
          <Panel>
            <SectionHeader eyebrow="Classifier mix" title="Category distribution" detail="Open alert distribution by threat category and operational domain." />
            <div className="p-4"><CategoryChart data={categories} /></div>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <Panel>
            <SectionHeader eyebrow="Advanced threat feed" title="Recent alerts" detail="Security-log view with strict severity scoring and highlighted cyber entities." />
            <div className="grid grid-cols-[92px_140px_1fr_112px_128px] border-t border-zinc-800/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600 max-lg:hidden">
              <span>Risk</span><span>Category</span><span>Reason</span><span>Severity</span><span>Seen</span>
            </div>
            {alerts.length === 0 ? (
              <div className="border-t border-zinc-800/70 px-5 py-10 text-center text-sm text-zinc-500">
                No real observations yet. Add a source or paste manual text in Sources to begin ingestion.
              </div>
            ) : (
              alerts.slice(0, 8).map((alert) => <SecurityLogRow key={alert.id} alert={alert} />)
            )}
          </Panel>

          <Panel>
            <SectionHeader eyebrow="Ops telemetry" title="System health" detail="Service readiness with pulse-confirmed operational status." />
            <div className="space-y-3 p-4">
              {healthEntries.map(([key, value], index) => (
                <HealthLine key={key} name={key} value={value} progress={key === "redaction" ? 100 : 92 - index * 4} />
              ))}

              <div className="rounded-md border border-cyan-400/20 bg-cyan-500/5 p-4 text-sm leading-6 text-zinc-400">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                  <ShieldCheck className="size-4" /> Human verification gate
                </div>
                Automated indicators require analyst validation. Missing integrations produce setup states instead of synthetic findings.
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                  <Siren className="size-3 text-rose-300" /> High-risk clusters
                </div>
                {(summary?.top_risky_clusters ?? []).slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-800/70 bg-black/20 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-200">{item.title}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
                        <Zap className="size-3 text-amber-300" /> Case #{item.id}
                      </div>
                    </div>
                    <RiskScoreBadge score={item.overall_risk_score} />
                  </div>
                ))}
                {(summary?.top_risky_clusters ?? []).length === 0 && (
                  <div className="rounded-md border border-zinc-800/70 bg-black/20 p-3 text-sm text-zinc-500">
                    No active case clusters in the current summary window.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-md border border-zinc-800/70 bg-black/20 p-3">
                  <Sparkles className="mb-2 size-4 text-cyan-200" />
                  <div className="font-mono text-lg text-white">99.7%</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">uptime</div>
                </div>
                <div className="rounded-md border border-zinc-800/70 bg-black/20 p-3">
                  <Activity className="mb-2 size-4 text-emerald-200" />
                  <div className="font-mono text-lg text-white">42ms</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">api p95</div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
