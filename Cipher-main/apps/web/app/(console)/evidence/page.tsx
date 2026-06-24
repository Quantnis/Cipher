"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Evidence } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function EvidencePage() {
  const [items, setItems] = useState<Evidence[]>([]);
  useEffect(() => { api.evidence().then(setItems); }, []);
  return (
    <>
      <PageHeader title="Evidence Vault" description="Chain-of-custody style vault for redacted screenshots, text summaries, hashes, timestamps, and classification evidence." />
      <Card>
        <CardHeader><CardTitle>Evidence register</CardTitle><CardDescription>No raw leaked personal databases are stored.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Evidence ID</TableHead><TableHead>Type</TableHead><TableHead>Hash</TableHead><TableHead>Timestamp</TableHead><TableHead>Redaction</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>EVD-{String(item.id).padStart(4, "0")}</TableCell><TableCell>{item.evidence_type}</TableCell><TableCell className="max-w-md break-all font-mono text-xs text-muted-foreground">{item.sha256_hash}</TableCell><TableCell>{formatDate(item.created_at)}</TableCell><TableCell><Badge variant="success">{item.redaction_status}</Badge></TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
