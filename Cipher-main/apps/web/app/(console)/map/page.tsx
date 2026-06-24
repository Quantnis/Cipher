"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Radar } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";

 type Signal = { city: string; latitude: number; longitude: number; total_signals: number; high_risk_signals: number; max_risk: number; top_category: string };

export default function KazakhstanMapPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selected, setSelected] = useState<Signal | null>(null);
  useEffect(() => { api.mapSignals().then((items) => { setSignals(items); setSelected(items[0] ?? null); }); }, []);
  const top = useMemo(() => [...signals].sort((a, b) => b.max_risk - a.max_risk).slice(0, 8), [signals]);
  const project = (lat: number, lon: number) => {
    const x = ((lon - 46) / (88 - 46)) * 100;
    const y = (1 - (lat - 40) / (56 - 40)) * 100;
    return { left: `${Math.min(94, Math.max(6, x))}%`, top: `${Math.min(88, Math.max(10, y))}%` };
  };

  return (
    <>
      <PageHeader title="Kazakhstan Risk Map" description="City-level visualization of collected public-source indicators. Exact coordinates are not inferred when only city hints exist." />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Select defaultValue="all"><option value="all">All categories</option><option>illegal_vape_sales</option><option>data_leak_mentions</option><option>phishing</option></Select>
        <Select defaultValue="30"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></Select>
        <Select defaultValue="all"><option value="all">All sources</option><option>web</option><option>telegram</option><option>manual_upload</option></Select>
        <Select defaultValue="all"><option value="all">All severity</option><option>high</option><option>critical</option></Select>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <CardHeader><CardTitle>Signal geography</CardTitle><CardDescription>Markers are approximate city coordinates, not precise incident locations.</CardDescription></CardHeader>
          <CardContent>
            <div className="relative h-[620px] overflow-hidden rounded-lg border border-zinc-800/70 bg-[#030712] shadow-inner">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,0.16),transparent_30%),linear-gradient(rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.045)_1px,transparent_1px)] bg-[size:auto,34px_34px,34px_34px]" />
              <div className="absolute left-[9%] top-[20%] h-[50%] w-[80%] rounded-[46%] border border-cyan-300/20 bg-cyan-300/[0.025] shadow-[0_0_80px_rgba(34,211,238,0.08)]" />
              <div className="absolute left-[15%] top-[29%] h-[30%] w-[66%] rounded-[48%] border border-indigo-300/10" />
              <div className="absolute left-5 top-5 flex items-center gap-2 rounded-md border border-zinc-800/80 bg-black/45 px-3 py-2 font-mono text-xs uppercase tracking-wider text-cyan-100 backdrop-blur">
                <Radar className="size-4 text-cyan-200" /> KZ geospatial intelligence layer
              </div>
              {signals.length === 0 && <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-zinc-500">No city-level signals yet. Ingest public text containing Kazakhstan city hints to populate the map.</div>}
              {signals.map((signal) => {
                const pos = project(signal.latitude, signal.longitude);
                const size = Math.min(48, 18 + signal.total_signals * 4);
                const critical = signal.max_risk >= 80;
                return (
                  <button
                    key={signal.city}
                    onClick={() => setSelected(signal)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-black/50 text-cyan-100 backdrop-blur transition hover:scale-110"
                    style={{ ...pos, width: size, height: size, borderColor: critical ? "rgba(251,113,133,.65)" : "rgba(103,232,249,.55)", boxShadow: critical ? "0 0 34px rgba(244,63,94,.32)" : "0 0 30px rgba(34,211,238,.24)" }}
                    title={signal.city}
                  >
                    <MapPin className="mx-auto size-4 drop-shadow-[0_0_8px_currentColor]" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>City details</CardTitle><CardDescription>Aggregated from extracted city entities.</CardDescription></CardHeader>
            <CardContent>
              {selected ? <div className="flex flex-col gap-3 text-sm"><div className="flex items-center justify-between"><span className="text-lg font-semibold text-white">{selected.city}</span><RiskBadge score={selected.max_risk} /></div><div className="grid grid-cols-2 gap-2"><div className="rounded-md border border-zinc-800/70 bg-black/25 p-3"><div className="text-[10px] uppercase tracking-wider text-zinc-600">Signals</div><div className="font-mono text-xl text-white">{selected.total_signals}</div></div><div className="rounded-md border border-zinc-800/70 bg-black/25 p-3"><div className="text-[10px] uppercase tracking-wider text-zinc-600">High risk</div><div className="font-mono text-xl text-white">{selected.high_risk_signals}</div></div></div><Badge variant="outline">{selected.top_category}</Badge></div> : <div className="rounded-md border border-zinc-800/70 bg-black/25 p-4 text-sm text-zinc-500">Select a city marker.</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top locations</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">{top.map((signal) => <button key={signal.city} onClick={() => setSelected(signal)} className="flex items-center justify-between rounded-md border border-zinc-800/70 bg-black/25 p-3 text-left text-sm transition hover:border-cyan-400/40 hover:bg-cyan-500/10"><span className="text-zinc-200">{signal.city}</span><span className="font-mono text-xs text-zinc-500">{signal.total_signals} signals</span></button>)}</CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
