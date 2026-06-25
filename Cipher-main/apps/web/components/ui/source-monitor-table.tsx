"use client";

import { Globe, Play, RefreshCw, Rss, Search, Send, Terminal, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/neon-button";
import { cn } from "@/lib/utils";
import type { Source } from "@/lib/types";

type SourceMonitorTableProps = {
  sources: Source[];
  runningSourceId: number | null;
  onRunSource: (source: Source) => void;
};

const sourceTypeConfig: Record<string, { label: string; icon: typeof Globe; tone: string }> = {
  web: { label: "Public Web", icon: Globe, tone: "text-zinc-300 border-zinc-700/50 bg-zinc-800/40" },
  search: { label: "Keyword Search", icon: Search, tone: "text-indigo-300 border-indigo-800/50 bg-indigo-950/30" },
  telegram: { label: "Telegram", icon: Send, tone: "text-cyan-300 border-cyan-800/40 bg-cyan-950/25" },
  rss: { label: "RSS Feed", icon: Rss, tone: "text-amber-400 border-amber-800/40 bg-amber-950/30" },
  blockchain: { label: "Blockchain", icon: WalletCards, tone: "text-emerald-400 border-emerald-800/50 bg-emerald-950/30" },
  darknet: { label: "DarkNet", icon: Terminal, tone: "text-rose-400 border-rose-800/40 bg-rose-950/40" },
  manual_upload: { label: "Manual Text", icon: Terminal, tone: "text-zinc-400 border-zinc-700/50 bg-zinc-800/40" }
};

function sourceTypeMeta(type: string) {
  return sourceTypeConfig[type] ?? { label: type || "Unknown", icon: Terminal, tone: "text-zinc-400 border-zinc-700/50 bg-zinc-800/40" };
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = (status ?? "never_run").toLowerCase();
  const className = normalized === "completed"
    ? "border-emerald-800/50 bg-emerald-950/35 text-emerald-400"
    : normalized === "failed" || normalized === "error"
      ? "border-rose-800/40 bg-rose-950/40 text-rose-400"
      : "border-zinc-700/50 bg-zinc-800/40 text-zinc-400";

  return <span className={cn("inline-flex rounded-md border px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider", className)}>{normalized === "pending" ? "pending" : normalized}</span>;
}

function EmptySources() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400">
          <Terminal className="size-4" />
        </div>
        <div className="text-sm font-bold tracking-tight text-zinc-100">No monitoring sources configured</div>
        <p className="mx-auto mt-2 max-w-xl font-mono text-xs leading-5 text-zinc-500">Add a public URL, Telegram channel, feed, wallet, or analyst-provided onion URL to start collection.</p>
      </div>
    </div>
  );
}

export function SourceMonitorTable({ sources, runningSourceId, onRunSource }: SourceMonitorTableProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="grid flex-shrink-0 grid-cols-[minmax(220px,1.5fr)_140px_150px_92px_108px] gap-3 border-b border-zinc-800/60 bg-zinc-950/35 px-4 py-2 font-mono text-xs uppercase tracking-normal text-zinc-500">
        <div>Name</div>
        <div>Type</div>
        <div>Status</div>
        <div>Items</div>
        <div className="text-right">Action</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {sources.length === 0 ? <EmptySources /> : null}
        {sources.map((source) => {
          const meta = sourceTypeMeta(source.source_type);
          const Icon = meta.icon;
          const isRunning = runningSourceId === source.id;
          const status = source.last_sync_status ?? source.status;

          return (
            <div key={source.id} className="grid grid-cols-[minmax(220px,1.5fr)_140px_150px_92px_108px] items-center gap-3 border-b border-zinc-800/60 px-4 py-3 transition-colors hover:bg-zinc-900/35">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className={cn("flex size-9 flex-shrink-0 items-center justify-center rounded-lg border", meta.tone)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold tracking-tight text-zinc-100">{source.label}</div>
                    <div className="mt-1 truncate font-mono text-xs text-zinc-500">{source.url_or_identifier ?? source.url}</div>
                  </div>
                </div>
              </div>

              <span className={cn("inline-flex w-fit rounded-md border px-2 py-1 font-mono text-xs text-zinc-400", meta.tone)}>{meta.label}</span>
              <StatusBadge status={status} />
              <span className="font-mono text-sm font-bold text-zinc-100 tabular-nums">{String(source.items_collected_count ?? 0).padStart(2, "0")}</span>
              <div className="flex justify-end">
                <Button size="sm" variant={isRunning ? "solid" : "outline"} neon={false} onClick={() => onRunSource(source)} disabled={isRunning} className="min-w-24">
                  {isRunning ? <RefreshCw className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                  {isRunning ? "Running" : "Run"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}