"use client";

import { useEffect, useState } from "react";
import { BookMarked, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScroll } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { SlangTerm } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const [weights, setWeights] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [terms, setTerms] = useState<SlangTerm[]>([]);
  const [term, setTerm] = useState("дроп");
  const [category, setCategory] = useState("dropper_recruitment");
  const [language, setLanguage] = useState("ru");
  useEffect(() => { api.riskWeights().then(setWeights); api.auditLogs().then(setLogs); api.slangDictionary().then(setTerms); }, []);
  async function save(name: string, value: number) {
    await api.patchRiskWeight(name, value);
    toast.success("Risk weight updated");
  }
  async function addTerm() {
    const created = await api.addSlangTerm({ term, language, category, risk_weight: 3, notes: "Admin dictionary term" });
    setTerms([created, ...terms]);
    toast.success("Keyword dictionary updated");
  }
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PageHeader title="Settings / Admin" description="Manage risk weights, keyword dictionary, allowlist posture, AI provider placeholders, audit logs, data retention, and redaction controls." />
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
          <Card>
            <CardHeader><CardTitle>Risk scoring weights</CardTitle><CardDescription>Adjust explainable scoring components used by the backend engine.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {weights.map((weight) => <div key={weight.name} className="grid gap-2 rounded-md border border-zinc-800/70 bg-black/25 p-3 md:grid-cols-[1fr_120px_auto] md:items-center"><div><div className="text-sm font-medium text-zinc-100">{weight.name}</div><div className="text-xs text-zinc-500">{weight.description}</div></div><Input type="number" defaultValue={weight.weight} onBlur={(event) => save(weight.name, Number(event.target.value))} /><Button variant="outline" size="sm"><Save data-icon="inline-start" /> Save</Button></div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Keyword Dictionary</CardTitle><CardDescription>RU/KZ threat slang, Kazakhstan banks for drop patterns, and crypto indicators.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_120px_1fr_auto]">
                <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="term" />
                <Select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="ru">RU</option><option value="kz">KZ</option><option value="mixed">Mixed</option></Select>
                <Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="dropper_recruitment">dropper_recruitment</option><option value="illegal_vape_sales">illegal_vape_sales</option><option value="suspicious_payment_infrastructure">suspicious_payment_infrastructure</option><option value="suspicious_crypto_wallet">suspicious_crypto_wallet</option><option value="data_leak_mentions">data_leak_mentions</option></Select>
                <Button variant="solid" onClick={addTerm}><BookMarked data-icon="inline-start" /> Add</Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {terms.slice(0, 12).map((item) => <div key={item.id} className="rounded-md border border-zinc-800/70 bg-black/25 p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-sm text-zinc-100">{item.term}</span><Badge variant="outline">{item.language}</Badge></div><div className="mt-2 text-xs text-zinc-500">{item.category}</div></div>)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Security configuration</CardTitle><CardDescription>Production policy settings exposed by environment and backend controls.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Select defaultValue="enabled"><option value="enabled">Configured public sources only</option><option value="disabled">Collection disabled</option></Select>
              <Select defaultValue="90"><option value="90">90 day retention</option><option value="30">30 day retention</option><option value="180">180 day retention</option></Select>
              <Select defaultValue="rules"><option value="rules">Transparent rules classifier</option><option value="openai">OpenAI-compatible analyst assist</option></Select>
              <Select defaultValue="strict"><option value="strict">Strict redaction</option><option value="balanced">Balanced redaction</option></Select>
            </CardContent>
          </Card>
        </div>
        <Card className="flex min-h-0 flex-col">
          <CardHeader><CardTitle>Audit log viewer</CardTitle><CardDescription>Every analyst action is recorded by route services.</CardDescription></CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <TableScroll>
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
                <TableBody>{logs.slice(0, 12).map((log) => <TableRow key={log.id}><TableCell>{log.action}</TableCell><TableCell><Badge variant="outline">{log.target_type}</Badge></TableCell><TableCell>{formatDate(log.created_at)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </TableScroll>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
