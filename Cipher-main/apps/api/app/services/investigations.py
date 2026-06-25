from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.services.crawler import CollectionPipeline, PublicWebCollector
from app.services.graph import GraphService
from app.services.repository import to_dict

INVESTIGATION_TYPES = {
    "web_search",
    "telegram_public",
    "darknet_authorized",
    "entity_lookup",
    "crypto_wallet_lookup",
    "leak_mention_lookup",
    "mixed_full_scan",
    "manual_text_analysis",
}

CONNECTOR_VERSION = "shadowgraph-investigation-connectors-v1"
ROOT_DIR = Path(__file__).resolve().parents[4]


@dataclass
class InvestigationInput:
    input_text: str
    investigation_type: str = "mixed_full_scan"
    category: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    max_results: int = 25
    risk_threshold: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class JobContext:
    investigation_id: int
    connector_id: str
    max_results: int
    legal_notice: str = "public or analyst-authorized sources only"


@dataclass
class CollectedDocument:
    sourceType: str
    sourceName: str
    content: str
    collectedAt: str
    evidenceHash: str
    id: str | None = None
    sourceUrl: str | None = None
    title: str | None = None
    rawHtml: str | None = None
    author: str | None = None
    publishedAt: str | None = None
    language: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class SourceConnector(Protocol):
    id: str
    name: str
    type: str

    def validate_input(self, input_data: InvestigationInput) -> None:
        ...

    def collect(self, input_data: InvestigationInput, context: JobContext) -> list[CollectedDocument]:
        ...


def evidence_hash(content: str, source_url: str | None = None) -> str:
    return hashlib.sha256(f"{source_url or ''}\n{content}".encode("utf-8")).hexdigest()


def utc_iso(offset_hours: int = 0) -> str:
    return (datetime.utcnow() - timedelta(hours=offset_hours)).isoformat()


def infer_investigation_type(text: str, override: str | None = None) -> str:
    if override and override != "auto":
        if override not in INVESTIGATION_TYPES:
            raise ValueError(f"Unsupported investigation type '{override}'")
        return override
    lowered = text.lower()
    wallet_pattern = r"\b0x[a-fA-F0-9]{16,40}\b|\bT[A-Za-z0-9]{16,40}\b|\bbc1[A-Za-z0-9]{12,74}\b|\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b"
    if "t.me" in lowered or re.search(r"(?<!\w)@[a-zA-Z0-9_]{5,32}", text) or "telegram" in lowered or "телеграм" in lowered:
        return "telegram_public" if not any(word in lowered for word in ["vape", "вейп", "database", "слив", "usdt", "darkweb", "onion"]) else "mixed_full_scan"
    if re.search(wallet_pattern, text):
        return "crypto_wallet_lookup"
    if ".onion" in lowered or "darkweb" in lowered or "dark web" in lowered or "дарк" in lowered:
        return "darknet_authorized"
    if re.search(r"https?://|\b[a-z0-9.-]+\.[a-z]{2,}\b", lowered):
        return "web_search"
    if re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+", text) or re.search(r"\+?7[\s()-]*\d{3}", text):
        return "entity_lookup"
    if any(word in lowered for word in ["leak", "database", "слив", "база", "иин"]):
        return "leak_mention_lookup"
    if len(text.split()) <= 2:
        return "entity_lookup"
    return "mixed_full_scan"


def _generated_docs(kind: str, input_text: str, max_results: int) -> list[dict[str, Any]]:
    cities = ["Алматы", "Астана", "Шымкент", "Туркестан", "Караганда"]
    handles = ["@sample_vape_kz", "@public_market_watch", "@drop_alert_demo", "@leak_watch_kz", "@crypto_claims_kz"]
    phones = ["+77000000000", "+77000000001", "+77000000002", "+77000000003", "+77000000004"]
    wallets = ["TQ7DemoWallet000000000000000001", "0x1111111111111111111111111111111111111111", "bc1demoaddress000000000000000001"]
    docs: list[dict[str, Any]] = []
    for index in range(max_results):
        city = cities[index % len(cities)]
        handle = handles[index % len(handles)]
        phone = phones[index % len(phones)]
        wallet = wallets[index % len(wallets)]
        if kind == "telegram":
            title = f"Public Telegram sample {index + 1}: {handle}"
            url = f"https://t.me/{handle.lstrip('@')}/{1000 + index}"
            content = f"Public channel post mentions {input_text}. Handle {handle}, phone {phone}, USDT TRC20 wallet {wallet}, city {city}, delivery keywords, analyst demo only."
        elif kind == "darknet_authorized":
            title = f"Authorized mock darknet sample {index + 1}"
            url = f"mock://onion/post/{index + 1}"
            content = f"Mock authorized darknet dataset row for {input_text}. Alias {handle}, wallet {wallet}, Kazakhstan city {city}, database leak and marketplace wording. No real marketplace, no instructions."
        else:
            title = f"Public web sample {index + 1}: {input_text[:48]}"
            url = f"https://synthetic.local/osint/{kind}/{index + 1}"
            content = f"Public web excerpt about {input_text}. Contact {handle}, {phone}, domain example{index % 5}.kz, location {city}, payment method Kaspi/USDT mention. Synthetic evidence for legal demo."
        docs.append({"title": title, "sourceUrl": url, "content": content, "publishedAt": utc_iso(index * 6), "metadata": {"synthetic": True, "sample_index": index}})
    return docs


def _load_samples(kind: str, input_text: str, max_results: int) -> list[dict[str, Any]]:
    folder = ROOT_DIR / "data" / f"{kind}_samples"
    records: list[dict[str, Any]] = []
    if folder.exists():
        for file in sorted(folder.iterdir()):
            if len(records) >= max_results:
                break
            if file.suffix.lower() == ".json":
                payload = json.loads(file.read_text(encoding="utf-8"))
                if isinstance(payload, list):
                    records.extend(payload)
                elif isinstance(payload, dict):
                    records.append(payload)
            elif file.suffix.lower() in {".txt", ".html"}:
                text = file.read_text(encoding="utf-8", errors="replace")
                if file.suffix.lower() == ".html":
                    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", text, flags=re.I | re.S)
                    text = re.sub(r"<[^>]+>", " ", text)
                records.append({"title": file.stem, "sourceUrl": f"mock://{kind}/{file.name}", "content": " ".join(text.split()), "metadata": {"sample_file": str(file.relative_to(ROOT_DIR))}})
    if not records:
        records = _generated_docs(kind, input_text, max_results)
    query_terms = [term for term in re.findall(r"[\wа-яА-Я]{3,}", input_text.lower()) if term not in {"the", "and", "для"}]
    if query_terms:
        filtered = [record for record in records if any(term in str(record.get("content", "")).lower() or term in str(record.get("title", "")).lower() for term in query_terms)]
        if filtered:
            records = filtered
    return records[:max_results]


class BaseMockConnector:
    id = "base"
    name = "Base mock connector"
    type = "manual"
    sample_kind = "web"

    def validate_input(self, input_data: InvestigationInput) -> None:
        if not input_data.input_text.strip():
            raise ValueError("input_text is required")

    def collect(self, input_data: InvestigationInput, context: JobContext) -> list[CollectedDocument]:
        self.validate_input(input_data)
        rows = _load_samples(self.sample_kind, input_data.input_text, context.max_results)
        documents: list[CollectedDocument] = []
        for index, row in enumerate(rows):
            content = str(row.get("content") or row.get("text") or row.get("body") or "")
            url = row.get("sourceUrl") or row.get("source_url") or row.get("url") or f"mock://{self.sample_kind}/{index + 1}"
            documents.append(
                CollectedDocument(
                    id=str(row.get("id") or f"{self.id}-{index + 1}"),
                    sourceType=self.type,
                    sourceName=str(row.get("sourceName") or row.get("source_name") or self.name),
                    sourceUrl=str(url),
                    title=str(row.get("title") or f"{self.name} sample {index + 1}"),
                    content=content,
                    rawHtml=row.get("rawHtml") or row.get("raw_html"),
                    author=row.get("author"),
                    publishedAt=row.get("publishedAt") or row.get("published_at"),
                    collectedAt=utc_iso(),
                    language=row.get("language"),
                    metadata={"connector_id": self.id, "connector_version": CONNECTOR_VERSION, **(row.get("metadata") or {})},
                    evidenceHash=evidence_hash(content, str(url)),
                )
            )
        return documents


class MockWebConnector(BaseMockConnector):
    id = "mock_web"
    name = "Mock public web collector"
    type = "web"
    sample_kind = "web"


class MockTelegramConnector(BaseMockConnector):
    id = "mock_telegram"
    name = "Mock public Telegram collector"
    type = "telegram"
    sample_kind = "telegram"

    def validate_input(self, input_data: InvestigationInput) -> None:
        super().validate_input(input_data)
        if "private" in input_data.input_text.lower():
            raise ValueError("Private Telegram groups are not supported. Use public or authorized sources only.")


class MockDarknetAuthorizedConnector(BaseMockConnector):
    id = "mock_darknet_authorized"
    name = "Mock authorized darknet dataset"
    type = "darknet_authorized"
    sample_kind = "darknet"


class ManualTextConnector(BaseMockConnector):
    id = "manual_text"
    name = "Manual evidence collector"
    type = "manual"

    def collect(self, input_data: InvestigationInput, context: JobContext) -> list[CollectedDocument]:
        text = input_data.input_text.strip()
        return [CollectedDocument(sourceType="manual", sourceName=self.name, sourceUrl="manual://investigation-input", title="Manual text analysis", content=text, collectedAt=utc_iso(), metadata={"connector_id": self.id, "connector_version": CONNECTOR_VERSION}, evidenceHash=evidence_hash(text, "manual://investigation-input"))]


class CryptoWalletLookupConnector(BaseMockConnector):
    id = "crypto_wallet_lookup"
    name = "Public wallet lookup placeholder"
    type = "threat_feed"

    def collect(self, input_data: InvestigationInput, context: JobContext) -> list[CollectedDocument]:
        wallet = input_data.input_text.strip()
        content = f"Public blockchain wallet indicator submitted by analyst: {wallet}. Associated terms: USDT TRC20 wallet, crypto fraud risk, Kazakhstan relevance if co-mentioned with +7 phones or Telegram handles."
        return [CollectedDocument(sourceType="threat_feed", sourceName=self.name, sourceUrl=f"blockchain://lookup/{wallet}", title="Wallet/entity investigation", content=content, collectedAt=utc_iso(), metadata={"connector_id": self.id, "chain": "auto", "authorized_lookup": True}, evidenceHash=evidence_hash(content, wallet))]


class AuthorizedTorConnector(BaseMockConnector):
    id = "authorized_tor_seed"
    name = "Authorized Tor seed collector"
    type = "darknet_authorized"

    def collect(self, input_data: InvestigationInput, context: JobContext) -> list[CollectedDocument]:
        if not settings.enable_authorized_tor:
            raise ValueError("Real Tor collection is disabled. Set ENABLE_AUTHORIZED_TOR=true and provide authorized seed URLs only.")
        if ".onion" not in input_data.input_text.lower():
            raise ValueError("Authorized Tor connector requires analyst-provided .onion seed URL.")
        title, text, metadata = PublicWebCollector().fetch(input_data.input_text.strip())
        return [CollectedDocument(sourceType="darknet_authorized", sourceName=self.name, sourceUrl=input_data.input_text.strip(), title=title, content=text, collectedAt=utc_iso(), metadata={"connector_id": self.id, "authorized_seed": True, **metadata}, evidenceHash=evidence_hash(text, input_data.input_text.strip()))]


CONNECTORS: dict[str, SourceConnector] = {
    "mock_web": MockWebConnector(),
    "mock_telegram": MockTelegramConnector(),
    "mock_darknet_authorized": MockDarknetAuthorizedConnector(),
    "manual_text": ManualTextConnector(),
    "crypto_wallet_lookup": CryptoWalletLookupConnector(),
}

ROUTE_CONNECTORS = {
    "web_search": ["mock_web"],
    "telegram_public": ["mock_telegram"],
    "darknet_authorized": ["mock_darknet_authorized"],
    "entity_lookup": ["mock_web", "mock_telegram"],
    "crypto_wallet_lookup": ["crypto_wallet_lookup", "mock_telegram"],
    "leak_mention_lookup": ["mock_web", "mock_darknet_authorized"],
    "mixed_full_scan": ["mock_web", "mock_telegram", "mock_darknet_authorized"],
    "manual_text_analysis": ["manual_text"],
}


def _ensure_source(db: Session, connector: SourceConnector) -> models.Source:
    source = db.scalar(select(models.Source).where(models.Source.url_or_identifier == f"connector://{connector.id}"))
    if source:
        return source
    source = models.Source(
        name=connector.name,
        type=connector.type,
        url_or_identifier=f"connector://{connector.id}",
        enabled=True,
        legal_basis_note="MVP connector uses public, authorized, manual, or synthetic safe demo data only.",
        metadata_json={"connector_id": connector.id, "mock_or_authorized": True},
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def serialize_investigation(row: models.Investigation) -> dict[str, Any]:
    data = to_dict(row)
    data["type"] = row.investigation_type
    return data


def serialize_document(row: models.Document, item: models.RawItem | None = None) -> dict[str, Any]:
    data = to_dict(row)
    data["sourceType"] = row.source_type
    data["sourceName"] = row.source_name
    data["sourceUrl"] = row.source_url
    data["collectedAt"] = row.collected_at.isoformat()
    data["evidenceHash"] = row.content_hash
    if item:
        data["content"] = item.raw_text_redacted or item.raw_text[:1200]
        data["risk_score"] = item.risk_score
        data["category"] = item.risk_category
    return data


class InvestigationOrchestrator:
    def route(self, input_text: str, override: str | None = None) -> str:
        return infer_investigation_type(input_text, override)

    def create(self, db: Session, payload: dict[str, Any]) -> models.Investigation:
        input_text = str(payload.get("input_text") or payload.get("query") or payload.get("text") or "").strip()
        if not input_text:
            raise ValueError("input_text is required")
        override = payload.get("investigation_type") or payload.get("source_mode") or payload.get("route")
        if override == "auto":
            override = None
        investigation_type = self.route(input_text, override)
        investigation = models.Investigation(
            input_text=input_text,
            investigation_type=investigation_type,
            manual_route_override=override,
            category_hint=payload.get("category"),
            max_results=max(1, min(int(payload.get("max_results") or 25), 100)),
            risk_threshold=max(0, min(int(payload.get("risk_threshold") or 0), 100)),
            status="queued",
            result_counts={},
        )
        db.add(investigation)
        db.commit()
        db.refresh(investigation)
        return investigation

    def run(self, db: Session, investigation_id: int) -> dict[str, Any]:
        investigation = db.get(models.Investigation, investigation_id)
        if not investigation:
            raise KeyError(f"investigation {investigation_id} not found")
        connector_ids = ROUTE_CONNECTORS.get(investigation.investigation_type, ROUTE_CONNECTORS["mixed_full_scan"])
        pipeline = CollectionPipeline()
        collected_item_ids: list[int] = []
        errors: list[str] = []

        self._stage(db, investigation, "collecting")
        input_data = InvestigationInput(input_text=investigation.input_text, investigation_type=investigation.investigation_type, category=investigation.category_hint, max_results=investigation.max_results, risk_threshold=investigation.risk_threshold)
        per_connector_limit = max(1, investigation.max_results // max(1, len(connector_ids)))
        for connector_id in connector_ids:
            connector = CONNECTORS[connector_id]
            job = models.InvestigationJob(investigation_id=investigation.id, connector_id=connector.id, status="collecting", stage="collecting", metadata_json={"connector_type": connector.type})
            db.add(job)
            db.commit()
            try:
                docs = connector.collect(input_data, JobContext(investigation.id, connector.id, per_connector_limit))
                source = _ensure_source(db, connector)
                job.stage = "extracting"
                job.status = "extracting"
                db.commit()
                for doc in docs:
                    item, _entities, _risk = pipeline.ingest_text(
                        db,
                        source=source,
                        platform=doc.sourceType,
                        source_url=doc.sourceUrl or f"connector://{connector.id}",
                        title=doc.title or doc.sourceName,
                        raw_text=doc.content,
                        metadata={
                            "investigation_id": investigation.id,
                            "connector_id": connector.id,
                            "sourceName": doc.sourceName,
                            "sourceType": doc.sourceType,
                            "evidenceHash": doc.evidenceHash,
                            "author": doc.author,
                            "publishedAt": doc.publishedAt,
                            **doc.metadata,
                        },
                    )
                    if item.risk_score >= investigation.risk_threshold:
                        collected_item_ids.append(item.id)
                job.status = "completed"
                job.stage = "completed"
                job.metadata_json = {**(job.metadata_json or {}), "documents_collected": len(docs)}
                job.updated_at = datetime.utcnow()
                db.commit()
            except Exception as exc:
                job.status = "failed"
                job.stage = "failed"
                job.error_message = str(exc)
                job.updated_at = datetime.utcnow()
                errors.append(f"{connector.id}: {exc}")
                db.commit()

        self._stage(db, investigation, "graphing")
        graph_result = GraphService().rebuild_persistent_graph()
        investigation.status = "completed" if not errors or collected_item_ids else "completed_with_errors"
        investigation.summary = f"{len(collected_item_ids)} documents matched threshold via {', '.join(connector_ids)}."
        investigation.result_counts = {"documents": len(set(collected_item_ids)), "connectors": len(connector_ids), "errors": len(errors), "graph": graph_result}
        investigation.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(investigation)
        return self.results(db, investigation.id) | {"errors": errors}

    def _stage(self, db: Session, investigation: models.Investigation, status: str) -> None:
        investigation.status = status
        investigation.updated_at = datetime.utcnow()
        db.add(models.InvestigationJob(investigation_id=investigation.id, status=status, stage=status, metadata_json={"timeline": True}))
        db.commit()

    def status(self, db: Session, investigation_id: int) -> dict[str, Any]:
        investigation = db.get(models.Investigation, investigation_id)
        if not investigation:
            raise KeyError(f"investigation {investigation_id} not found")
        jobs = db.scalars(select(models.InvestigationJob).where(models.InvestigationJob.investigation_id == investigation_id).order_by(models.InvestigationJob.created_at)).all()
        return {"investigation": serialize_investigation(investigation), "timeline": [to_dict(job) for job in jobs]}

    def results(self, db: Session, investigation_id: int) -> dict[str, Any]:
        investigation = db.get(models.Investigation, investigation_id)
        if not investigation:
            raise KeyError(f"investigation {investigation_id} not found")
        docs = db.scalars(select(models.Document).where(models.Document.investigation_id == investigation_id).order_by(desc(models.Document.collected_at))).all()
        raw_by_id = {item.id: item for item in db.scalars(select(models.RawItem).where(models.RawItem.id.in_([doc.raw_item_id for doc in docs]))).all()} if docs else {}
        signals = db.scalars(select(models.RiskSignal).where(models.RiskSignal.investigation_id == investigation_id).order_by(desc(models.RiskSignal.risk_score))).all()
        entity_ids = [link.entity_id for doc in docs for link in db.scalars(select(models.DocumentEntity).where(models.DocumentEntity.document_id == doc.id)).all()]
        entities = db.scalars(select(models.Entity).where(models.Entity.id.in_(entity_ids))).all() if entity_ids else []
        graph = GraphService().react_flow(risk_min=investigation.risk_threshold, limit=150)
        return {
            "investigation": serialize_investigation(investigation),
            "documents": [serialize_document(doc, raw_by_id.get(doc.raw_item_id)) for doc in docs],
            "entities": [to_dict(entity) for entity in entities],
            "signals": [to_dict(signal) for signal in signals],
            "graph": graph,
            "next_steps": [
                "Open high-risk signals and verify source attribution.",
                "Expand repeated phones, handles, wallets, and domains in the graph.",
                "Create a case only for indicators that pass analyst review.",
            ],
        }
