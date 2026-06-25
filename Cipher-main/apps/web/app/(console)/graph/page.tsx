"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ThreatGraph } from "@/components/threat-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { GraphPayload } from "@/lib/types";

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [timeline, setTimeline] = useState(false);
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState("");
  useEffect(() => { api.graph().then(setGraph); }, []);
  async function reindexFingerprints() {
    const result = await api.fingerprintReindex() as any;
    toast.message(result.status === "started" ? `Fingerprint reindex started: ${result.entities} entities` : "Fingerprint reindex failed");
  }
  async function rebuild() {
    const result = await api.rebuildGraph() as any;
    toast.message(result.status === "completed" ? `Graph rebuilt: ${result.nodes} nodes / ${result.clusters ?? 0} clusters` : "Graph rebuild failed");
    setGraph(await api.graph());
  }
  const filtered = useMemo(() => {
    if (!graph) return null;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const nodes = graph.nodes.filter((node) => {
      const text = `${node.label} ${node.type}`.toLowerCase();
      if (query && !text.includes(query.toLowerCase())) return false;
      if (!timeline) return true;
      const raw = String(node.metadata?.captured_at ?? node.metadata?.created_at ?? node.metadata?.first_seen ?? "");
      const time = raw ? Date.parse(raw) : Date.now();
      return Number.isNaN(time) ? true : time >= cutoff;
    });
    const keep = new Set(nodes.map((node) => node.id));
    return { ...graph, nodes, edges: graph.edges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)) };
  }, [graph, query, timeline, days]);
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PageHeader title="Threat Graph" description="Explore redacted sources, aliases, wallets, phones, cities, products, leak mentions, categories, clusters, and case relationships." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={reindexFingerprints}><RefreshCw data-icon="inline-start" /> Reindex fingerprints</Button><Button variant="outline" onClick={rebuild}><RefreshCw data-icon="inline-start" /> Rebuild graph</Button></div>} />
      <div className="mb-4 grid flex-shrink-0 gap-3 md:grid-cols-[1fr_180px_180px_180px]">
        <Input placeholder="Search entity" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select defaultValue="all"><option value="all">All risks</option><option>70+</option><option>85+</option></Select>
        <Select defaultValue="all"><option value="all">All entities</option><option>CryptoWallet</option><option>TelegramHandle</option><option>LeakMention</option></Select>
        <Select defaultValue="all"><option value="all">All categories</option><option>illegal_vape_sales</option><option>data_leak_mentions</option><option>phishing</option><option>dropper_recruitment</option><option>suspicious_crypto_wallet</option></Select>
      </div>
      <div className="mb-4 flex flex-shrink-0 flex-col gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-4 backdrop-blur-md md:flex-row md:items-center md:justify-between">
        <button onClick={() => setTimeline((value) => !value)} className="flex items-center gap-2 text-sm text-zinc-300"><Clock className="size-4 text-signal-accent" /> Timeline View <Badge variant={timeline ? "cyan" : "outline"}>{timeline ? "on" : "off"}</Badge></button>
        <div className="flex flex-1 items-center gap-3 md:max-w-lg"><span className="font-mono text-xs text-zinc-500">{days}d</span><input className="w-full accent-[#2F81F7]" type="range" min="1" max="180" value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>
        <Badge variant="outline">{filtered?.clusters?.length ?? 0} clusters</Badge>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {filtered && <ThreatGraph graph={filtered} />}
      </div>
    </div>
  );
}
