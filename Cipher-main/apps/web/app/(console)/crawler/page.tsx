"use client";

import { useEffect, useState } from "react";
import { Play, PlusCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/neon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SourceMonitorTable } from "@/components/ui/source-monitor-table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Source } from "@/lib/types";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative min-h-0 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/20 shadow-sm backdrop-blur-md ${className}`}>{children}</section>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-xs uppercase tracking-normal text-zinc-500">{children}</div>;
}

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
    if (result.status === "completed") toast.success(result.message ?? "Source run completed");
    else toast.message(result.message ?? result.status ?? "Source run finished");
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
    <div className="flex h-full min-h-0 w-full gap-6 overflow-hidden text-zinc-100">
      <Panel className="flex h-full w-1/3 flex-shrink-0 flex-col overflow-hidden p-5">
        <div className="flex-shrink-0 border-b border-zinc-800/60 pb-4">
          <Label>Sources / intake</Label>
          <h1 className="mt-1 font-sans text-xl font-bold tracking-tight text-zinc-100">Add Source</h1>
          <p className="mt-2 font-mono text-xs leading-5 text-zinc-500">Legal public-source configuration and manual analyst ingestion. This pane remains fixed.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
          <div className="grid gap-3">
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
            <Textarea value={legal} onChange={(event) => setLegal(event.target.value)} placeholder="Legal basis note and authorization context" className="min-h-24" />
            <Button variant="solid" neon={false} onClick={addSource}><PlusCircle data-icon="inline-start" /> Add source</Button>
          </div>

          <div className="my-5 border-t border-zinc-800/60" />

          <div className="grid gap-3">
            <Label>Manual ingestion</Label>
            <Textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="Paste public source excerpt here" className="min-h-32" />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" neon={false} onClick={ingestManual}><Upload data-icon="inline-start" /> Ingest</Button>
              <Button variant="outline" neon={false} onClick={runDemo}><Play data-icon="inline-start" /> Demo</Button>
            </div>
          </div>
        </div>

        <div className="grid max-h-28 flex-shrink-0 gap-2 overflow-hidden border-t border-zinc-800/60 pt-4">
          {Object.entries(integrations).slice(0, 2).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/35 px-3 py-2">
              <span className="truncate font-mono text-xs uppercase text-zinc-500">{key}</span>
              <Badge variant={value.configured ? "success" : "outline"} className="rounded-md font-mono text-xs">{value.configured ? "configured" : "setup"}</Badge>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="flex h-full w-2/3 min-w-0 flex-col overflow-hidden p-0">
        <BorderBeam size={420} duration={20} borderWidth={1} colorFrom="#3f3f46" colorTo="#0891b2" delay={2} />
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-zinc-800/60 px-5">
          <div className="min-w-0">
            <Label>Configured sources table</Label>
            <div className="mt-1 truncate font-sans text-lg font-bold tracking-tight text-zinc-100">{sources.length} source(s) monitored</div>
          </div>
          <Badge variant="outline" className="rounded-md border-zinc-800 bg-zinc-950/35 font-mono text-xs text-zinc-400">internal row scroll</Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SourceMonitorTable sources={sources} runningSourceId={running} onRunSource={runSource} />
        </div>
      </Panel>
    </div>
  );
}