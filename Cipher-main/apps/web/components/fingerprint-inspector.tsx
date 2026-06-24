"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BrainCircuit, Clock3, Fingerprint, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

function pct(value: number | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function TemporalHistogram({ values }: { values: number[] }) {
  const bars = values.length ? values : Array.from({ length: 24 }, () => 0);
  return (
    <svg viewBox="0 0 240 52" className="mt-3 h-14 w-full overflow-visible">
      {bars.map((value, index) => {
        const height = Math.max(3, value * 46);
        const night = index >= 22 || index <= 6;
        return <rect key={index} x={index * 10} y={48 - height} width="6" height={height} rx="2" fill={night ? "#f59e0b" : "#52525b"} opacity={night ? 0.95 : 0.74} />;
      })}
    </svg>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500"><span>{label}</span><span className="font-mono text-zinc-300">{pct(value)}</span></div>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500" style={{ width: pct(value) }} /></div>
    </div>
  );
}

export function FingerprintInspector({ entityId }: { entityId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.entityFingerprint(entityId).then((payload) => {
      if (!active) return;
      setData(payload);
      setLoading(false);
    });
    return () => { active = false; };
  }, [entityId]);

  const peak = useMemo(() => {
    const values: number[] = data?.temporal_pattern ?? [];
    if (!values.length) return "нет данных";
    const hour = values.reduce((best, value, index) => value > values[best] ? index : best, 0);
    return `${String(hour).padStart(2, "0")}:00-${String((hour + 1) % 24).padStart(2, "0")}:00`;
  }, [data]);

  if (loading) return <div className="rounded-md border border-zinc-800/70 bg-black/25 p-4 text-sm text-zinc-500">Вычисляю цифровой отпечаток...</div>;
  if (!data) return <div className="rounded-md border border-rose-500/30 bg-rose-950/10 p-4 text-sm text-rose-200">Fingerprint недоступен.</div>;

  const behavior = data.behavior ?? {};
  return (
    <div className="rounded-lg border border-amber-400/20 bg-zinc-950/70 p-4 shadow-[0_0_38px_rgba(245,158,11,0.10)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200"><Fingerprint className="size-4" /> Цифровой отпечаток</div>
          <div className="mt-2 break-all font-mono text-sm text-white">{data.label}</div>
        </div>
        <Badge variant="outline">{data.fingerprint_dim} dims</Badge>
      </div>
      <div className="grid gap-3">
        <section className="rounded-md border border-zinc-800/70 bg-black/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500"><BrainCircuit className="size-3" /> Лексический профиль</div>
          <div className="flex flex-wrap gap-2">
            {(data.top_words ?? []).map((item: any) => <span key={item.word} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200">{item.word}({Math.round(item.share * 100)}%)</span>)}
          </div>
        </section>
        <section className="rounded-md border border-zinc-800/70 bg-black/25 p-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500"><span className="inline-flex items-center gap-2"><Clock3 className="size-3" /> Временной паттерн</span><span className="font-mono text-amber-200">пик {peak}</span></div>
          <TemporalHistogram values={data.temporal_pattern ?? []} />
        </section>
        <section className="rounded-md border border-zinc-800/70 bg-black/25 p-3">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500"><Activity className="size-3" /> Поведение</div>
          <div className="grid gap-2">
            <MiniBar label="эмодзи" value={behavior.emoji_rate ?? 0} />
            <MiniBar label="цены" value={behavior.price_rate ?? 0} />
            <MiniBar label="CTA" value={behavior.cta_rate ?? 0} />
          </div>
        </section>
        <section className="rounded-md border border-zinc-800/70 bg-black/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500"><Network className="size-3" /> Похожие сущности</div>
          <div className="space-y-2">
            {(data.similar_entities ?? []).slice(0, 5).map((item: any) => <div key={item.entity_id} className="flex items-center justify-between gap-3 font-mono text-xs text-zinc-300"><span>entity-{item.entity_id}</span><span className="text-amber-200">{item.confidence_pct}%</span></div>)}
            {(data.similar_entities ?? []).length === 0 ? <div className="text-sm text-zinc-500">Совпадений пока нет. Запустите reindex после ingest.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
