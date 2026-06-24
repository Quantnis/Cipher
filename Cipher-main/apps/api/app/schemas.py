from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class SourceIn(BaseModel):
    url: str | None = None
    source_type: str | None = None
    label: str | None = None
    name: str | None = None
    type: str | None = None
    url_or_identifier: str | None = None
    enabled: bool = True
    legal_basis_note: str = ""
    is_allowlisted: bool = False


class CrawlJobIn(BaseModel):
    source_id: int
    depth: int = Field(default=1, ge=1, le=3)
    priority: str = "normal"


class AlertUpdate(BaseModel):
    status: str | None = None
    assigned_to: int | None = None


class CaseIn(BaseModel):
    title: str
    description: str = ""
    summary: str = ""
    priority: str = "Medium"
    severity: str = "medium"


class CaseItemIn(BaseModel):
    item_id: int


class EvidenceIn(BaseModel):
    page_id: int | None = None
    item_id: int | None = None
    alert_id: int | None = None
    evidence_type: str = "screenshot"
    storage_path: str = ""
    extracted_text_redacted: str = ""
    source_url: str = ""


class ManualTextIn(BaseModel):
    source_id: int | None = None
    title: str = "Manual analyst submission"
    raw_text: str
    source_url: str = "manual://analyst-paste"
    platform: str = "manual_upload"


class IntegrationSettingsPatch(BaseModel):
    search_api_provider: str | None = None
    mapbox_token: str | None = None


class GraphQuery(BaseModel):
    risk_min: int = 0
    category: str | None = None
    entity_type: str | None = None


class RiskWeightPatch(BaseModel):
    name: str
    weight: float


class SlangTermIn(BaseModel):
    term: str
    language: str = "mixed"
    category: str
    risk_weight: float = 1
    notes: str = ""


class RiskScore(BaseModel):
    score: int
    confidence: float
    reasons: list[str]
    components: dict[str, int]


class GraphNode(BaseModel):
    id: str
    type: str
    label: str
    riskScore: int
    metadata: dict[str, Any] = {}


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    relationshipType: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class DemoLoginResponse(BaseModel):
    token: str
    user: dict[str, Any]
    issued_at: datetime
