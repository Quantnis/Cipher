"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, ScrollText } from "lucide-react";
import { NarrativeViewer } from "@/components/NarrativeViewer";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { CaseRecord } from "@/lib/types";

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-6 text-sm text-zinc-500">Loading narrative controls...</div>}>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCase = Number(searchParams.get("case_id") ?? "0");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseId, setCaseId] = useState(requestedCase || 1);

  useEffect(() => {
    api.cases().then((items) => {
      setCases(items);
      const next = requestedCase || items[0]?.id || 1;
      setCaseId(next);
    });
  }, [requestedCase]);

  function selectCase(value: number) {
    setCaseId(value);
    router.replace(`/reports?case_id=${value}`);
  }

  return (
    <>
      <PageHeader title="Reports" description="Generate Russian-language investigation narratives with evidence context, recommendations, document hash, and one-click PDF export." />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Narrative controls</CardTitle><CardDescription>Choose a case. Cached narratives load automatically; Generate Narrative creates a new signed document.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={String(caseId)} onChange={(event) => selectCase(Number(event.target.value))}>{cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select>
            <div className="rounded-md border border-cyan-400/20 bg-cyan-500/5 p-4 text-sm leading-6 text-zinc-400">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200"><ScrollText className="size-4" /> Threat Narrative Engine</div>
              Формирует официально-деловую аналитическую записку на русском языке с резюме, нарративом, таблицей рисков, рекомендациями, legal note и SHA-256.
            </div>
            <div className="rounded-md border border-zinc-800/70 bg-black/25 p-4 text-sm leading-6 text-zinc-500">
              <FileText className="mb-2 size-4 text-zinc-400" /> PDF экспорт выполняется из готового документа с watermark CONFIDENTIAL.
            </div>
          </CardContent>
        </Card>
        <NarrativeViewer caseId={caseId} />
      </div>
    </>
  );
}
