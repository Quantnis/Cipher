"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PlusCircle, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RiskBadge } from "@/components/risk-badge";
import { ThreatGraph } from "@/components/threat-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Alert, Entity, GraphPayload } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function EntityProfilePage() {
  const params = useParams<{ id: string }>();
  const [entity, setEntity] = useState<(Entity & { alerts?: Alert[]; risk_explanation?: Record<string, string> }) | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], edges: [], clusters: [] });
  useEffect(() => {
    const id = Number(params.id);
    api.entity(id).then(setEntity);
    api.entityDocuments(id).then(setDocuments);
    api.entityGraph(id).then(setGraph);
  }, [params.id]);
  if (!entity) return null;
  return (
    <>
      <PageHeader title="Entity Profile" description="Review redacted entity value, risk explanation, connected alerts, evidence, and analyst notes." action={<Button variant="solid"><PlusCircle data-icon="inline-start" /> Add to case</Button>} />
      <div className="grid h-full min-h-0 gap-4 overflow-hidden xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>{entity.entity_type}</CardTitle><CardDescription>{entity.value_redacted}</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Risk score</span><RiskBadge score={entity.risk_score} /></div>
            <div className="rounded-md border bg-background p-3 text-sm"><div className="text-muted-foreground">Value hash</div><div className="mt-1 break-all font-mono text-xs">{entity.value_hash}</div></div>
            <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-md border bg-background p-2"><div className="text-muted-foreground">First seen</div>{formatDate(entity.first_seen)}</div><div className="rounded-md border bg-background p-2"><div className="text-muted-foreground">Last seen</div>{formatDate(entity.last_seen)}</div></div>
            <Button variant="outline"><ShieldAlert data-icon="inline-start" /> Mark false positive</Button>
          </CardContent>
        </Card>
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <Card>
            <CardHeader><CardTitle>Risk explanation</CardTitle><CardDescription>Analyst-friendly rationale generated from classifier and graph context.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {Object.entries(entity.risk_explanation ?? {}).map(([key, value]) => <div key={key} className="rounded-md border bg-background p-3 text-sm"><div className="mb-1 text-xs uppercase text-muted-foreground">{key.replaceAll("_", " ")}</div>{value}</div>)}
            </CardContent>
          </Card>
          <Card className="flex min-h-[640px] flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0"><CardTitle>Graph neighborhood</CardTitle><CardDescription>Click a connected entity to open the side inspector and generate a local AI deep analysis report.</CardDescription></CardHeader>
            <CardContent className="min-h-0 flex-1 p-0">
              {graph.nodes.length ? <ThreatGraph graph={graph} /> : <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">No graph neighborhood returned for this entity.</div>}
            </CardContent>
          </Card>
          <Card className="flex max-h-80 min-h-0 flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0"><CardTitle>Connected alerts</CardTitle></CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">{(entity.alerts ?? []).map((alert) => <div key={alert.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm"><span className="min-w-0 truncate">{alert.title}</span><Badge className="shrink-0" variant="outline">{alert.status}</Badge></div>)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Documents mentioning this entity</CardTitle></CardHeader>
            <CardContent className="max-h-72 space-y-2 overflow-y-auto">{documents.length === 0 ? <div className="text-sm text-muted-foreground">No documents returned for this entity.</div> : documents.map((doc) => <div key={doc.id} className="rounded-md border bg-background p-3 text-sm"><div className="font-medium">{doc.title}</div><p className="mt-1 line-clamp-2 text-muted-foreground">{doc.raw_text}</p></div>)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Analyst notes</CardTitle></CardHeader>
            <CardContent><Textarea placeholder="Add case-safe notes. Do not paste raw leaked personal data." /></CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}


