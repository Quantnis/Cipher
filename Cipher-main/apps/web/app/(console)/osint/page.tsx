"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, FileSearch, GitBranch, Loader2, Search, ShieldAlert, Signal, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { InvestigationResult } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const routeOptions = [
  ["auto", "Auto route"],
  ["web_search", "Web search / crawl"],
  ["telegram_public", "Telegram public"],
  ["darknet_authorized", "Authorized mock darknet"],
  ["entity_lookup", "Entity lookup"],
  ["crypto_wallet_lookup", "Crypto wallet"],
  ["leak_mention_lookup", "Leak mention"],
  ["mixed_full_scan", "Mixed full scan"],
  ["manual_text_analysis", "Manual text analysis"]
] as const;

const categories = [
  "",
  "suspected_illicit_vape_sales",
  "suspected_illicit_alcohol_sales",
  "suspected_narcotics_market",
  "suspected_drop_account_recruitment",
  "suspected_crypto_fraud",
  "suspected_database_leak",
  "suspected_document_forgery",
  "suspected_payment_fraud",
  "suspicious_marketplace",
  "suspicious_but_unclear",
  "benign"
];

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export default function OsintPage() {
  const [input, setInput] = useState("vape delivery Almaty telegram usdt");
  const [route, setRoute] = useState("auto");
  const [category, setCategory] = useState("");
  const [maxResults, setMaxResults] = useState(24);
  const [threshold, setThreshold] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvestigationResult | null>(null);

  const topSignal = useMemo(() => [...(result?.signals ?? [])].sort((a, b) => asNumber(b.risk_score) - asNumber(a.risk_score))[0], [result]);

  async function runInvestigation() {
    setLoading(true);
    try {
      const payload = await api.createInvestigation({
        input_text: input,
        source_mode: route,
        category: category || undefined,
        max_results: maxResults,
        risk_threshold: threshold,
        run_immediately: true
      });
      setResult(payload);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New Investigation"
        description="Run a legally bounded OSINT investigation across public web, public Telegram mock data, authorized mock darknet samples, wallet/entity lookup, and manual evidence."
      />
      <div className="grid min-h-0 gap-4 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Investigation input</CardTitle>
            <CardDescription>Auto-router infers the route. Analysts can override it when scope is known.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Free-text, URL, handle, wallet, phone, or evidence</label>
              <Textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-32" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Source mode</label>
                <Select value={route} onChange={(event) => setRoute(event.target.value)}>
                  {routeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Category hint</label>
                <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => <option key={item || "auto"} value={item}>{item || "Auto classify"}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Max results</label>
                <Input type="number" min={1} max={100} value={maxResults} onChange={(event) => setMaxResults(Number(event.target.value))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Risk threshold</label>
                <Input type="number" min={0} max={100} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
              </div>
            </div>
            <Button className="w-full" variant="solid" onClick={runInvestigation} disabled={loading || !input.trim()}>
              {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
              {loading ? "Running investigation..." : "Run investigation"}
            </Button>
            <div className="rounded-md border border-signal-info/20 bg-signal-info/[0.06] p-4 text-sm leading-6 text-zinc-400">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-signal-accent"><ShieldAlert className="size-4" /> Legal boundary</div>
              Collectors use public, analyst-authorized, manual, or synthetic local sources only. Private group bypass, credential theft, purchasing, and evasion are not implemented.
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-0 gap-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-[0.18em] text-ink-muted">Route</div><div className="mt-2 text-sm font-semibold text-ink-primary">{result?.investigation?.investigation_type ?? "not run"}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-[0.18em] text-ink-muted">Documents</div><div className="mt-2 font-mono text-2xl text-ink-primary">{result?.documents?.length ?? 0}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-[0.18em] text-ink-muted">Entities</div><div className="mt-2 font-mono text-2xl text-ink-primary">{result?.entities?.length ?? 0}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-[0.18em] text-ink-muted">Graph</div><div className="mt-2 font-mono text-2xl text-ink-primary">{result?.graph?.nodes?.length ?? 0}/{result?.graph?.edges?.length ?? 0}</div></CardContent></Card>
          </div>

          {topSignal ? (
            <Card>
              <CardHeader><CardTitle>Top risk signal</CardTitle><CardDescription>Explainable score from category, source, entities, recency, location, and classifier confidence.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[120px_1fr_220px]">
                <RiskBadge score={asNumber(topSignal.risk_score)} />
                <div>
                  <div className="font-semibold text-ink-primary">{String(topSignal.title ?? topSignal.category)}</div>
                  <p className="mt-2 text-sm leading-6 text-ink-secondary">{String(topSignal.snippet ?? "").slice(0, 420)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{(Array.isArray(topSignal.key_entities) ? topSignal.key_entities : []).slice(0, 8).map((entity: any, index: number) => <Badge key={String(entity.value_redacted) + "-" + index} variant="outline">{entity.type}: {entity.value_redacted}</Badge>)}</div>
                </div>
                <div className="space-y-2 text-sm text-ink-secondary">
                  <div><span className="text-ink-muted">Level:</span> {String(topSignal.risk_level ?? "n/a")}</div>
                  <div><span className="text-ink-muted">Category:</span> {String(topSignal.category ?? "n/a")}</div>
                  <div><span className="text-ink-muted">Source:</span> {String(topSignal.source_type ?? "n/a")}</div>
                  {topSignal.id ? <Button asChild variant="outline" className="mt-2 w-full"><Link href="/threats"><Signal data-icon="inline-start" /> Open signals</Link></Button> : null}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="flex min-h-40 items-center justify-center text-sm text-ink-secondary"><FileSearch className="mr-2 size-4" /> Run an investigation to populate results.</CardContent></Card>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Collected documents</CardTitle><CardDescription>Source attribution, collection time, and evidence hash are retained.</CardDescription></CardHeader>
              <CardContent className="max-h-80 space-y-3 overflow-y-auto">
                {(result?.documents ?? []).slice(0, 12).map((doc: any) => (
                  <div key={String(doc.id ?? doc.raw_item_id)} className="rounded-md border border-slate-border bg-slate-base/30 p-3">
                    <div className="flex items-start justify-between gap-3"><div className="font-semibold text-ink-primary">{String(doc.title ?? "Untitled")}</div><Badge variant="outline">{String(doc.sourceType ?? doc.source_type)}</Badge></div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-secondary">{String(doc.content ?? "")}</p>
                    <div className="mt-2 break-all font-mono text-[11px] text-ink-muted">{String(doc.evidenceHash ?? doc.content_hash ?? "")}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Next steps</CardTitle><CardDescription>Analyst actions generated for this run.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {(result?.next_steps ?? ["Run an investigation", "Review signals", "Create case from verified cluster"]).map((step) => <div key={step} className="flex items-center gap-3 rounded-md border border-slate-border bg-slate-base/30 p-3 text-sm text-ink-secondary"><ArrowRight className="size-4 text-signal-accent" />{step}</div>)}
                <Button asChild variant="outline" className="w-full"><Link href="/graph"><GitBranch data-icon="inline-start" /> Open graph explorer</Link></Button>
                <Button asChild variant="outline" className="w-full"><Link href="/cases"><Sparkles data-icon="inline-start" /> Create or review case</Link></Button>
                {result?.investigation?.created_at ? <div className="font-mono text-xs text-ink-muted">Created {formatDate(result.investigation.created_at)}</div> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
