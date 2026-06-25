"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Download, FileWarning, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type State = "idle" | "loading" | "success" | "error";

type Narrative = {
  executive_summary: string;
  threat_narrative: string;
  entity_risk_table: Array<{ entity: string; type: string; risk_level: string; risk_reason: string; connection_to_case: string }>;
  connection_analysis: string;
  risk_assessment: { overall_score: number; confidence: number; risk_category: string; risk_factors: string[] };
  recommended_actions: Array<{ priority: string; action: string; responsible_body: string }>;
  legal_note: string;
  limitations: string;
  generated_at: string;
  generated_by: string;
  case_id: string | number;
  document_hash: string;
};

const loadingTexts = [
  "Анализирую связи между сущностями...",
  "Оцениваю уровни риска...",
  "Формирую рекомендации...",
  "Подписываю документ..."
];

function riskBadgeClass(level: string) {
  const normalized = level.toUpperCase();
  if (normalized.includes("ВЫС") || normalized.includes("КРИТ")) return "border-rose-400/45 bg-rose-500/10 text-rose-100";
  if (normalized.includes("СРЕД")) return "border-amber-400/45 bg-amber-500/10 text-amber-100";
  return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
}

function priorityClass(priority: string) {
  const normalized = priority.toUpperCase();
  if (normalized.includes("НЕМЕД")) return "border-l-rose-400";
  if (normalized.includes("24")) return "border-l-amber-400";
  return "border-l-signal-info";
}

function formatDate(value?: string) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NarrativeViewer({ caseId }: { caseId: number }) {
  const [state, setState] = useState<State>("idle");
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [error, setError] = useState("");
  const [loadingIndex, setLoadingIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    setNarrative(null);
    setError("");
    setState("idle");
    api.getNarrative(caseId).then((result) => {
      if (!mounted) return;
      if (result?.status === "ready" && result.narrative) {
        setNarrative(result.narrative);
        setState("success");
      }
    });
    return () => { mounted = false; };
  }, [caseId]);

  useEffect(() => {
    if (state !== "loading") return;
    const interval = window.setInterval(() => setLoadingIndex((value) => (value + 1) % loadingTexts.length), 1800);
    return () => window.clearInterval(interval);
  }, [state]);

  async function generate() {
    setState("loading");
    setError("");
    setLoadingIndex(0);
    const result = await api.generateNarrative(caseId);
    if (result?.error) {
      setError(result.message ?? result.raw ?? "Narrative generation failed");
      setState("error");
      return;
    }
    setNarrative(result.narrative ?? result);
    setState("success");
  }

  const filename = useMemo(() => `ShadowGraph_KZ_CASE-${String(caseId).padStart(4, "0")}_${new Date().toISOString().slice(0, 10)}.pdf`, [caseId]);

  async function exportPDF() {
    const element = document.getElementById("narrative-doc");
    if (!element) return;
    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf().set({
      margin: [15, 20, 15, 20],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(element).save();
  }

  if (state === "loading") {
    return (
      <Card>
        <CardContent className="grid min-h-[540px] place-items-center">
          <div className="w-full max-w-xl text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full border border-signal-info/30 bg-signal-info/10 text-signal-accent ">
              <Loader2 className="size-7 animate-spin" />
            </div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-signal-accent">Threat Narrative Engine</div>
            <p className="mt-4 text-lg text-zinc-100">{loadingTexts[loadingIndex]}</p>
            <div className="mt-8 h-1 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-signal-info via-signal-accent to-signal-critical " />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card>
        <CardContent className="flex min-h-[360px] flex-col items-center justify-center text-center">
          <FileWarning className="mb-4 size-10 text-rose-200" />
          <h3 className="text-lg font-semibold text-white">Ошибка генерации нарратива</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">{error}</p>
          <Button className="mt-6" variant="solid" onClick={generate}><RefreshCw data-icon="inline-start" /> Повторить</Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "idle" || !narrative) {
    return (
      <Card>
        <CardContent className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <div className="mb-5 flex size-16 items-center justify-center rounded-full border border-signal-info/30 bg-signal-info/10 text-signal-accent ">
            <Bot className="size-7" />
          </div>
          <h3 className="text-xl font-semibold uppercase tracking-[0.16em] text-white">Threat Narrative Engine</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Сгенерируйте связную аналитическую записку на русском языке: факты, связи, риски, рекомендации, timestamp и SHA-256 документа.</p>
          <Button className="mt-7" variant="solid" onClick={generate}><Sparkles data-icon="inline-start" /> Generate Narrative</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Аналитическая записка</CardTitle>
          <p className="mt-2 font-mono text-xs text-zinc-500">Кейс #{String(narrative.case_id).toString()} · {formatDate(narrative.generated_at)} · {narrative.generated_by}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-signal-accent">SHA256: {narrative.document_hash}</p>
        </div>
        <Button variant="solid" onClick={exportPDF}><Download data-icon="inline-start" /> Скачать PDF</Button>
      </CardHeader>
      <CardContent>
        <article id="narrative-doc" className="relative overflow-hidden rounded-lg border border-zinc-800/70 bg-[#050816] p-6 text-zinc-100 md:p-8">
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]" aria-hidden="true">
            <text x="50%" y="45%" textAnchor="middle" transform="rotate(-24 500 300)" className="fill-signal-accent text-[64px] font-black tracking-[0.24em]">CONFIDENTIAL</text>
          </svg>
          <div className="relative z-10">
            <div className="mb-6 border-b border-zinc-800 pb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold uppercase tracking-[0.18em] text-white">АНАЛИТИЧЕСКАЯ ЗАПИСКА</h2>
                  <p className="mt-2 font-mono text-xs text-zinc-500">SHADOWGRAPH KZ · CASE-{String(caseId).padStart(4, "0")}</p>
                </div>
                <Badge variant="destructive">CONFIDENTIAL</Badge>
              </div>
            </div>

            <Section title="РЕЗЮМЕ ДЛЯ РУКОВОДСТВА"><p>{narrative.executive_summary}</p></Section>
            <Section title="НАРРАТИВ РАССЛЕДОВАНИЯ"><p className="text-base leading-8">{narrative.threat_narrative}</p></Section>
            <Section title="СУЩНОСТИ И РИСКИ">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.2em] text-zinc-600"><tr><th className="p-2 text-left">Сущность</th><th className="p-2 text-left">Тип</th><th className="p-2 text-left">Риск</th><th className="p-2 text-left">Причина</th></tr></thead>
                  <tbody>{narrative.entity_risk_table.map((row, index) => <tr key={`${row.entity}-${index}`} className="border-t border-zinc-800/80"><td className="p-2 font-mono text-signal-accent">{row.entity}</td><td className="p-2 text-zinc-400">{row.type}</td><td className="p-2"><span className={cn("rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider", riskBadgeClass(row.risk_level))}>{row.risk_level}</span></td><td className="p-2 text-zinc-400">{row.risk_reason}<div className="mt-1 text-xs text-zinc-600">{row.connection_to_case}</div></td></tr>)}</tbody>
                </table>
              </div>
            </Section>
            <Section title="АНАЛИЗ СВЯЗЕЙ"><p>{narrative.connection_analysis}</p></Section>
            <Section title="ОБЩАЯ ОЦЕНКА РИСКА">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div><div className="font-mono text-5xl font-semibold text-white">{narrative.risk_assessment.overall_score}/100</div><div className="mt-2 text-sm text-zinc-500">Уверенность: {narrative.risk_assessment.confidence}%</div></div>
                <Badge variant={narrative.risk_assessment.risk_category.includes("ВЫС") || narrative.risk_assessment.risk_category.includes("КРИТ") ? "destructive" : "warning"}>{narrative.risk_assessment.risk_category}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{narrative.risk_assessment.risk_factors.map((factor) => <Badge key={factor} variant="outline">{factor}</Badge>)}</div>
            </Section>
            <Section title="РЕКОМЕНДОВАННЫЕ ДЕЙСТВИЯ">
              <div className="space-y-3">{narrative.recommended_actions.map((item, index) => <div key={index} className={cn("border-l-2 bg-black/25 p-3", priorityClass(item.priority))}><div className="font-semibold uppercase tracking-[0.16em] text-zinc-100">{item.priority} · {item.responsible_body}</div><p className="mt-1 text-zinc-400">{item.action}</p></div>)}</div>
            </Section>
            <Section title="ПРАВОВАЯ ОСНОВА"><p>{narrative.legal_note}</p></Section>
            <Section title="ОГРАНИЧЕНИЯ АНАЛИЗА"><p>{narrative.limitations}</p></Section>
            <footer className="mt-8 border-t border-zinc-800 pt-4 font-mono text-[11px] text-zinc-600">Документ сгенерирован: {narrative.generated_by} · Hash: {narrative.document_hash} · Timestamp: {narrative.generated_at}</footer>
          </div>
        </article>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-zinc-800/80 py-5"><h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-signal-accent">{title}</h3><div className="text-sm leading-7 text-zinc-300">{children}</div></section>;
}
