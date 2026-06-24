"use client";

import { useState } from "react";
import { Bitcoin, DatabaseZap, Globe2, Radar, Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "crypto", label: "Crypto Tracker", icon: Bitcoin },
  { id: "leaks", label: "Leak Scanner", icon: DatabaseZap },
  { id: "domain", label: "Domain Intel", icon: Globe2 },
  { id: "social", label: "Social Scanner", icon: Radar }
] as const;

type TabId = (typeof tabs)[number]["id"];

function JsonPanel({ value }: { value: unknown }) {
  return <pre className="max-h-[520px] overflow-auto rounded-md border border-zinc-800/70 bg-black/35 p-4 font-mono text-xs leading-6 text-zinc-300">{JSON.stringify(value, null, 2)}</pre>;
}

function ResultCards({ result }: { result: any }) {
  if (!result || Object.keys(result).length === 0) return <div className="rounded-md border border-zinc-800/70 bg-black/25 p-6 text-sm text-zinc-500">Run a query to populate this intelligence panel.</div>;
  return (
    <div className="space-y-4">
      {typeof result.risk_score === "number" ? <div className="flex items-center justify-between rounded-md border border-rose-400/25 bg-rose-500/10 p-4"><span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Risk score</span><span className="font-mono text-3xl font-semibold text-white">{result.risk_score}</span></div> : null}
      {Array.isArray(result.risk_tags) ? <div className="flex flex-wrap gap-2">{result.risk_tags.map((tag: string) => <Badge key={tag} variant="warning">{tag}</Badge>)}</div> : null}
      {Array.isArray(result.breaches) ? <div className="grid gap-2">{result.breaches.length === 0 ? <div className="rounded-md border border-zinc-800/70 bg-black/25 p-3 text-sm text-zinc-500">No breach rows returned.</div> : result.breaches.map((item: any) => <div key={`${item.name}-${item.date}`} className="rounded-md border border-zinc-800/70 bg-black/25 p-3"><div className="font-semibold text-zinc-100">{item.name}</div><div className="font-mono text-xs text-zinc-500">{item.date}</div><div className="mt-2 flex flex-wrap gap-2">{(item.data_classes ?? []).map((klass: string) => <Badge key={klass} variant="outline">{klass}</Badge>)}</div></div>)}</div> : null}
      {Array.isArray(result.matches) ? <div className="grid gap-2">{result.matches.map((item: any, index: number) => <div key={index} className="rounded-md border border-zinc-800/70 bg-black/25 p-3"><div className="mb-1 flex items-center justify-between"><span className="font-semibold text-zinc-100">{item.channel}</span><span className="font-mono text-xs text-zinc-600">{item.timestamp ?? "n/a"}</span></div><p className="text-sm leading-6 text-zinc-400">{item.text_redacted}</p><div className="mt-2 flex flex-wrap gap-2">{(item.entities ?? []).map((entity: string) => <code key={entity} className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-cyan-100">{entity}</code>)}</div></div>)}</div> : null}
      <JsonPanel value={result} />
    </div>
  );
}

export default function OsintPage() {
  const [active, setActive] = useState<TabId>("crypto");
  const [wallet, setWallet] = useState("0x0000000000000000000000000000000000000000");
  const [chain, setChain] = useState("auto");
  const [indicator, setIndicator] = useState("+77001234567");
  const [domain, setDomain] = useState("example.org");
  const [social, setSocial] = useState("вейп алкоголь дропы крипто");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>({});

  async function run() {
    setLoading(true);
    try {
      if (active === "crypto") setResult(await api.osintCrypto(wallet, chain));
      if (active === "leaks") setResult(await api.osintLeaks(indicator));
      if (active === "domain") setResult(await api.osintDomain(domain));
      if (active === "social") setResult(await api.osintSocial(social));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="OSINT Intelligence" description="Authorized enrichment console for crypto wallets, breach exposure, domains, and public social indicators. All keys stay on the backend." />
      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Collection Modules</CardTitle>
            <CardDescription>Blockchair, HIBP, RDAP/DNS, and Telegram Bot API backend adapters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => { setActive(tab.id); setResult({}); }} className={cn("flex items-center gap-3 rounded-md border px-3 py-3 text-left transition", active === tab.id ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100" : "border-zinc-800/70 bg-black/25 text-zinc-500 hover:border-cyan-400/25 hover:text-zinc-200")}>
                    <Icon className="size-4" />
                    <span className="text-sm font-semibold uppercase tracking-[0.14em]">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {active === "crypto" ? <div className="space-y-3"><Input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="BTC/ETH/TRX wallet address" /><Select value={chain} onChange={(e) => setChain(e.target.value)}><option value="auto">Auto detect</option><option value="bitcoin">Bitcoin</option><option value="ethereum">Ethereum</option><option value="tron">TRON / USDT TRC20</option></Select></div> : null}
            {active === "leaks" ? <Input value={indicator} onChange={(e) => setIndicator(e.target.value)} placeholder="email or +7 phone" /> : null}
            {active === "domain" ? <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="domain or URL" /> : null}
            {active === "social" ? <Input value={social} onChange={(e) => setSocial(e.target.value)} placeholder="username or keywords" /> : null}

            <Button className="w-full" variant="solid" onClick={run} disabled={loading}><Search data-icon="inline-start" /> {loading ? "Running..." : "Run OSINT query"}</Button>
            <div className="rounded-md border border-cyan-400/20 bg-cyan-500/5 p-4 text-sm leading-6 text-zinc-400">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200"><ShieldAlert className="size-4" /> Legal guardrail</div>
              Use only public/legal sources and analyst-approved indicators. Raw PII is redacted or represented by hashes in downstream evidence.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{tabs.find((tab) => tab.id === active)?.label}</CardTitle><CardDescription>Backend enrichment result and extracted risk indicators.</CardDescription></CardHeader>
          <CardContent><ResultCards result={result} /></CardContent>
        </Card>
      </div>
    </>
  );
}
