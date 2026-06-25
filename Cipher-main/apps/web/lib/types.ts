export type Source = {
  id: number;
  url: string;
  source_type: string;
  label: string;
  name?: string;
  type?: string;
  url_or_identifier?: string;
  enabled?: boolean;
  legal_basis_note?: string;
  items_collected_count?: number;
  last_sync_status?: string;
  is_allowlisted: boolean;
  status: string;
  last_crawled_at?: string;
  created_at: string;
};

export type Alert = {
  id: number;
  title: string;
  category: string;
  risk_score: number;
  confidence: number;
  status: string;
  source_id: number;
  page_id: number;
  item_id?: number;
  primary_entity_id?: number;
  reason_summary: string;
  created_at: string;
  assigned_to?: number;
  content_hash?: string;
  duplicate_count?: number;
};

export type Entity = {
  id: number;
  entity_type: string;
  type?: string;
  value_hash: string;
  value_redacted: string;
  normalized_value: string;
  risk_score: number;
  first_seen: string;
  last_seen: string;
  metadata_json: Record<string, unknown>;
};

export type CaseRecord = {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  overall_risk_score: number;
  assigned_to?: number;
  created_at: string;
  updated_at: string;
};

export type Evidence = {
  id: number;
  page_id?: number;
  alert_id?: number;
  evidence_type: string;
  storage_path: string;
  sha256_hash: string;
  extracted_text_redacted: string;
  created_at: string;
  redaction_status: string;
};

export type GraphPayload = {
  nodes: Array<{ id: string; type: string; label: string; riskScore: number; metadata: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; label: string; relationshipType: string; weight?: number; metadata?: Record<string, unknown> }>;
  clusters?: Array<{ id: string; node_ids: string[]; size: number; max_risk: number; color: string }>;
};

export type SlangTerm = {
  id: number;
  term: string;
  language: string;
  category: string;
  risk_weight: number;
  notes: string;
};


export type Investigation = {
  id: number;
  input_text: string;
  investigation_type: string;
  type?: string;
  status: string;
  category_hint?: string;
  max_results: number;
  risk_threshold: number;
  summary?: string;
  result_counts?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type InvestigationResult = {
  investigation: Investigation;
  documents: Array<Record<string, unknown>>;
  entities: Entity[];
  signals: Array<Record<string, unknown>>;
  graph: GraphPayload;
  next_steps?: string[];
  errors?: string[];
};

export type MapRoute = {
  id: string;
  from_city: string;
  to_city: string;
  from_latitude: number;
  from_longitude: number;
  to_latitude: number;
  to_longitude: number;
  category: string;
  route_source?: "co_mentioned" | "category_sequence";
  signal_count: number;
  max_risk: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  first_seen?: string | null;
  last_seen?: string | null;
  item_ids?: number[];
};

export type MapRoutesResponse = {
  routes: MapRoute[];
  diagnostics: {
    location_rows: number;
    items_with_locations: number;
    multi_city_items: number;
    co_mentioned_routes: number;
    route_source: "co_mentioned" | "category_sequence";
  };
};

export type ReportRecord = {
  id: number;
  case_id?: number | null;
  title: string;
  html_content: string;
  json_content: Record<string, unknown>;
  created_at: string;
};