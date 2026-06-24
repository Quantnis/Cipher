"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, FileText, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { CaseRecord } from "@/lib/types";

export default function CasesPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [title, setTitle] = useState("New authorized investigation case");
  useEffect(() => { api.cases().then(setCases); }, []);
  async function createCase() {
    const item = await api.createCase(title) as CaseRecord;
    setCases([item, ...cases]);
    toast.success("Investigation case created");
  }
  async function generate(caseId: number) {
    await api.generateReport(caseId);
    toast.success("Evidence-ready report generated");
  }
  return (
    <>
      <PageHeader title="Case Management" description="Create investigations, attach alerts/entities/evidence, track timelines, and generate evidence-ready reports." />
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>Create investigation case</CardTitle><CardDescription>Draft cases can receive alerts, entities, evidence, notes, and graph snapshots.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            <Textarea defaultValue="Authorized investigation notes. Keep raw personal data out of case notes." />
            <Button variant="solid" onClick={createCase}><PlusCircle data-icon="inline-start" /> Create case</Button>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          {cases.map((item) => (
            <Card key={item.id}>
              <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{item.title}</CardTitle><CardDescription>{item.description}</CardDescription></div><RiskBadge score={item.overall_risk_score} /></div></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2"><Badge variant="outline">{item.status}</Badge><Badge variant="cyan">{item.priority}</Badge></div>
                <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">Timeline, notes, evidence table, and graph snapshot are available through backend case items.</div>
                <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => generate(item.id)}><FileText data-icon="inline-start" /> Generate report</Button><Button asChild variant="solid"><Link href={`/reports?case_id=${item.id}`}><ExternalLink data-icon="inline-start" /> Generate Narrative</Link></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}



