import type { Alert, CaseRecord, Entity, Evidence, GraphPayload, Source } from "./types";

export const demoSources: Source[] = [];
export const demoAlerts: Alert[] = [];
export const demoEntities: Entity[] = [];
export const demoCases: CaseRecord[] = [];
export const demoEvidence: Evidence[] = [];
export const demoGraph: GraphPayload = { nodes: [], edges: [] };

export const demoSummary = {
  total_crawled_sources: 0,
  active_crawl_jobs: 0,
  high_risk_alerts: 0,
  new_entities_discovered: 0,
  high_risk_wallets: 0,
  leak_mentions: 0,
  top_risky_clusters: [],
  system_health: { api: "demo exports disabled", crawler: "configured sources only", redaction: "enabled" }
};

export const demoRiskTrends: Array<{ date: string; risk: number; alerts: number }> = [];
export const demoCategoryDistribution: Array<{ category: string; count: number }> = [];
