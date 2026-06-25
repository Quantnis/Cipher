"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScroll } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Evidence } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function EvidencePage() {
  const [items, setItems] = useState<Evidence[]>([]);
  useEffect(() => { api.evidence().then(setItems); }, []);
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PageHeader title="Evidence Vault" description="Chain-of-custody style vault for redacted screenshots, text summaries, hashes, timestamps, and classification evidence." />
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader><CardTitle>Evidence register</CardTitle><CardDescription>No raw leaked personal databases are stored.</CardDescription></CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <TableScroll>
            <Table className="min-w-[820px]">
              <TableHeader><TableRow><TableHead>Evidence ID</TableHead><TableHead>Type</TableHead><TableHead>Hash</TableHead><TableHead>Timestamp</TableHead><TableHead>Redaction</TableHead></TableRow></TableHeader>
              <TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>EVD-{String(item.id).padStart(4, "0")}</TableCell><TableCell>{item.evidence_type}</TableCell><TableCell className="max-w-md break-all font-mono text-xs text-muted-foreground">{item.sha256_hash}</TableCell><TableCell>{formatDate(item.created_at)}</TableCell><TableCell><Badge variant="success">{item.redaction_status}</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          </TableScroll>
        </CardContent>
      </Card>
    </div>
  );
}
