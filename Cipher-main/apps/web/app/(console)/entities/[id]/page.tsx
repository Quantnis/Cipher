"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PlusCircle, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Alert, Entity } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function EntityProfilePage() {
  const params = useParams<{ id: string }>();
  const [entity, setEntity] = useState<(Entity & { alerts?: Alert[]; risk_explanation?: Record<string, string> }) | null>(null);
  useEffect(() => { api.entity(Number(params.id)).then(setEntity); }, [params.id]);
  if (!entity) return null;
  return (
    <>
      <PageHeader title="Entity Profile" description="Review redacted entity value, risk explanation, connected alerts, evidence, and analyst notes." action={<Button variant="solid"><PlusCircle data-icon="inline-start" /> Add to case</Button>} />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>{entity.entity_type}</CardTitle><CardDescription>{entity.value_redacted}</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Risk score</span><RiskBadge score={entity.risk_score} /></div>
            <div className="rounded-md border bg-background p-3 text-sm"><div className="text-muted-foreground">Value hash</div><div className="mt-1 break-all font-mono text-xs">{entity.value_hash}</div></div>
            <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-md border bg-background p-2"><div className="text-muted-foreground">First seen</div>{formatDate(entity.first_seen)}</div><div className="rounded-md border bg-background p-2"><div className="text-muted-foreground">Last seen</div>{formatDate(entity.last_seen)}</div></div>
            <Button variant="outline"><ShieldAlert data-icon="inline-start" /> Mark false positive</Button>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Risk explanation</CardTitle><CardDescription>Analyst-friendly rationale generated from classifier and graph context.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {Object.entries(entity.risk_explanation ?? {}).map(([key, value]) => <div key={key} className="rounded-md border bg-background p-3 text-sm"><div className="mb-1 text-xs uppercase text-muted-foreground">{key.replaceAll("_", " ")}</div>{value}</div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Connected alerts</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">{(entity.alerts ?? []).map((alert) => <div key={alert.id} className="flex items-center justify-between rounded-md border bg-background p-3 text-sm"><span>{alert.title}</span><Badge variant="outline">{alert.status}</Badge></div>)}</CardContent>
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


