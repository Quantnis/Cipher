from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app import models


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_dict(row: Any) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for column in row.__mapper__.column_attrs:
        value = getattr(row, column.key)
        if isinstance(value, datetime):
            value = value.replace(tzinfo=timezone.utc).isoformat()
        data[column.key] = value
    return data


def severity_from_score(score: float) -> str:
    if score >= 85:
        return "critical"
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def source_to_api(source: models.Source) -> dict[str, Any]:
    data = to_dict(source)
    data.update(
        {
            "label": source.name,
            "name": source.name,
            "url": source.url_or_identifier,
            "source_type": source.type,
            "is_allowlisted": bool(source.legal_basis_note),
            "enabled": source.enabled,
        }
    )
    return data


def item_to_alert_api(alert: models.Alert) -> dict[str, Any]:
    data = to_dict(alert)
    data["page_id"] = alert.item_id
    return data


def entity_to_api(entity: models.Entity) -> dict[str, Any]:
    data = to_dict(entity)
    data.update(
        {
            "entity_type": entity.type,
            "first_seen": entity.first_seen_at.replace(tzinfo=timezone.utc).isoformat(),
            "last_seen": entity.last_seen_at.replace(tzinfo=timezone.utc).isoformat(),
            "metadata_json": entity.metadata_json,
        }
    )
    return data


def case_to_api(case: models.AnalystCase) -> dict[str, Any]:
    data = to_dict(case)
    data.update(
        {
            "description": case.summary,
            "priority": case.severity.title(),
            "overall_risk_score": max([e.get("risk_score", 0) for e in case.evidence_items], default=0),
        }
    )
    return data


def evidence_to_api(evidence: models.Evidence) -> dict[str, Any]:
    data = to_dict(evidence)
    data["page_id"] = evidence.item_id
    return data


class DatabaseRepository:
    model_map = {
        "users": models.User,
        "sources": models.Source,
        "jobs": models.CollectionJob,
        "alerts": models.Alert,
        "entities": models.Entity,
        "evidence": models.Evidence,
        "cases": models.AnalystCase,
        "reports": models.Report,
        "narratives": models.Narrative,
        "entity_fingerprints": models.EntityFingerprint,
        "fingerprint_links": models.FingerprintLink,
        "audit_logs": models.AuditLog,
        "risk_weights": models.RiskWeight,
        "slang_terms": models.SlangTerm,
    }

    serializer_map = {
        "sources": source_to_api,
        "alerts": item_to_alert_api,
        "entities": entity_to_api,
        "evidence": evidence_to_api,
        "cases": case_to_api,
    }

    def session(self) -> Session:
        return SessionLocal()

    def list(self, name: str) -> list[dict[str, Any]]:
        model = self.model_map[name]
        serializer = self.serializer_map.get(name, to_dict)
        with self.session() as db:
            rows = db.scalars(select(model).order_by(desc(model.id))).all()
            return [serializer(row) for row in rows]

    def get(self, name: str, item_id: int) -> dict[str, Any]:
        model = self.model_map[name]
        serializer = self.serializer_map.get(name, to_dict)
        with self.session() as db:
            row = db.get(model, item_id)
            if not row:
                raise KeyError(f"{name} {item_id} not found")
            return serializer(row)

    def log(self, action: str, target_type: str, target_id: int | None = None, metadata: dict | None = None) -> None:
        with self.session() as db:
            db.add(models.AuditLog(action=action, target_type=target_type, target_id=target_id, metadata_json=metadata or {}))
            db.commit()

    def ensure_defaults(self) -> None:
        with self.session() as db:
            if not db.scalar(select(models.User.id).limit(1)):
                db.add(models.User())
            if not db.scalar(select(models.RiskWeight.id).limit(1)):
                db.add_all(
                    [
                        models.RiskWeight(name="category_severity", weight=25, description="Severity of matched risk category"),
                        models.RiskWeight(name="entity_richness", weight=20, description="Contacts, wallets, URLs, locations, and aliases found"),
                        models.RiskWeight(name="kazakhstan_relevance", weight=15, description="Kazakhstan city, language, bank, phone, or local term"),
                        models.RiskWeight(name="freshness", weight=15, description="Recently captured or published signal"),
                        models.RiskWeight(name="graph_connectivity", weight=15, description="Repeated entities and cross-source graph links"),
                        models.RiskWeight(name="source_reliability", weight=10, description="Configured legal source quality and provenance"),
                    ]
                )
            if not db.scalar(select(models.SlangTerm.id).limit(1)):
                db.add_all(
                    [
                        models.SlangTerm(term="вейп", language="ru", category="illegal_vape_sales", risk_weight=3),
                        models.SlangTerm(term="одноразка", language="ru", category="illegal_vape_sales", risk_weight=3),
                        models.SlangTerm(term="клад", language="ru", category="narcotics_advertising", risk_weight=5),
                        models.SlangTerm(term="дроп", language="ru", category="dropper_recruitment", risk_weight=4),
                        models.SlangTerm(term="каспи", language="ru", category="suspicious_payment_infrastructure", risk_weight=2),
                        models.SlangTerm(term="ИИН", language="ru", category="data_leak_mentions", risk_weight=5),
                    ]
                )
            db.commit()

    def counts(self) -> dict[str, int]:
        with self.session() as db:
            return {
                "sources": db.scalar(select(func.count(models.Source.id))) or 0,
                "items": db.scalar(select(func.count(models.RawItem.id))) or 0,
                "alerts": db.scalar(select(func.count(models.Alert.id))) or 0,
                "entities": db.scalar(select(func.count(models.Entity.id))) or 0,
                "cases": db.scalar(select(func.count(models.AnalystCase.id))) or 0,
            }


repo = DatabaseRepository()


