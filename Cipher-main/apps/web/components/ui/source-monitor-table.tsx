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
  web: { label: "Public Web", icon: Globe, tone: "text-cyan-300 border-cyan-500/20 bg-cyan-500/10" },
  search: { label: "Keyword Search", icon: Search, tone: "text-indigo-300 border-indigo-500/20 bg-indigo-500/10" },
  telegram: { label: "Telegram", icon: Send, tone: "text-sky-300 border-sky-500/20 bg-sky-500/10" },
  rss: { label: "RSS Feed", icon: Rss, tone: "text-amber-300 border-amber-500/20 bg-amber-500/10" },
  blockchain: { label: "Blockchain", icon: WalletCards, tone: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10" },
  darknet: { label: "DarkNet", icon: Terminal, tone: "text-rose-300 border-rose-500/20 bg-rose-500/10" },
  manual_upload: { label: "Manual Text", icon: Terminal, tone: "text-zinc-300 border-zinc-600/40 bg-zinc-800/50" }
};

function sourceTypeMeta(type: string) {
  return sourceTypeConfig[type] ?? { label: type || "Unknown", icon: Terminal, tone: "text-zinc-300 border-zinc-700 bg-zinc-900/70" };
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = (status ?? "never_run").toLowerCase();

  if (normalized === "completed") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.12)]">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-45" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        completed
      </span>
    );
  }

  if (normalized === "failed" || normalized === "error") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-800/60 bg-rose-950/40 px-2.5 py-1 text-xs font-medium text-rose-300 shadow-[0_0_18px_rgba(225,29,72,0.12)]">
        <span className="size-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]" />
        {normalized}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-400 shadow-[0_0_16px_rgba(113,113,122,0.1)]">
      <span className="size-2 rounded-full bg-zinc-500" />
      {normalized === "pending" ? "pending" : "never_run"}
    </span>
  );
}

function EmptySources() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800/90 bg-slate-950/40 p-8 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
        <Terminal className="size-4" />
      </div>
      <div className="text-sm font-medium text-zinc-200">No monitoring sources configured</div>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-zinc-500">
        Add a public URL, manual source, public Telegram channel, feed, wallet, or analyst-provided onion URL to start collection.
      </p>
    </div>
  );
}

export function SourceMonitorTable({ sources, runningSourceId, onRunSource }: SourceMonitorTableProps) {
  return (
    <div className="w-full">
      <div className="mb-3 hidden grid-cols-[minmax(220px,1.5fr)_140px_150px_100px_100px] gap-3 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500 lg:grid">
        <div>Name</div>
        <div>Type</div>
        <div>Status</div>
        <div>Items</div>
        <div className="text-right">Action</div>
      </div>

      {sources.length === 0 ? <EmptySources /> : null}

      <div className="space-y-3">
        {sources.map((source) => {
          const meta = sourceTypeMeta(source.source_type);
          const Icon = meta.icon;
          const isRunning = runningSourceId === source.id;
          const status = source.last_sync_status ?? source.status;

          return (
            <div
              key={source.id}
              className="group grid gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.01),0_18px_42px_rgba(0,0,0,0.22)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-500/50 hover:bg-zinc-900/80 hover:shadow-[0_0_28px_rgba(6,182,212,0.08),0_18px_42px_rgba(0,0,0,0.28)] lg:grid-cols-[minmax(220px,1.5fr)_140px_150px_100px_100px] lg:items-center"
            >
              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 lg:hidden">Name</div>
                <div className="flex items-center gap-3">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", meta.tone)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100 transition-colors group-hover:text-cyan-100">{source.label}</div>
                    <div className="mt-1 truncate font-mono text-[11px] text-zinc-500">{source.url_or_identifier ?? source.url}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 lg:hidden">Type</div>
                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", meta.tone)}>{meta.label}</span>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 lg:hidden">Status</div>
                <StatusBadge status={status} />
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 lg:hidden">Items</div>
                <span className="font-mono text-sm font-semibold text-zinc-100">{String(source.items_collected_count ?? 0).padStart(2, "0")}</span>
              </div>

              <div className="flex justify-start lg:justify-end">
                <Button
                  size="sm"
                  variant={isRunning ? "solid" : "outline"}
                  onClick={() => onRunSource(source)}
                  disabled={isRunning}
                  className="min-w-24 border-cyan-500/30 hover:bg-cyan-500/15 hover:text-cyan-100"
                >
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
