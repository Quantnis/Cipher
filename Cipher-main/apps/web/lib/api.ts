import type { Alert, CaseRecord, Entity, Evidence, GraphPayload, SlangTerm, Source } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } catch (error) {
    console.error(`ShadowGraph API request failed: ${path}`, error);
    return fallback;
  }
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  login: () => request("/auth/demo-login", { token: "local-session-unavailable", user: { name: "Offline", role: "analyst" } }, { method: "POST" }),
  summary: () => request("/dashboard/summary", { total_crawled_sources: 0, total_monitored_sources: 0, items_collected_today: 0, high_risk_alerts: 0, active_cases: 0, new_entities_discovered: 0, high_risk_wallets: 0, leak_mentions: 0, top_risky_clusters: [], system_health: { api: "offline" } }),
  riskTrends: () => request<Array<{ date: string; risk: number; alerts: number }>>("/dashboard/risk-trends", []),
  categoryDistribution: () => request<Array<{ category: string; count: number }>>("/dashboard/category-distribution", []),
  sources: () => request<Source[]>("/sources", []),
  createSource: (payload: Partial<Source> & { legal_basis_note?: string }) => request<Source>("/sources", {} as Source, json(payload)),
  runSource: (id: number) => request(`/sources/${id}/run`, { status: "failed", message: "Source run failed" }, { method: "POST" }),
  alerts: () => request<Alert[]>("/alerts", []),
  alert: (id: number) => request<Alert & { evidence?: Evidence[] }>(`/alerts/${id}`, null as any),
  bulkCreateCaseFromAlerts: (alertIds: number[]) => request<CaseRecord>("/alerts/bulk/create-case", {} as CaseRecord, json({ alert_ids: alertIds })),
  items: () => request<any[]>("/items", []),
  ingestManual: (raw_text: string, source_id?: number) => request("/items/manual", { item: null, entities: [], risk: null }, json({ raw_text, source_id, title: "Manual analyst submission", platform: "manual_upload", source_url: "manual://analyst-paste" })),
  entities: () => request<Entity[]>("/entities", []),
  entity: (id: number) => request<Entity & { alerts?: Alert[]; risk_explanation?: Record<string, string> }>(`/entities/${id}`, null as any),
  cases: () => request<CaseRecord[]>("/cases", []),
  evidence: () => request<Evidence[]>("/evidence", []),
  graph: () => request<GraphPayload>("/graph", { nodes: [], edges: [], clusters: [] }),
  graphExpand: (nodeId: string) => request<GraphPayload>(`/graph/expand/${encodeURIComponent(nodeId)}`, { nodes: [], edges: [], clusters: [] }),
  graphExport: () => request<GraphPayload>("/graph/export", { nodes: [], edges: [], clusters: [] }),
  rebuildGraph: () => request("/graph/rebuild", { status: "failed" }, { method: "POST" }),
  caseFromCluster: (cluster_id = "top-risk") => request("/graph/case-from-cluster", { id: 0 }, json({ cluster_id })),
  mapSignals: () => request<any[]>("/map/signals", []),
  citySignals: (city: string) => request(`/map/cities/${encodeURIComponent(city)}`, { city, signals: [], items: [] }),
  integrations: () => request<Record<string, { configured: boolean; message: string }>>("/settings/integrations", {}),
  auditLogs: () => request<any[]>("/admin/audit-logs", []),
  riskWeights: () => request<any[]>("/admin/risk-weights", []),
  slangDictionary: () => request<SlangTerm[]>("/admin/slang-dictionary", []),
  addSlangTerm: (payload: Omit<SlangTerm, "id">) => request<SlangTerm>("/admin/slang-dictionary", { id: Date.now(), ...payload }, json(payload)),
  demoRun: () => request("/crawler/demo-run?source_id=1&pages=1", { safety: "Explicit demo mode unavailable.", alerts: [] }, { method: "POST" }),
  createCase: (title: string) => request("/cases", { id: Date.now(), title, description: "", status: "new", priority: "Medium", overall_risk_score: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, json({ title, priority: "High" })),
  addAlertToCase: (caseId: number, alertId: number) => request(`/cases/${caseId}/add-alert`, { case_id: caseId, item_type: "alert", item_id: alertId }, json({ item_id: alertId })),
  generateReport: (caseId: number) => request(`/cases/${caseId}/generate-report`, { id: Date.now(), case_id: caseId, title: "Report unavailable", html_content: "<article><h1>Report unavailable</h1></article>", json_content: {}, created_at: new Date().toISOString() }, { method: "POST" }),
  getNarrative: (caseId: number) => request<any>(`/cases/${caseId}/narrative`, { status: "empty", case_id: caseId, narrative: null }),
  generateNarrative: (caseId: number) => request<any>(`/cases/${caseId}/narrative`, { error: "unavailable", message: "Narrative generation unavailable" }, { method: "POST" }),
  patchRiskWeight: (name: string, weight: number) => request("/admin/risk-weights", { name, weight }, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, weight }) }),
  osintCrypto: (address: string, chain = "auto") => request<any>("/osint/crypto", {}, json({ address, chain })),
  osintLeaks: (indicator: string) => request<any>("/osint/leaks", {}, json({ indicator })),
  osintDomain: (target: string) => request<any>("/osint/domain", {}, json({ target })),
  osintSocial: (query: string) => request<any>("/osint/social", {}, json({ query })),
  analyzeFingerprint: (entityId: number) => request<any>(`/entities/${entityId}/fingerprint/analyze`, {}, { method: "POST" }),
  fingerprintReindex: () => request<any>("/fingerprint/reindex", { status: "failed" }, { method: "POST" }),
  hiddenLinks: (minScore = 0.82) => request<any[]>(`/fingerprint/hidden-links?min_score=${minScore}`, []),
  verifyHiddenLink: (linkId: number, verified: boolean, analyst_note = "") => request<any>(`/fingerprint/hidden-links/${linkId}/verify`, {}, json({ verified, analyst_note })),
  entityFingerprint: (entityId: number) => request<any>(`/entities/${entityId}/fingerprint`, null as any)
};


