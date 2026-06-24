"use client";

import { useEffect, useState } from "react";
import { Play, PlusCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SourceMonitorTable } from "@/components/ui/source-monitor-table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Source } from "@/lib/types";

export default function CrawlerPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [name, setName] = useState("Public source");
  const [url, setUrl] = useState("https://example.org");
  const [type, setType] = useState("web");
  const [legal, setLegal] = useState("");
  const [manualText, setManualText] = useState("");
  const [running, setRunning] = useState<number | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, { configured: boolean; message: string }>>({});

  async function refresh() {
    setSources(await api.sources());
    setIntegrations(await api.integrations());
  }
  useEffect(() => { refresh(); }, []);

  async function addSource() {
    const source = await api.createSource({ name, type, url_or_identifier: url, legal_basis_note: legal, enabled: true });
    if (source?.id) {
      setSources([source, ...sources]);
      toast.success("Source configured");
    } else {
      toast.error("Source was not created");
    }
  }

  async function runSource(source: Source) {
    setRunning(source.id);
    const result = await api.runSource(source.id) as any;
    setRunning(null);
    await refresh();
    if (result.status === "completed") {
      toast.success(result.message ?? "Source run completed");
    } else {
      toast.message(result.message ?? result.status ?? "Source run finished");
    }
  }

  async function ingestManual() {
    if (!manualText.trim()) return;
    const result = await api.ingestManual(manualText);
    setManualText("");
    await refresh();
    toast.success(result?.item ? "Manual text ingested with provenance" : "Manual ingestion failed");
  }

  async function runDemo() {
    const result = await api.demoRun() as any;
    await refresh();
    toast.message(result.safety ?? "Explicit demo sample created");
  }

  return (
    <>
      <PageHeader title="Sources" description="Configure legal public sources, run collection, ingest manual analyst text, and inspect integration readiness." action={<Button variant="outline" onClick={runDemo}><Play data-icon="inline-start" /> Explicit demo sample</Button>} />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add source</CardTitle>
              <CardDescription>DarkNet/onion monitoring only accepts analyst-provided open URLs and requires a legal basis note.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input value={name} onChange={(event) => setName(event.target.value)} aria-label="Source name" />
              <Input value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Source URL or identifier" />
              <Select value={type} onChange={(event) => setType(event.target.value)} aria-label="Source type">
                <option value="web">Public web URL</option>
                <option value="search">Keyword search query</option>
                <option value="telegram">Public Telegram channel</option>
                <option value="rss">Public RSS/feed</option>
                <option value="blockchain">Public blockchain wallet</option>
                <option value="darknet">Analyst-provided onion URL</option>
                <option value="manual_upload">Manual pasted text</option>
              </Select>
              <Textarea value={legal} onChange={(event) => setLegal(event.target.value)} placeholder="Legal basis note and authorization context" />
              <Button variant="solid" onClick={addSource}><PlusCircle data-icon="inline-start" /> Add source</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Manual ingestion</CardTitle><CardDescription>Paste public, legally collected text. The backend stores hash, timestamp, redacted excerpt, entities, and risk reasons.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="Paste public source excerpt here" className="min-h-36" />
              <Button variant="outline" onClick={ingestManual}><Upload data-icon="inline-start" /> Ingest text</Button>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Configured sources</CardTitle><CardDescription>{sources.length} source(s). Empty state means no real monitoring is configured.</CardDescription></CardHeader>
            <CardContent>
              <SourceMonitorTable sources={sources} runningSourceId={running} onRunSource={runSource} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Integration readiness</CardTitle><CardDescription>Missing secrets produce setup states instead of fake findings.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {Object.entries(integrations).map(([key, value]) => <div key={key} className="rounded-md border bg-background p-3 text-sm"><div className="mb-1 flex items-center justify-between"><span className="font-medium capitalize">{key}</span><Badge variant={value.configured ? "success" : "outline"}>{value.configured ? "configured" : "setup needed"}</Badge></div><p className="text-muted-foreground">{value.message}</p></div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}



