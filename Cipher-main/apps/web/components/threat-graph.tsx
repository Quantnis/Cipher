
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import { Brain, Download, Expand, FileJson, Fingerprint, ImageDown, LocateFixed, Network, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { FingerprintInspector } from "@/components/fingerprint-inspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { GraphPayload } from "@/lib/types";
import { categoryColor, hexToRgba } from "@/lib/colors";

const nodeColor: Record<string, string> = {
  Root: "#79C0FF",
  Source: "#79C0FF",
  Category: "#D29922",
  Document: "#8B949E",
  TelegramHandle: "#2F81F7",
  CryptoWallet: "#BC8CFF",
  City: "#3FB950",
  Product: "#A5A5A5",
  LeakMention: "#2F81F7",
  Case: "#79C0FF",
  web: "#79C0FF",
  telegram: "#2F81F7",
  darknet: "#F85149",
  manual_upload: "#A5A5A5",
  "post/message": "#8B949E",
  crypto_wallet: "#BC8CFF",
  city: "#3FB950",
  domain: "#79C0FF",
  url: "#79C0FF",
  phone: "#D29922",
  keyword: "#BC8CFF"
};

type TreeNode = {
  id: string;
  graphId?: string;
  label: string;
  type: string;
  category: string;
  risk: number;
  metadata: Record<string, unknown>;
  children?: TreeNode[];
};

type CrossLink = {
  id: string;
  sourceTreeId: string;
  targetTreeId: string;
  label: string;
  relationshipType: string;
  metadata?: Record<string, unknown>;
};

type Point = { x: number; y: number; angle: number };
type NodeOffset = { x: number; y: number };
type NodeDragState = {
  pointerId: number;
  nodeId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

type RadialModel = {
  treeData: TreeNode;
  crossLinks: CrossLink[];
  nodeLookup: Map<string, TreeNode>;
  categoryIds: string[];
};

const VIEWBOX = { width: 1120, height: 760, cx: 560, cy: 380, radius: 330 };
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 2.6;

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function compactLabel(value: string, max = 28) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function graphNodeColor(node: TreeNode) {
  return categoryColor(node.category) || nodeColor[node.type] || "#8B949E";
}

function treeId(prefix: string, id: string) {
  return `${prefix}:${id}`;
}

function relationshipIsCrossLink(type: string) {
  return type.includes("SIMILARITY") || type.includes("HIDDEN");
}

function buildHierarchyModel(graph: GraphPayload): RadialModel {
  const graphNodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodesByTreeId = new Map<string, TreeNode>();
  const root: TreeNode = { id: "root", label: "ShadowGraph KZ", type: "Root", category: "default", risk: 0, metadata: {}, children: [] };
  nodesByTreeId.set(root.id, root);

  const sourceForItem = new Map<string, string>();
  const entityEdgesByItem = new Map<string, string[]>();
  const assignedEntities = new Set<string>();
  const deferredEntityLinks: CrossLink[] = [];

  for (const edge of graph.edges) {
    if (edge.relationshipType === "DOCUMENT_FROM_SOURCE") sourceForItem.set(edge.target, edge.source);
    if (!relationshipIsCrossLink(edge.relationshipType) && edge.target.startsWith("entity-") && edge.source.startsWith("item-")) {
      const list = entityEdgesByItem.get(edge.source) ?? [];
      list.push(edge.target);
      entityEdgesByItem.set(edge.source, list);
    }
  }

  const categoryMap = new Map<string, TreeNode>();
  const sourceMap = new Map<string, TreeNode>();

  function ensureCategory(category: string) {
    const safeCategory = category || "uncategorized";
    const id = treeId("category", safeCategory);
    let node = categoryMap.get(safeCategory);
    if (!node) {
      node = { id, graphId: safeCategory, label: safeCategory.replace(/_/g, " "), type: "Category", category: safeCategory, risk: 0, metadata: { category: safeCategory }, children: [] };
      categoryMap.set(safeCategory, node);
      nodesByTreeId.set(id, node);
      root.children?.push(node);
    }
    return node;
  }

  function ensureSource(categoryNode: TreeNode, sourceLabel: string, sourceType: string) {
    const sourceKey = `${categoryNode.category}:${sourceType}:${sourceLabel}`;
    const id = treeId("source", sourceKey);
    let node = sourceMap.get(sourceKey);
    if (!node) {
      node = { id, label: sourceLabel || sourceType || "unknown source", type: sourceType || "Source", category: categoryNode.category, risk: 0, metadata: { source_type: sourceType, label: sourceLabel }, children: [] };
      sourceMap.set(sourceKey, node);
      nodesByTreeId.set(id, node);
      categoryNode.children?.push(node);
    }
    return node;
  }

  for (const item of graph.nodes.filter((node) => node.id.startsWith("item-") || node.type === "Document")) {
    const category = String(item.metadata?.risk_category ?? item.metadata?.category ?? item.type ?? "uncategorized");
    const categoryNode = ensureCategory(category);
    categoryNode.risk = Math.max(categoryNode.risk, item.riskScore ?? 0);

    const source = graphNodes.get(sourceForItem.get(item.id) ?? "");
    const sourceType = String(source?.metadata?.source_type ?? source?.metadata?.type ?? item.metadata?.platform ?? "source");
    const sourceLabel = String(source?.label ?? sourceType);
    const sourceNode = ensureSource(categoryNode, sourceLabel, sourceType);
    sourceNode.risk = Math.max(sourceNode.risk, item.riskScore ?? 0);

    const itemTree: TreeNode = {
      id: treeId("item", item.id),
      graphId: item.id,
      label: item.label,
      type: "Document",
      category,
      risk: item.riskScore ?? 0,
      metadata: item.metadata ?? {},
      children: []
    };
    nodesByTreeId.set(itemTree.id, itemTree);
    sourceNode.children?.push(itemTree);

    for (const entityId of entityEdgesByItem.get(item.id) ?? []) {
      const entity = graphNodes.get(entityId);
      if (!entity) continue;
      const entityTreeId = treeId("entity", entity.id);
      if (assignedEntities.has(entity.id)) {
        deferredEntityLinks.push({ id: `duplicate-${item.id}-${entity.id}`, sourceTreeId: itemTree.id, targetTreeId: entityTreeId, label: "also mentioned", relationshipType: "DUPLICATE_ENTITY_PARENT" });
        continue;
      }
      assignedEntities.add(entity.id);
      const entityTree: TreeNode = {
        id: entityTreeId,
        graphId: entity.id,
        label: entity.label,
        type: entity.type,
        category,
        risk: entity.riskScore ?? item.riskScore ?? 0,
        metadata: entity.metadata ?? {}
      };
      nodesByTreeId.set(entityTreeId, entityTree);
      itemTree.children?.push(entityTree);
    }
    if (itemTree.children?.length === 0) delete itemTree.children;
  }

  const hiddenCategory = ensureCategory("hidden_identity_link");
  const hiddenSource = ensureSource(hiddenCategory, "Fingerprint matches", "fingerprint");
  for (const entity of graph.nodes.filter((node) => node.id.startsWith("entity-") && !assignedEntities.has(node.id))) {
    assignedEntities.add(entity.id);
    const entityTree: TreeNode = {
      id: treeId("entity", entity.id),
      graphId: entity.id,
      label: entity.label,
      type: entity.type,
      category: "hidden_identity_link",
      risk: entity.riskScore ?? 0,
      metadata: entity.metadata ?? {}
    };
    nodesByTreeId.set(entityTree.id, entityTree);
    hiddenSource.children?.push(entityTree);
  }

  for (const node of [...sourceMap.values(), ...categoryMap.values()]) {
    node.children?.sort((a, b) => b.risk - a.risk || a.label.localeCompare(b.label));
    if (node.children?.length === 0) delete node.children;
  }
  root.children?.sort((a, b) => b.risk - a.risk || a.label.localeCompare(b.label));

  const crossLinks: CrossLink[] = [...deferredEntityLinks];
  for (const edge of graph.edges.filter((edge) => relationshipIsCrossLink(edge.relationshipType))) {
    crossLinks.push({
      id: edge.id,
      sourceTreeId: treeId("entity", edge.source),
      targetTreeId: treeId("entity", edge.target),
      label: edge.label,
      relationshipType: edge.relationshipType,
      metadata: edge.metadata
    });
  }

  return { treeData: root, crossLinks, nodeLookup: nodesByTreeId, categoryIds: root.children?.map((node) => node.id) ?? [] };
}

function pruneTree(node: TreeNode, collapsed: Set<string>): TreeNode {
  const copy: TreeNode = { ...node };
  if (node.children && !collapsed.has(node.id)) copy.children = node.children.map((child) => pruneTree(child, collapsed));
  else delete copy.children;
  return copy;
}

function polarPoint(node: HierarchyPointNode<TreeNode>): Point {
  const angle = node.x - Math.PI / 2;
  return { x: VIEWBOX.cx + node.y * Math.cos(angle), y: VIEWBOX.cy + node.y * Math.sin(angle), angle };
}

function nodePoint(node: HierarchyPointNode<TreeNode>, offsets: Map<string, NodeOffset>): Point {
  const point = polarPoint(node);
  const offset = offsets.get(node.data.id);
  return offset ? { ...point, x: point.x + offset.x, y: point.y + offset.y } : point;
}

function radialLink(source: HierarchyPointNode<TreeNode>, target: HierarchyPointNode<TreeNode>, offsets: Map<string, NodeOffset>) {
  const s = nodePoint(source, offsets);
  const t = nodePoint(target, offsets);
  const baseS = polarPoint(source);
  const baseT = polarPoint(target);
  const midRadius = (source.y + target.y) / 2;
  const offset = { x: ((s.x - baseS.x) + (t.x - baseT.x)) / 2, y: ((s.y - baseS.y) + (t.y - baseT.y)) / 2 };
  const c1 = { x: VIEWBOX.cx + midRadius * Math.cos(baseS.angle) + offset.x, y: VIEWBOX.cy + midRadius * Math.sin(baseS.angle) + offset.y };
  const c2 = { x: VIEWBOX.cx + midRadius * Math.cos(baseT.angle) + offset.x, y: VIEWBOX.cy + midRadius * Math.sin(baseT.angle) + offset.y };
  return `M${s.x.toFixed(1)} ${s.y.toFixed(1)} C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`;
}

function crossLinkPath(source: HierarchyPointNode<TreeNode>, target: HierarchyPointNode<TreeNode>, offsets: Map<string, NodeOffset>) {
  const s = nodePoint(source, offsets);
  const t = nodePoint(target, offsets);
  return `M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${VIEWBOX.cx.toFixed(1)} ${VIEWBOX.cy.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`;
}

function SimilarityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500"><span>{label}</span><span className="font-mono text-signal-warning">{value}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-signal-warning to-signal-critical" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export function ThreatGraph({ graph }: { graph: GraphPayload }) {
  const [payload, setPayload] = useState(graph);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<string | null>(null);
  const [showNetworkLinks, setShowNetworkLinks] = useState(false);
  const [focusPath, setFocusPath] = useState<string[]>(["root"]);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [selectedLink, setSelectedLink] = useState<any | null>(null);
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [creating, setCreating] = useState(false);
  const [analystNote, setAnalystNote] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [initializedCollapse, setInitializedCollapse] = useState(false);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [nodeOffsets, setNodeOffsets] = useState<Map<string, NodeOffset>>(new Map());
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const nodeDragRef = useRef<NodeDragState | null>(null);
  const suppressNodeClickRef = useRef<string | null>(null);

  useEffect(() => { setPayload(graph); setInitializedCollapse(false); setNodeOffsets(new Map()); setFocusPath(["root"]); setSelectedTreeNodeId(null); }, [graph]);

  const model = useMemo(() => buildHierarchyModel(payload), [payload]);

  useEffect(() => {
    if (initializedCollapse) return;
    setCollapsed(new Set(model.categoryIds));
    setInitializedCollapse(true);
  }, [initializedCollapse, model.categoryIds]);

  const layout = useMemo(() => {
    const focusRoot = model.nodeLookup.get(focusPath[focusPath.length - 1] ?? "root") ?? model.treeData;
    const visibleTree = pruneTree(focusRoot, collapsed);
    const root = hierarchy<TreeNode>(visibleTree);
    const radial = tree<TreeNode>()
      .size([Math.PI * 2, VIEWBOX.radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.8) / Math.max(1, a.depth));
    const treeRoot = radial(root);
    const nodes = treeRoot.descendants();
    const byId = new Map(nodes.map((node) => [node.data.id, node]));
    return { root: treeRoot, nodes, links: treeRoot.links(), byId };
  }, [collapsed, focusPath, model.nodeLookup, model.treeData]);

  const visibleCrossLinks = useMemo(() => showNetworkLinks ? model.crossLinks.filter((link) => layout.byId.has(link.sourceTreeId) && layout.byId.has(link.targetTreeId)) : [], [layout.byId, model.crossLinks, showNetworkLinks]);
  const focusCrumbs = focusPath.map((id) => model.nodeLookup.get(id)).filter(Boolean) as TreeNode[];

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
    setInitializedCollapse(false);
    toast.success("Entity expansion loaded");
  }

  async function exportJson() {
    const exported = await api.graphExport();
    download("shadowgraph-kz-radial-tree.json", JSON.stringify(exported, null, 2), "application/json");
  }

  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    const url = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0D1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "shadowgraph-kz-radial-tree.png";
      link.click();
    };
    image.src = url;
  }

  async function verifySelectedLink(verified: boolean) {
    const linkId = Number(selectedLink?.link_id);
    if (!linkId) return;
    await api.verifyHiddenLink(linkId, verified, analystNote);
    setPayload(await api.graph());
    setSelectedLink(null);
    setAnalystNote("");
    setInitializedCollapse(false);
    toast.success(verified ? "Hidden link verified" : "Hidden link rejected");
  }

  function selectTreeNode(node: HierarchyPointNode<TreeNode>) {
    if (suppressNodeClickRef.current === node.data.id) {
      suppressNodeClickRef.current = null;
      return;
    }
    const hasChildren = Boolean(model.nodeLookup.get(node.data.id)?.children?.length);
    if (hasChildren) {
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(node.data.id)) next.delete(node.data.id);
        else next.add(node.data.id);
        return next;
      });
    }
    setSelectedTreeNodeId(node.data.id);
    setSelectedNodeId(node.data.graphId ?? null);
    setSelected(node.data.metadata ?? null);
    setSelectedLink(null);
    setShowFingerprint(false);
  }

  function selectCrossLink(link: CrossLink) {
    setSelectedLink(link.metadata ?? { relationshipType: link.relationshipType, label: link.label });
    setSelected(null);
    setSelectedNodeId(null);
  }


  function focusSelectedNode() {
    if (!selectedTreeNodeId || !model.nodeLookup.has(selectedTreeNodeId)) return;
    setFocusPath((current) => current[current.length - 1] === selectedTreeNodeId ? current : [...current, selectedTreeNodeId]);
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(selectedTreeNodeId);
      return next;
    });
    setNodeOffsets(new Map());
    setViewTransform({ x: 0, y: 0, scale: 1 });
  }

  function jumpToFocus(index: number) {
    setFocusPath((current) => current.slice(0, index + 1));
    setNodeOffsets(new Map());
    setViewTransform({ x: 0, y: 0, scale: 1 });
  }

  function resetFocus() {
    setFocusPath(["root"]);
    setSelectedTreeNodeId(null);
    setNodeOffsets(new Map());
    setViewTransform({ x: 0, y: 0, scale: 1 });
  }

  async function createDeepAnalysisReport() {
    if (!selectedEntityId) return;
    setDeepAnalyzing(true);
    const report = await api.deepAnalysisReport(selectedEntityId);
    setDeepAnalyzing(false);
    if (report?.id) {
      toast.success("Deep analysis report created");
      window.location.href = `/reports?report_id=${report.id}`;
    } else {
      toast.error("Deep analysis report failed");
    }
  }
  function svgPointFromPointer(event: React.PointerEvent<SVGSVGElement> | React.WheelEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * VIEWBOX.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * VIEWBOX.height
    };
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const point = svgPointFromPointer(event);
    setViewTransform((current) => {
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * (event.deltaY > 0 ? 0.92 : 1.08)));
      const ratio = nextScale / current.scale;
      return {
        scale: nextScale,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio
      };
    });
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: viewTransform.x, y: viewTransform.y };
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - pan.startX) / Math.max(1, rect.width)) * VIEWBOX.width;
    const dy = ((event.clientY - pan.startY) / Math.max(1, rect.height)) * VIEWBOX.height;
    setViewTransform((current) => ({ ...current, x: pan.x + dx, y: pan.y + dy }));
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  }

  function contentPointFromClient(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / Math.max(1, rect.width)) * VIEWBOX.width;
    const svgY = ((clientY - rect.top) / Math.max(1, rect.height)) * VIEWBOX.height;
    return { x: (svgX - viewTransform.x) / viewTransform.scale, y: (svgY - viewTransform.y) / viewTransform.scale };
  }

  function handleNodePointerDown(event: React.PointerEvent<SVGGElement>, node: HierarchyPointNode<TreeNode>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = contentPointFromClient(event.clientX, event.clientY);
    const offset = nodeOffsets.get(node.data.id) ?? { x: 0, y: 0 };
    nodeDragRef.current = { pointerId: event.pointerId, nodeId: node.data.id, startX: point.x, startY: point.y, offsetX: offset.x, offsetY: offset.y, moved: false };
  }

  function handleNodePointerMove(event: React.PointerEvent<SVGGElement>) {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const point = contentPointFromClient(event.clientX, event.clientY);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    setNodeOffsets((current) => {
      const next = new Map(current);
      next.set(drag.nodeId, { x: drag.offsetX + dx, y: drag.offsetY + dy });
      return next;
    });
  }

  function handleNodePointerUp(event: React.PointerEvent<SVGGElement>) {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (drag.moved) suppressNodeClickRef.current = drag.nodeId;
    nodeDragRef.current = null;
  }

  const selectedEntityId = selectedNodeId?.startsWith("entity-") ? Number(selectedNodeId.replace("entity-", "")) : null;
  const components = selectedLink?.components && typeof selectedLink.components === "object" ? selectedLink.components as Record<string, number> : {};
  const expandedCount = model.categoryIds.filter((id) => !collapsed.has(id)).length;

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <CardHeader className="flex-row items-center justify-between">
          <div className="min-w-0">
            <CardTitle>Threat radial tree</CardTitle>
            <p className="mt-1 truncate text-xs text-zinc-500">Root to categories to sources to signals. Cross-category identity matches render as amber overlay arcs.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportPng}><ImageDown data-icon="inline-start" /> PNG</Button>
            <Button size="sm" variant="outline" onClick={exportJson}><FileJson data-icon="inline-start" /> JSON</Button>
            <Button size="sm" variant="outline" onClick={createCase} disabled={creating || payload.nodes.length === 0}>{creating ? "Creating..." : "Create case"}</Button>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-0">
          {payload.nodes.length === 0 ? (
            <div className="grid h-full place-items-center p-8 text-center text-sm text-zinc-500">No graph nodes yet. Add a source or ingest manual public text to extract entities and build relationships.</div>
          ) : (
            <div className="relative h-full overflow-hidden bg-[#070b14]">
              <svg
                ref={svgRef}
                className="h-full w-full cursor-move touch-none"
                viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
                role="img"
                aria-label="ShadowGraph KZ radial threat tree"
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(event) => { const tag = (event.target as Element).tagName.toLowerCase(); if (tag === "svg" || tag === "rect") { setSelectedTreeNodeId(null); setSelectedLink(null); } }}
                onDoubleClick={() => setViewTransform({ x: 0, y: 0, scale: 1 })}
              >
                <defs>
                  <radialGradient id="radialBg"><stop offset="0%" stopColor="#1f6feb" stopOpacity="0.18" /><stop offset="55%" stopColor="#0D1117" stopOpacity="0.38" /><stop offset="100%" stopColor="#070b14" stopOpacity="1" /></radialGradient>
                  <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <filter id="hotGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <pattern id="graphGrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#2F81F7" strokeOpacity="0.08" strokeWidth="1" /></pattern>
                </defs>
                <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#radialBg)" />
                <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#graphGrid)" />
                <g transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}>
                  {[95, 175, 255, 330].map((radius) => <circle key={radius} cx={VIEWBOX.cx} cy={VIEWBOX.cy} r={radius} fill="none" stroke="#30363D" strokeOpacity="0.42" strokeWidth="1" />)}


                  <g>
                    {layout.links.map((link) => {
                    const color = graphNodeColor(link.target.data);
                    return <path key={`${link.source.data.id}-${link.target.data.id}`} d={radialLink(link.source, link.target, nodeOffsets)} fill="none" stroke={hexToRgba(color, 0.34)} strokeWidth={Math.max(1, 3 - link.target.depth * 0.35)} strokeLinecap="round" />;
                  })}
                </g>


                  <g>
                    {visibleCrossLinks.map((link) => {
                    const source = layout.byId.get(link.sourceTreeId);
                    const target = layout.byId.get(link.targetTreeId);
                    if (!source || !target) return null;
                    const hidden = link.relationshipType.includes("SIMILARITY") || link.relationshipType.includes("HIDDEN");
                    return <path key={link.id} d={crossLinkPath(source, target, nodeOffsets)} fill="none" stroke={hidden ? "#D29922" : "#79C0FF"} strokeWidth={hidden ? 2.2 : 1.4} strokeDasharray={hidden ? "6 5" : "3 5"} strokeOpacity={hidden ? 0.82 : 0.42} className="cursor-pointer" onPointerDown={(event) => event.stopPropagation()} onClick={() => selectCrossLink(link)} />;
                  })}
                </g>


                  <g>
                    {layout.nodes.map((node) => {
                    const point = nodePoint(node, nodeOffsets);
                    const full = model.nodeLookup.get(node.data.id);
                    const hasHiddenChildren = Boolean(full?.children?.length && collapsed.has(node.data.id));
                    const color = graphNodeColor(node.data);
                    const selectedNode = selectedTreeNodeId === node.data.id;
                    const radius = node.depth === 0 ? 17 : node.depth === 1 ? 12 : node.depth === 2 ? 8 : 5.5;
                    const labelDistance = node.depth === 0 ? 0 : node.depth === 1 ? 24 : node.depth === 2 ? 16 : 10;
                    const rightSide = point.x >= VIEWBOX.cx;
                    const showLabel = node.depth <= 2 || selectedNode || layout.nodes.length < 70;
                    return (
                      <g key={node.data.id} transform={`translate(${point.x},${point.y})`} className="cursor-grab active:cursor-grabbing" onPointerDown={(event) => handleNodePointerDown(event, node)} onPointerMove={handleNodePointerMove} onPointerUp={handleNodePointerUp} onPointerCancel={handleNodePointerUp} onClick={() => selectTreeNode(node)}>
                        <circle r={radius + Math.max(5, node.data.risk / 15)} fill={hexToRgba(color, node.depth === 1 ? 0.26 : 0.14)} filter="url(#nodeGlow)" />
                        <circle r={radius} fill={node.depth === 0 ? "#0D1117" : hexToRgba(color, 0.2)} stroke={selectedNode ? "#22D3EE" : color} strokeWidth={selectedNode ? 3 : 1.8} filter={node.data.risk >= 80 ? "url(#hotGlow)" : undefined} />
                        {hasHiddenChildren ? <text y="3.5" textAnchor="middle" fill="#E6EDF3" fontSize="10" fontFamily="monospace">+</text> : null}
                        {showLabel ? (
                          <text x={node.depth === 0 ? 0 : rightSide ? labelDistance : -labelDistance} y={node.depth === 0 ? -26 : 4} textAnchor={node.depth === 0 ? "middle" : rightSide ? "start" : "end"} fill={node.depth <= 1 ? "#E6EDF3" : "#8B949E"} fontSize={node.depth === 1 ? 12 : 10.5} fontFamily="monospace" paintOrder="stroke" stroke="#070b14" strokeWidth="3" strokeLinejoin="round">{compactLabel(node.data.label, node.depth === 1 ? 24 : 30)}</text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
                </g>
              </svg>
              <div className="absolute left-4 right-4 top-14 flex flex-wrap items-center gap-2 rounded-md border border-zinc-800/70 bg-black/35 px-3 py-2 text-xs backdrop-blur">
                {focusCrumbs.map((crumb, index) => (
                  <button key={`${crumb.id}-${index}`} className="font-mono text-zinc-300 transition hover:text-signal-accent" onClick={() => jumpToFocus(index)}>{compactLabel(crumb.label, 24)}</button>
                ))}
                {focusPath.length > 1 ? <Button size="sm" variant="outline" onClick={resetFocus}><RotateCcw data-icon="inline-start" /> Show full graph</Button> : null}
              </div>              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <Badge variant="cyan">{model.categoryIds.length} categories</Badge>
                <Badge variant="outline">{expandedCount} expanded</Badge>
                <Badge variant={showNetworkLinks ? "warning" : "outline"}>{showNetworkLinks ? `${visibleCrossLinks.length} cross-links visible` : "cross-links hidden"}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="flex min-h-0 flex-col">
        <CardHeader>
          <CardTitle>{selectedLink ? "Скрытая связь" : "Node inspector"}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">          <div className="grid gap-2">
            <Button variant={showNetworkLinks ? "solid" : "outline"} onClick={() => setShowNetworkLinks((value) => !value)}><Network data-icon="inline-start" /> {showNetworkLinks ? "Hide network links" : "Show network links"}</Button>
            <Button variant="outline" onClick={focusSelectedNode} disabled={!selectedTreeNodeId}><LocateFixed data-icon="inline-start" /> Focus on selection</Button>
            <Button variant="outline" onClick={resetFocus} disabled={focusPath.length === 1}><RotateCcw data-icon="inline-start" /> Reset graph focus</Button>
          </div>
          {selectedLink ? (
            <div className="flex flex-col gap-4 text-sm">
              <div className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-4 shadow-[0_0_32px_rgba(210,153,34,0.12)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-signal-warning">Обнаружена автоматически</div>
                <div className="mt-3 flex items-end justify-between"><span className="text-zinc-400">Сходство</span><span className="font-mono text-3xl text-white">{selectedLink.confidence_pct ?? "--"}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-signal-warning to-signal-critical" style={{ width: `${selectedLink.confidence_pct ?? 0}%` }} /></div>
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
              <textarea className="min-h-20 rounded-md border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-signal-warning/60" placeholder="Analyst note" value={analystNote} onChange={(event) => setAnalystNote(event.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="solid" onClick={() => verifySelectedLink(true)}><ShieldCheck data-icon="inline-start" /> Подтвердить</Button>
                <Button variant="outline" onClick={() => verifySelectedLink(false)}><ShieldX data-icon="inline-start" /> Отклонить</Button>
              </div>
            </div>
          ) : selected ? (
            <div className="flex flex-col gap-3 text-sm">
              <Button variant="solid" onClick={expandSelected}><Expand data-icon="inline-start" /> Expand related entities</Button>
              {selectedEntityId ? <Button variant="outline" onClick={createDeepAnalysisReport} disabled={deepAnalyzing}><Brain data-icon="inline-start" /> {deepAnalyzing ? "Analyzing..." : "Deep analysis (local AI)"}</Button> : null}
              {selectedEntityId ? <Button variant="outline" onClick={() => setShowFingerprint((value) => !value)}><Fingerprint data-icon="inline-start" /> Показать цифровой отпечаток</Button> : null}
              {showFingerprint && selectedEntityId ? <FingerprintInspector entityId={selectedEntityId} /> : null}
              {Object.entries(selected).slice(0, 12).map(([key, value]) => (
                <div key={key} className="rounded-md border border-zinc-800/70 bg-black/25 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">{key}</div>
                  <div className="mt-1 break-words font-mono text-xs text-zinc-300">{String(typeof value === "object" ? JSON.stringify(value) : value)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-zinc-800/70 bg-black/25 p-4 text-sm text-zinc-500">Click a category to expand the radial tree, click any node to inspect metadata, or click an amber dashed arc to verify a hidden identity match.</div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {(payload.clusters ?? []).map((cluster) => <Badge key={cluster.id} variant="outline" style={{ borderColor: categoryColor(String(cluster.id)), color: categoryColor(String(cluster.id)) }}>{cluster.id}: {cluster.size}</Badge>)}
          </div>
          <Button className="mt-4 w-full" variant="outline" onClick={exportJson}><Download data-icon="inline-start" /> Download graph JSON</Button>
        </CardContent>
      </Card>
    </div>
  );
}
