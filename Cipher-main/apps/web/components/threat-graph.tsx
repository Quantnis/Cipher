"use client";

import React, { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { Download, Expand, FileJson, Fingerprint, ImageDown, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { FingerprintInspector } from "@/components/fingerprint-inspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { GraphPayload } from "@/lib/types";

const nodeColor: Record<string, string> = {
  Source: "#67e8f9",
  Category: "#f59e0b",
  TelegramHandle: "#22d3ee",
  CryptoWallet: "#fb7185",
  City: "#34d399",
  Product: "#a5b4fc",
  LeakMention: "#fbbf24",
  Case: "#93c5fd",
  web: "#67e8f9",
  telegram: "#38bdf8",
  darknet: "#fb7185",
  manual_upload: "#cbd5e1",
  "post/message": "#94a3b8",
  crypto_wallet: "#fb7185",
  city: "#34d399",
  domain: "#93c5fd",
  url: "#93c5fd",
  phone: "#fbbf24",
  keyword: "#c4b5fd"
};

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SimilarityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500"><span>{label}</span><span className="font-mono text-amber-200">{value}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export function ThreatGraph({ graph }: { graph: GraphPayload }) {
  const [payload, setPayload] = useState(graph);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<any | null>(null);
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [creating, setCreating] = useState(false);
  const [analystNote, setAnalystNote] = useState("");

  const nodes = useMemo<Node[]>(() => payload.nodes.map((node, index) => {
    const color = String(node.metadata?.cluster_color ?? nodeColor[node.type] ?? "#71717a");
    return {
      id: node.id,
      position: { x: (index % 6) * 220, y: Math.floor(index / 6) * 142 },
      data: { label: `${node.label}` },
      style: {
        background: "linear-gradient(135deg, rgba(24,24,27,0.92), rgba(3,7,18,0.94))",
        color: "#f4f4f5",
        border: `1px solid ${color}`,
        borderRadius: 8,
        width: 176,
        fontSize: 12,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        boxShadow: node.riskScore > 80 ? `0 0 0 1px rgba(244,63,94,.34), 0 0 34px rgba(244,63,94,.24)` : `0 0 26px ${color}33`
      }
    };
  }), [payload.nodes]);

  const edges = useMemo<Edge[]>(() => payload.edges.map((edge) => {
    const hidden = edge.relationshipType === "HIDDEN_SIMILARITY";
    const verified = edge.relationshipType === "VERIFIED_SIMILARITY";
    const wallet = edge.relationshipType.includes("wallet");
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      data: edge,
      animated: hidden || wallet,
      style: {
        stroke: hidden || verified ? "#EF9F27" : wallet ? "#fb7185" : "#22d3ee",
        strokeWidth: hidden || verified ? 2.2 : 1.6,
        strokeDasharray: hidden ? "6 4" : undefined,
        opacity: hidden ? 0.92 : 1,
        filter: hidden || verified ? "drop-shadow(0 0 9px rgba(239,159,39,0.55))" : "drop-shadow(0 0 7px rgba(34,211,238,0.34))"
      },
      labelStyle: { fill: hidden || verified ? "#fbbf24" : "#a1a1aa", fontSize: 10, fontFamily: "ui-monospace, monospace" }
    };
  }), [payload.edges]);

  async function createCase() {
    setCreating(true);
    await api.caseFromCluster(String(selected?.cluster_id ?? "top-risk"));
    setCreating(false);
    toast.success("Case created from graph cluster");
  }

  async function expandSelected() {
    if (!selectedNodeId) return;
    const expanded = await api.graphExpand(selectedNodeId);
    setPayload(expanded);
    setSelectedLink(null);
    toast.success("Entity expansion loaded");
  }

  async function exportJson() {
    const exported = await api.graphExport();
    download("shadowgraph-kz-graph.json", JSON.stringify(exported, null, 2), "application/json");
  }

  function exportPng() {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#67e8f9";
    ctx.font = "28px monospace";
    ctx.fillText("ShadowGraph KZ Graph Intelligence", 48, 64);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "16px monospace";
    ctx.fillText(`${payload.nodes.length} nodes / ${payload.edges.length} edges / ${payload.clusters?.length ?? 0} clusters`, 48, 96);
    payload.nodes.slice(0, 42).forEach((node, index) => {
      const x = 70 + (index % 6) * 210;
      const y = 150 + Math.floor(index / 6) * 90;
      const color = String(node.metadata?.cluster_color ?? nodeColor[node.type] ?? "#71717a");
      ctx.strokeStyle = color;
      ctx.fillStyle = "rgba(24,24,27,.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, 170, 52, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f4f4f5";
      ctx.font = "11px monospace";
      ctx.fillText(node.label.slice(0, 22), x + 12, y + 30);
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "shadowgraph-kz-graph.png";
    link.click();
  }

  async function verifySelectedLink(verified: boolean) {
    const linkId = Number(selectedLink?.link_id);
    if (!linkId) return;
    await api.verifyHiddenLink(linkId, verified, analystNote);
    setPayload(await api.graph());
    setSelectedLink(null);
    setAnalystNote("");
    toast.success(verified ? "Hidden link verified" : "Hidden link rejected");
  }

  const selectedEntityId = selectedNodeId?.startsWith("entity-") ? Number(selectedNodeId.replace("entity-", "")) : null;
  const components = selectedLink?.components && typeof selectedLink.components === "object" ? selectedLink.components as Record<string, number> : {};

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Threat graph</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">Cluster-colored graph with entity expansion, fingerprint links, and exports.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportPng}><ImageDown data-icon="inline-start" /> PNG</Button>
            <Button size="sm" variant="outline" onClick={exportJson}><FileJson data-icon="inline-start" /> JSON</Button>
            <Button size="sm" variant="outline" onClick={createCase} disabled={creating || payload.nodes.length === 0}>{creating ? "Creating..." : "Create case"}</Button>
          </div>
        </CardHeader>
        <CardContent className="h-[640px] p-0">
          {payload.nodes.length === 0 ? (
            <div className="grid h-full place-items-center p-8 text-center text-sm text-zinc-500">No graph nodes yet. Add a source or ingest manual public text to extract entities and build relationships.</div>
          ) : (
            <div className="h-full bg-[#030712]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelected(payload.nodes.find((item) => item.id === node.id)?.metadata ?? null); setSelectedLink(null); setShowFingerprint(false); }}
                onEdgeClick={(_, edge) => { const raw = edge.data as any; if (raw?.relationshipType?.includes("SIMILARITY")) { setSelectedLink(raw.metadata ?? null); setSelected(null); setSelectedNodeId(null); } }}
              >
                <Background color="rgba(34,211,238,0.18)" gap={28} />
                <MiniMap maskColor="rgba(3,7,18,0.72)" nodeColor={(node) => String((node.style?.border as string | undefined)?.split(" ").pop() ?? "#38bdf8")} />
                <Controls />
              </ReactFlow>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{selectedLink ? "Скрытая связь" : "Node inspector"}</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedLink ? (
            <div className="flex flex-col gap-4 text-sm">
              <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-4 shadow-[0_0_32px_rgba(239,159,39,0.12)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200">Обнаружена автоматически</div>
                <div className="mt-3 flex items-end justify-between"><span className="text-zinc-400">Сходство</span><span className="font-mono text-3xl text-white">{selectedLink.confidence_pct}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" style={{ width: `${selectedLink.confidence_pct ?? 0}%` }} /></div>
              </div>
              <div className="rounded-md border border-zinc-800/70 bg-black/25 p-3">
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Компоненты сходства</div>
                <div className="grid gap-3">
                  <SimilarityBar label="Лексика" value={components.lexical ?? 0} />
                  <SimilarityBar label="Время" value={components.temporal ?? 0} />
                  <SimilarityBar label="Поведение" value={components.behavior ?? 0} />
                  <SimilarityBar label="Сеть" value={components.network ?? 0} />
                  <SimilarityBar label="Темы" value={components.topics ?? 0} />
                </div>
              </div>
              <div className="rounded-md border border-zinc-800/70 bg-black/25 p-3 text-xs text-zinc-400">
                <div>Метод: цифровой отпечаток (5 компонентов)</div>
                <div className="mt-1">Обнаружено: <span className="font-mono text-zinc-200">{String(selectedLink.detected_at ?? "unknown")}</span></div>
                <div className="mt-1">Статус: <Badge variant="outline">{String(selectedLink.status ?? "pending")}</Badge></div>
              </div>
              <textarea className="min-h-20 rounded-md border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-300/60" placeholder="Analyst note" value={analystNote} onChange={(event) => setAnalystNote(event.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="solid" onClick={() => verifySelectedLink(true)}><ShieldCheck data-icon="inline-start" /> Подтвердить</Button>
                <Button variant="outline" onClick={() => verifySelectedLink(false)}><ShieldX data-icon="inline-start" /> Отклонить</Button>
              </div>
            </div>
          ) : selected ? (
            <div className="flex flex-col gap-3 text-sm">
              <Button variant="solid" onClick={expandSelected}><Expand data-icon="inline-start" /> Expand related entities</Button>
              {selectedEntityId ? <Button variant="outline" onClick={() => setShowFingerprint((value) => !value)}><Fingerprint data-icon="inline-start" /> Показать цифровой отпечаток</Button> : null}
              {showFingerprint && selectedEntityId ? <FingerprintInspector entityId={selectedEntityId} /> : null}
              {Object.entries(selected).slice(0, 10).map(([key, value]) => (
                <div key={key} className="rounded-md border border-zinc-800/70 bg-black/25 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">{key}</div>
                  <div className="mt-1 break-words font-mono text-xs text-zinc-300">{String(typeof value === "object" ? JSON.stringify(value) : value)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-zinc-800/70 bg-black/25 p-4 text-sm text-zinc-500">Click any graph node to inspect metadata, or click an amber dashed link to verify a hidden identity match.</div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {(payload.clusters ?? []).map((cluster) => <Badge key={cluster.id} variant="outline" style={{ borderColor: cluster.color, color: cluster.color }}>{cluster.id}: {cluster.size}</Badge>)}
          </div>
          <Button className="mt-4 w-full" variant="outline" onClick={exportJson}><Download data-icon="inline-start" /> Download graph JSON</Button>
        </CardContent>
      </Card>
    </div>
  );
}
