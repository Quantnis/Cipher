"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Archive, CheckSquare, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { Alert, Evidence } from "@/lib/types";
import { categoryColor, hexToRgba } from "@/lib/colors";
import { formatDate } from "@/lib/utils";

const severityMin: Record<string, number> = { all: 0, critical: 80, high: 60, medium: 40, low: 0 };

export default function ThreatsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<(Alert & { evidence?: Evidence[] }) | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh(selectFirst = false) {
    setRefreshing(true);
    const items = await api.alerts();
    setAlerts(items);
    if (selectFirst && items[0]) setSelected(await api.alert(items[0].id));
    setRefreshing(false);
  }

  useEffect(() => { refresh(true); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const routeTokens = [params.get("city_from"), params.get("city_to"), params.get("category")].filter(Boolean);
    const q = params.get("q");
    if (q || routeTokens.length) setQuery(q ?? routeTokens.join(" "));
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => refresh(false), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const filtered = useMemo(() => alerts.filter((alert) => {
    const min = severityMin[severity] ?? 0;
    if (alert.risk_score < min) return false;
    if (severity === "low" && alert.risk_score >= 40) return false;
    if (status !== "all" && alert.status !== status) return false;
    return `${alert.title} ${alert.category} ${alert.reason_summary}`.toLowerCase().includes(query.toLowerCase());
  }), [alerts, query, status, severity]);

  async function selectAlert(alert: Alert) {
    setSelected(await api.alert(alert.id));
  }

  async function createCase(alert: Alert) {
    const item = await api.createCase(`Case from ${alert.title}`) as any;
    await api.addAlertToCase(item.id, alert.id);
    toast.success("Case created and alert added");
  }

  async function bulkCreateCase() {
    const created = await api.bulkCreateCaseFromAlerts(checked);
    setChecked([]);
    await refresh(false);
    toast.success(`Case created: ${created.title ?? "selected alerts"}`);
  }

  function toggle(id: number) {
    setChecked((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PageHeader title="Live Monitoring" description="Filter, review, assign, escalate, close, de-duplicate, and convert collected public-source indicators into investigation cases." action={<div className="flex items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-signal-safe/30 bg-signal-safe/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-signal-safe"><span className="size-2 rounded-full bg-signal-safe animate-pulse" /> Auto-refresh 30s</span><Button variant="outline" onClick={() => refresh(false)}><RefreshCw data-icon="inline-start" className={refreshing ? "animate-spin" : ""} /> Refresh</Button></div>} />
      <div className="mb-4 flex flex-shrink-0 flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-ink-muted" /><Input className="pl-9" placeholder="Search category, source, entity, or reason" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <Select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severity</option><option value="critical">Critical 80+</option><option value="high">High 60+</option><option value="medium">Medium 40+</option><option value="low">Low</option></Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option>New</option><option>Reviewing</option><option>Escalated</option><option>Closed</option></Select>
        <Button variant="solid" disabled={checked.length === 0} onClick={bulkCreateCase}><CheckSquare data-icon="inline-start" /> Create case ({checked.length})</Button>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card className="flex min-h-0 flex-col">
          <CardHeader><CardTitle>Recent suspicious signals</CardTitle><CardDescription>All sensitive values are redacted by default and every signal keeps provenance.</CardDescription></CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <div className="grid flex-shrink-0 grid-cols-[42px_82px_minmax(180px,220px)_minmax(260px,1fr)_105px_118px] border-b border-slate-border bg-slate-surface/95 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-muted max-lg:hidden"><span></span><span>Risk</span><span>Category</span><span>Reason</span><span>Status</span><span>Last seen</span></div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? <div className="px-5 py-10 text-center text-sm text-ink-secondary">No alerts yet. Configure a source or ingest manual public text to begin monitoring.</div> : null}
              {filtered.map((alert) => (
                <div key={alert.id} onClick={() => selectAlert(alert)} className="grid min-h-14 cursor-pointer gap-3 border-b border-slate-border px-4 py-2 transition hover:bg-slate-elevated lg:h-14 lg:grid-cols-[42px_82px_minmax(180px,220px)_minmax(260px,1fr)_105px_118px] lg:items-center">
                  <input aria-label={`Select alert ${alert.id}`} type="checkbox" checked={checked.includes(alert.id)} onChange={() => toggle(alert.id)} onClick={(e) => e.stopPropagation()} className="size-4 accent-[#2F81F7]" />
                  {alert.category === "hidden_identity_link" ? <span className="inline-flex size-11 items-center justify-center rounded-lg border border-signal-warning/40 bg-signal-warning/10 font-mono text-2xl text-signal-warning">~</span> : <RiskBadge score={alert.risk_score} />}
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="inline-flex min-w-0 max-w-full rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: hexToRgba(categoryColor(alert.category), 0.12), borderColor: hexToRgba(categoryColor(alert.category), 0.3), color: categoryColor(alert.category) }}><span className="truncate">{alert.category}</span></div>
                    {(alert.duplicate_count ?? 1) > 1 ? <Badge className="shrink-0" variant="warning">dup x{alert.duplicate_count}</Badge> : null}
                  </div>
                  <div className="min-w-0 truncate text-sm leading-6 text-ink-secondary" title={alert.reason_summary}>{alert.reason_summary}</div>
                  <Badge className="w-fit" variant="outline">{alert.status}</Badge>
                  <div className="truncate font-mono text-xs text-ink-secondary">{formatDate(alert.created_at)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="flex min-h-0 flex-col">
          <CardHeader><CardTitle>Alert detail</CardTitle><CardDescription>Full analyst context and audit-logged actions.</CardDescription></CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {selected ? (
              <div className="flex flex-col gap-4">
                <div>{selected.category === "hidden_identity_link" ? <span className="inline-flex size-12 items-center justify-center rounded-lg border border-signal-warning/40 bg-signal-warning/10 font-mono text-2xl text-signal-warning">~</span> : <RiskBadge score={selected.risk_score} />}<h2 className="mt-3 text-lg font-semibold text-ink-primary">{selected.title}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{selected.reason_summary}</p></div>
                <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-md border border-slate-border bg-slate-base/30 p-3"><div className="text-[10px] uppercase tracking-wider text-ink-muted">Confidence</div><div className="font-mono text-xl text-ink-primary">{Math.round(selected.confidence * 100)}%</div></div><div className="rounded-md border border-slate-border bg-slate-base/30 p-3"><div className="text-[10px] uppercase tracking-wider text-ink-muted">Duplicates</div><div className="font-mono text-xl text-ink-primary">{selected.duplicate_count ?? 1}</div></div></div>
                {selected.content_hash ? <div className="rounded-md border border-slate-border bg-slate-base/30 p-3"><div className="text-[10px] uppercase tracking-wider text-ink-muted">Content hash</div><div className="mt-1 break-all font-mono text-xs text-ink-secondary">{selected.content_hash}</div></div> : null}
                <div className="rounded-md border border-slate-border bg-slate-base/30 p-3"><div className="mb-2 text-[10px] uppercase tracking-wider text-ink-muted">Evidence</div>{(selected.evidence ?? []).length === 0 ? <p className="text-sm text-ink-secondary">No evidence returned for this alert.</p> : selected.evidence?.map((item) => <div key={item.id} className="mb-2 font-mono text-xs text-ink-secondary">EVD-{String(item.id).padStart(4, "0")} {item.sha256_hash}</div>)}</div>
                <Button variant="solid" onClick={() => createCase(selected)}><Archive data-icon="inline-start" /> Create case from alert</Button>
                {selected.category === "hidden_identity_link" ? <Button asChild variant="outline"><Link href="/graph">Open on graph</Link></Button> : null}
                {selected.primary_entity_id && <Button asChild variant="outline"><Link href={`/entities/${selected.primary_entity_id}`}>Open entity profile</Link></Button>}
              </div>
            ) : <div className="rounded-md border border-slate-border bg-slate-base/30 p-4 text-sm text-ink-secondary">Select an alert to inspect details.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );

}
