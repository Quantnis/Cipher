from __future__ import annotations

from datetime import timezone
import re
import urllib.parse

from fastapi import HTTPException
from sqlalchemy import select

from app import models
from app.database import SessionLocal
from app.services.graph import GraphService
from app.services.repository import entity_to_api

PHONE_RE = re.compile(r"(?:\+?7|8)[\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-()]?\d{2}[\s\-()]?\d{2}")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+")


def _iso(value) -> str | None:
    if not value:
        return None
    return value.replace(tzinfo=timezone.utc).isoformat()


def redact_text(value: str | None) -> str:
    if not value:
        return ""
    text = PHONE_RE.sub(lambda m: _redact_phone(m.group(0)), value)
    text = EMAIL_RE.sub(lambda m: _redact_email(m.group(0)), text)
    return text


def _redact_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) >= 11:
        return f"+7 {digits[1:4]} *** ** **"
    return "+7 *** *** ** **"


def _redact_email(email: str) -> str:
    left, _, domain = email.partition("@")
    return f"{left[:2]}***@{domain}"


def redact_url(url: str | None) -> str:
    if not url:
        return ""
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme else parsed.netloc
    return redact_text(url.split("?", 1)[0])


def risk_tags_for_entity(entity: models.Entity) -> list[str]:
    tags: list[str] = []
    entity_type = entity.type.lower()
    if entity_type in {"telegram_handle", "telegramhandle"}:
        tags.append("suspicious_telegram_shop")
    if entity_type in {"phone", "phone_number"}:
        tags.append("drop_pattern")
    if entity_type in {"crypto_wallet", "cryptowallet"}:
        tags.append("suspicious_crypto_wallet")
    if entity.risk_score >= 70:
        tags.append("high_risk_entity")
    return tags


def _entity_value(entity: models.Entity) -> str:
    if entity.type.lower() in {"phone", "phone_number"}:
        return redact_text(entity.value_redacted or entity.value)
    if entity.type.lower() in {"url", "domain"}:
        return redact_url(entity.value_redacted or entity.value)
    return redact_text(entity.value_redacted or entity.normalized_value or entity.value)


def get_case_context(case_id: int) -> dict:
    with SessionLocal() as db:
        case = db.get(models.AnalystCase, case_id)
        if not case:
            raise HTTPException(status_code=404, detail=f"Кейс {case_id} не найден")

        evidence_items = list(case.evidence_items or [])
        alert_ids = [int(item.get("item_id")) for item in evidence_items if item.get("item_type") == "alert" and item.get("item_id")]
        entity_ids = [int(item.get("item_id")) for item in evidence_items if item.get("item_type") == "entity" and item.get("item_id")]
        evidence_ids = [int(item.get("item_id")) for item in evidence_items if item.get("item_type") == "evidence" and item.get("item_id")]

        alerts = db.scalars(select(models.Alert).where(models.Alert.id.in_(alert_ids))).all() if alert_ids else []
        if not alerts:
            alerts = db.scalars(select(models.Alert).where(models.Alert.related_case_id == case_id).order_by(models.Alert.created_at.desc()).limit(20)).all()
        if not alerts:
            alerts = db.scalars(select(models.Alert).order_by(models.Alert.risk_score.desc(), models.Alert.created_at.desc()).limit(8)).all()

        item_ids = [alert.item_id for alert in alerts if alert.item_id]
        linked_entities = db.scalars(select(models.Entity).where(models.Entity.id.in_(entity_ids))).all() if entity_ids else []
        if item_ids:
            links = db.scalars(select(models.ItemEntity).where(models.ItemEntity.item_id.in_(item_ids))).all()
            linked_entity_ids = {link.entity_id for link in links}
            linked_entities = list({entity.id: entity for entity in [*linked_entities, *db.scalars(select(models.Entity).where(models.Entity.id.in_(linked_entity_ids))).all()]}.values())

        evidences = db.scalars(select(models.Evidence).where(models.Evidence.id.in_(evidence_ids))).all() if evidence_ids else []
        if item_ids:
            linked_evidence = db.scalars(select(models.Evidence).where(models.Evidence.item_id.in_(item_ids))).all()
            evidences = list({ev.id: ev for ev in [*evidences, *linked_evidence]}.values())

        sources = [db.get(models.Source, alert.source_id) for alert in alerts if alert.source_id]
        sources = [source for source in sources if source]
        categories = sorted({alert.category for alert in alerts if alert.category})
        risk_score = int(max([alert.risk_score for alert in alerts] + [0, case_to_score(case.severity)]))
        graph = GraphService().react_flow(risk_min=0, limit=120)
        graph_edges = [
            {"from": _node_label(graph, edge["source"]), "relation": edge.get("label") or edge.get("relationshipType"), "to": _node_label(graph, edge["target"])}
            for edge in graph.get("edges", [])[:40]
        ]

        return {
            "case_id": f"CASE-{case.id:04d}",
            "created_at": _iso(case.created_at),
            "status": case.status,
            "risk_score": risk_score,
            "alerts": [
                {
                    "category": alert.category,
                    "reason": redact_text(alert.reason_summary or alert.description),
                    "source_url": redact_url(_source_url_for_alert(db, alert)),
                    "entities_extracted": _entity_count_for_alert(db, alert),
                    "first_seen": _iso(alert.created_at),
                    "confidence": int((alert.confidence or 0) * 100),
                }
                for alert in alerts
            ],
            "entities": [
                {
                    "type": entity.type,
                    "value": _entity_value(entity),
                    "risk_tags": risk_tags_for_entity(entity),
                }
                for entity in linked_entities[:40]
            ],
            "graph_edges": graph_edges,
            "evidence": [
                {
                    "id": f"EVD-{evidence.id:04d}",
                    "type": evidence.evidence_type,
                    "hash": evidence.sha256_hash,
                    "timestamp": _iso(evidence.created_at),
                    "redacted": evidence.redaction_status == "redacted",
                }
                for evidence in evidences[:40]
            ],
            "categories_detected": categories,
            "kazakhstan_relevance": _kazakhstan_relevance(categories, linked_entities),
            "sources_count": len({source.id for source in sources}),
        }


def case_to_score(severity: str) -> int:
    value = (severity or "").lower()
    if value == "critical":
        return 90
    if value == "high":
        return 75
    if value == "medium":
        return 50
    return 25


def _source_url_for_alert(db, alert: models.Alert) -> str:
    item = db.get(models.RawItem, alert.item_id) if alert.item_id else None
    if item:
        return item.source_url
    source = db.get(models.Source, alert.source_id) if alert.source_id else None
    return source.url_or_identifier if source else ""


def _entity_count_for_alert(db, alert: models.Alert) -> int:
    if not alert.item_id:
        return 0
    return len(db.scalars(select(models.ItemEntity).where(models.ItemEntity.item_id == alert.item_id)).all())


def _kazakhstan_relevance(categories: list[str], entities: list[models.Entity]) -> bool:
    if any("kazakhstan" in category.lower() or "kz" in category.lower() for category in categories):
        return True
    return any(entity.type.lower() == "city" or "каз" in entity.value_redacted.lower() or "алматы" in entity.value_redacted.lower() for entity in entities)


def _node_label(graph: dict, node_id: str) -> str:
    node = next((item for item in graph.get("nodes", []) if item.get("id") == node_id), None)
    return redact_text(node.get("label", node_id) if node else node_id)
