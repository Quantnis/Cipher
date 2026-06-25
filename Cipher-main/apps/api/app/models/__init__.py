from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="Authorized Analyst")
    email: Mapped[str] = mapped_column(String(180), unique=True, default="analyst@shadowgraph.kz")
    role: Mapped[str] = mapped_column(String(40), default="analyst")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Source(Base):
    __tablename__ = "sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(180))
    type: Mapped[str] = mapped_column(String(40), index=True)
    url_or_identifier: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    legal_basis_note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="configured")
    last_sync_status: Mapped[str] = mapped_column(String(80), default="never_run")
    last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    items_collected_count: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CollectionJob(Base):
    __tablename__ = "collection_jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    items_collected_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Investigation(Base):
    __tablename__ = "investigations"
    id: Mapped[int] = mapped_column(primary_key=True)
    input_text: Mapped[str] = mapped_column(Text)
    investigation_type: Mapped[str] = mapped_column(String(80), index=True)
    manual_route_override: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="queued", index=True)
    category_hint: Mapped[str | None] = mapped_column(String(120), nullable=True)
    max_results: Mapped[int] = mapped_column(Integer, default=25)
    risk_threshold: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str] = mapped_column(Text, default="")
    result_counts: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class InvestigationJob(Base):
    __tablename__ = "investigation_jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    investigation_id: Mapped[int] = mapped_column(ForeignKey("investigations.id"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="queued", index=True)
    stage: Mapped[str] = mapped_column(String(60), default="queued")
    connector_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RawItem(Base):
    __tablename__ = "raw_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id"), nullable=True, index=True)
    platform: Mapped[str] = mapped_column(String(40), index=True)
    source_url: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(String(260), default="")
    raw_text: Mapped[str] = mapped_column(Text)
    raw_text_redacted: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[str] = mapped_column(String(30), default="unknown")
    translated_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    content_hash: Mapped[str] = mapped_column(String(128), index=True)
    screenshot_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_category: Mapped[str] = mapped_column(String(80), default="unknown", index=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0, index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    __table_args__ = (UniqueConstraint("source_id", "content_hash", name="uq_raw_item_source_hash"),)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    raw_item_id: Mapped[int] = mapped_column(ForeignKey("raw_items.id"), unique=True, index=True)
    investigation_id: Mapped[int | None] = mapped_column(ForeignKey("investigations.id"), nullable=True, index=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id"), nullable=True, index=True)
    source_type: Mapped[str] = mapped_column(String(60), index=True)
    source_name: Mapped[str] = mapped_column(String(180), default="")
    source_url: Mapped[str] = mapped_column(Text, default="")
    title: Mapped[str] = mapped_column(String(260), default="")
    content_hash: Mapped[str] = mapped_column(String(128), index=True)
    language: Mapped[str] = mapped_column(String(30), default="unknown")
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class Entity(Base):
    __tablename__ = "entities"
    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(80), index=True)
    value: Mapped[str] = mapped_column(Text)
    value_hash: Mapped[str] = mapped_column(String(128), index=True)
    value_redacted: Mapped[str] = mapped_column(String(260))
    normalized_value: Mapped[str] = mapped_column(String(260), index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    __table_args__ = (UniqueConstraint("type", "normalized_value", name="uq_entity_type_value"),)


class ItemEntity(Base):
    __tablename__ = "item_entities"
    item_id: Mapped[int] = mapped_column(ForeignKey("raw_items.id"), primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), primary_key=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    extraction_method: Mapped[str] = mapped_column(String(80), default="regex")


class DocumentEntity(Base):
    __tablename__ = "document_entities"
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), primary_key=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    context_snippet: Mapped[str] = mapped_column(Text, default="")


class Classification(Base):
    __tablename__ = "classifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)
    category: Mapped[str] = mapped_column(String(120), index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    severity: Mapped[str] = mapped_column(String(40), default="low", index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    risk_signals: Mapped[list] = mapped_column(JSON, default=list)
    reasoning: Mapped[list] = mapped_column(JSON, default=list)
    recommended_next_steps: Mapped[list] = mapped_column(JSON, default=list)
    provider: Mapped[str] = mapped_column(String(80), default="rules")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RiskSignal(Base):
    __tablename__ = "risk_signals"
    id: Mapped[int] = mapped_column(primary_key=True)
    investigation_id: Mapped[int | None] = mapped_column(ForeignKey("investigations.id"), nullable=True, index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    alert_id: Mapped[int | None] = mapped_column(ForeignKey("alerts.id"), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(120), index=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0, index=True)
    risk_level: Mapped[str] = mapped_column(String(40), default="low", index=True)
    title: Mapped[str] = mapped_column(String(260), default="")
    snippet: Mapped[str] = mapped_column(Text, default="")
    source_type: Mapped[str] = mapped_column(String(60), default="", index=True)
    key_entities: Mapped[list] = mapped_column(JSON, default=list)
    risk_factors: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(40), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class GraphNode(Base):
    __tablename__ = "graph_nodes"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_type: Mapped[str] = mapped_column(String(80), index=True)
    label: Mapped[str] = mapped_column(String(260))
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    raw_item_id: Mapped[int | None] = mapped_column(ForeignKey("raw_items.id"), nullable=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class GraphEdge(Base):
    __tablename__ = "graph_edges"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_node_id: Mapped[int] = mapped_column(ForeignKey("graph_nodes.id"))
    target_node_id: Mapped[int] = mapped_column(ForeignKey("graph_nodes.id"))
    edge_type: Mapped[str] = mapped_column(String(80), index=True)
    weight: Mapped[float] = mapped_column(Float, default=1)
    evidence_item_id: Mapped[int | None] = mapped_column(ForeignKey("raw_items.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RiskScore(Base):
    __tablename__ = "risk_scores"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("raw_items.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String(80))
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    model_version: Mapped[str] = mapped_column(String(40), default="transparent-rules-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AnalystCase(Base):
    __tablename__ = "analyst_cases"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(220))
    summary: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(40), default="medium")
    status: Mapped[str] = mapped_column(String(40), default="new")
    main_entities: Mapped[list] = mapped_column(JSON, default=list)
    evidence_items: Mapped[list] = mapped_column(JSON, default=list)
    recommended_actions: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CaseDocument(Base):
    __tablename__ = "case_documents"
    case_id: Mapped[int] = mapped_column(ForeignKey("analyst_cases.id"), primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(220))
    description: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(40), default="medium")
    category: Mapped[str] = mapped_column(String(80), default="unknown")
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(40), default="New")
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id"), nullable=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("raw_items.id"), nullable=True)
    primary_entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    related_case_id: Mapped[int | None] = mapped_column(ForeignKey("analyst_cases.id"), nullable=True)
    reason_summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class Location(Base):
    __tablename__ = "locations"
    id: Mapped[int] = mapped_column(primary_key=True)
    city: Mapped[str] = mapped_column(String(120), index=True)
    region: Mapped[str] = mapped_column(String(120), default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("raw_items.id"), nullable=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    category: Mapped[str] = mapped_column(String(80), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CryptoWallet(Base):
    __tablename__ = "crypto_wallets"
    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String(160), unique=True)
    chain: Mapped[str] = mapped_column(String(40))
    evidence_item_id: Mapped[int | None] = mapped_column(ForeignKey("raw_items.id"), nullable=True)
    transaction_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class TelegramChannel(Base):
    __tablename__ = "telegram_channels"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(160), unique=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id"), nullable=True)
    last_message_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class Website(Base):
    __tablename__ = "websites"
    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(240), unique=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id"), nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("raw_items.id"), nullable=True)
    alert_id: Mapped[int | None] = mapped_column(ForeignKey("alerts.id"), nullable=True)
    evidence_type: Mapped[str] = mapped_column(String(80), default="text_snapshot")
    storage_path: Mapped[str] = mapped_column(Text, default="")
    sha256_hash: Mapped[str] = mapped_column(String(128))
    extracted_text_redacted: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(Text, default="")
    collector_version: Mapped[str] = mapped_column(String(80), default="shadowgraph-collector-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    redaction_status: Mapped[str] = mapped_column(String(40), default="redacted")


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int | None] = mapped_column(ForeignKey("analyst_cases.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(220))
    html_content: Mapped[str] = mapped_column(Text)
    json_content: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class Narrative(Base):
    __tablename__ = "narratives"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("analyst_cases.id"), index=True)
    content_json: Mapped[dict] = mapped_column(JSON, default=dict)
    document_hash: Mapped[str] = mapped_column(String(128), index=True)
    model: Mapped[str] = mapped_column(String(80), default="gpt-4o")
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    generation_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    raw_response: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class EntityFingerprint(Base):
    __tablename__ = "entity_fingerprints"
    id: Mapped[int] = mapped_column(primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), unique=True, index=True)
    vector_json: Mapped[list] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FingerprintLink(Base):
    __tablename__ = "fingerprint_links"
    id: Mapped[int] = mapped_column(primary_key=True)
    from_entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), index=True)
    to_entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), index=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    confidence_pct: Mapped[int] = mapped_column(Integer, default=0)
    components_json: Mapped[dict] = mapped_column("components", JSON, default=dict)
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    analyst_note: Mapped[str] = mapped_column(Text, default="")
    evidence_id: Mapped[int | None] = mapped_column(ForeignKey("evidence.id"), nullable=True)
    threshold_suppressed: Mapped[float] = mapped_column(Float, default=0)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(120))
    target_type: Mapped[str] = mapped_column(String(80))
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RiskWeight(Base):
    __tablename__ = "risk_weights"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    weight: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text)


class SlangTerm(Base):
    __tablename__ = "slang_terms"
    id: Mapped[int] = mapped_column(primary_key=True)
    term: Mapped[str] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(20), default="mixed")
    category: Mapped[str] = mapped_column(String(80))
    risk_weight: Mapped[float] = mapped_column(Float, default=1)
    notes: Mapped[str] = mapped_column(Text, default="")

class ConnectorConfig(Base):
    __tablename__ = "connector_configs"
    id: Mapped[int] = mapped_column(primary_key=True)
    connector_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180))
    type: Mapped[str] = mapped_column(String(80), index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config_json: Mapped[dict] = mapped_column("config", JSON, default=dict)
    health_status: Mapped[str] = mapped_column(String(80), default="configured")
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

