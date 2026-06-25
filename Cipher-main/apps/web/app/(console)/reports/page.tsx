"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, ScrollText } from "lucide-react";
import { NarrativeViewer } from "@/components/NarrativeViewer";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { CaseRecord, ReportRecord } from "@/lib/types";

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
  const requestedReport = Number(searchParams.get("report_id") ?? "0");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [caseId, setCaseId] = useState(requestedCase || 1);
  const [reportId, setReportId] = useState(requestedReport || 0);

  useEffect(() => {
    api.cases().then((items) => {
      setCases(items);
      const next = requestedCase || items[0]?.id || 1;
      setCaseId(next);
    });
  }, [requestedCase]);

  useEffect(() => {
    api.reports().then((items) => {
      setReports(items);
      if (requestedReport) setReportId(requestedReport);
    });
  }, [requestedReport]);

  const selectedReport = useMemo(() => reports.find((item) => item.id === reportId) ?? null, [reports, reportId]);

  function selectCase(value: number) {
    setCaseId(value);
    setReportId(0);
    router.replace(`/reports?case_id=${value}`);
  }

  function selectReport(value: number) {
    setReportId(value);
    router.replace(value ? `/reports?report_id=${value}` : `/reports?case_id=${caseId}`);
  }

  return (
    <>
      <PageHeader title="Reports" description="Generate Russian-language investigation narratives and review saved evidence-backed reports, including local Ollama deep analysis." />
      <div className="grid min-h-0 gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="min-h-0">
          <CardHeader><CardTitle>Report controls</CardTitle><CardDescription>Choose a case narrative or open a saved report generated from graph analysis.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={String(caseId)} onChange={(event) => selectCase(Number(event.target.value))}>{cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select>
            <Select value={String(reportId)} onChange={(event) => selectReport(Number(event.target.value))}>
              <option value="0">Narrative for selected case</option>
              {reports.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <div className="rounded-md border border-signal-info/20 bg-signal-info/[0.06] p-4 text-sm leading-6 text-zinc-400">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-signal-accent"><ScrollText className="size-4" /> Threat Narrative Engine</div>
              Формирует официально-деловую аналитическую записку на русском языке с резюме, нарративом, таблицей рисков, рекомендациями, legal note и SHA-256.
            </div>
            <div className="rounded-md border border-zinc-800/70 bg-black/25 p-4 text-sm leading-6 text-zinc-500">
              <FileText className="mb-2 size-4 text-zinc-400" /> Saved reports include case reports and Deep Analysis Report entries from the graph. PDF export runs from the rendered document with watermark.
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{reports.length} saved reports</Badge>
              {selectedReport ? <Badge variant="cyan">report #{selectedReport.id}</Badge> : <Badge variant="outline">case narrative</Badge>}
            </div>
          </CardContent>
        </Card>
        {selectedReport ? <SavedReportViewer report={selectedReport} /> : <NarrativeViewer caseId={caseId} />}
      </div>
    </>
  );
}

function formatDate(value?: string) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function SavedReportViewer({ report }: { report: ReportRecord }) {
  const filename = useMemo(() => `ShadowGraph_KZ_REPORT-${String(report.id).padStart(4, "0")}_${new Date().toISOString().slice(0, 10)}.pdf`, [report.id]);

  async function exportPDF() {
    const element = document.getElementById("saved-report-doc");
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

  const reportType = String(report.json_content?.report_type ?? "case_report").replace(/_/g, " ");
  return (
    <Card className="min-h-0">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{report.title}</CardTitle>
          <p className="mt-2 font-mono text-xs text-zinc-500">{reportType} · {formatDate(report.created_at)}</p>
          {report.json_content?.document_hash ? <p className="mt-1 break-all font-mono text-[11px] text-signal-accent">SHA256: {String(report.json_content.document_hash)}</p> : null}
        </div>
        <Button variant="solid" onClick={exportPDF}><Download data-icon="inline-start" /> Скачать PDF</Button>
      </CardHeader>
      <CardContent>
        <div id="saved-report-doc" className="overflow-hidden rounded-lg border border-zinc-800/70 bg-[#050816] text-zinc-100" dangerouslySetInnerHTML={{ __html: report.html_content }} />
      </CardContent>
    </Card>
  );
}