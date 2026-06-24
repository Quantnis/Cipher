from __future__ import annotations

from datetime import datetime
import hashlib
import json
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app import models
from app.services.fingerprint_extractor import FingerprintExtractor


def _pair_filter(source_entity_id: int, target_entity_id: int):
    return or_(
        and_(models.FingerprintLink.from_entity_id == source_entity_id, models.FingerprintLink.to_entity_id == target_entity_id),
        and_(models.FingerprintLink.from_entity_id == target_entity_id, models.FingerprintLink.to_entity_id == source_entity_id),
    )


class HiddenLinkCreator:
    def __init__(self) -> None:
        self.extractor = FingerprintExtractor()

    def create_hidden_links(self, db: Session, source_entity_id: int, matches: list[dict[str, Any]]) -> list[models.FingerprintLink]:
        created_or_updated: list[models.FingerprintLink] = []
        for match in matches:
            target_entity_id = int(match["entity_id"])
            if target_entity_id == source_entity_id:
                continue
            existing = db.scalar(select(models.FingerprintLink).where(_pair_filter(source_entity_id, target_entity_id)))
            if existing:
                if match["score"] > existing.score:
                    existing.score = float(match["score"])
                    existing.confidence_pct = int(match["confidence_pct"])
                    existing.components_json = self.extractor.component_similarity(source_entity_id, target_entity_id)
                if existing.status != "rejected":
                    created_or_updated.append(existing)
                continue

            components = self.extractor.component_similarity(source_entity_id, target_entity_id)
            link = models.FingerprintLink(
                from_entity_id=source_entity_id,
                to_entity_id=target_entity_id,
                score=float(match["score"]),
                confidence_pct=int(match["confidence_pct"]),
                components_json=components,
                status="pending",
            )
            db.add(link)
            db.flush()
            db.add(
                models.Alert(
                    title=f"Скрытая связь обнаружена ({link.confidence_pct}%)",
                    description="Автоматически обнаруженное сходство цифровых отпечатков. Требует верификации аналитика.",
                    severity="high" if link.score >= 0.90 else "medium",
                    category="hidden_identity_link",
                    risk_score=max(60, link.confidence_pct),
                    confidence=link.score,
                    status="New",
                    primary_entity_id=source_entity_id,
                    reason_summary=(
                        f"Скрытая связь: entity-{source_entity_id} ↔ entity-{target_entity_id}. "
                        f"Вероятность общего субъекта: {link.confidence_pct}%."
                    ),
                )
            )
            db.add(models.AuditLog(action="fingerprint.hidden_link_created", target_type="entity", target_id=source_entity_id, metadata_json={"linked_to": target_entity_id, "score": link.score, "method": "qdrant_cosine_similarity"}))
            created_or_updated.append(link)
        return created_or_updated

    def verify_hidden_link(self, db: Session, link_id: int, verified: bool, analyst_note: str = "") -> models.FingerprintLink | None:
        link = db.get(models.FingerprintLink, link_id)
        if not link:
            return None
        link.status = "verified" if verified else "rejected"
        link.verified_at = datetime.utcnow()
        link.analyst_note = analyst_note
        if verified:
            payload = {
                "link_id": link.id,
                "from_entity_id": link.from_entity_id,
                "to_entity_id": link.to_entity_id,
                "score": link.score,
                "components": link.components_json,
                "verified_at": link.verified_at.isoformat(),
                "analyst_note": analyst_note,
            }
            digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
            evidence = models.Evidence(
                item_id=None,
                alert_id=None,
                evidence_type="fingerprint_link_verification",
                storage_path="fingerprint://hidden-link",
                sha256_hash=digest,
                extracted_text_redacted=json.dumps(payload, ensure_ascii=False)[:1200],
                source_url="internal://digital-fingerprint-linker",
                collector_version="shadowgraph-fingerprint-v1",
                redaction_status="redacted",
            )
            db.add(evidence)
            db.flush()
            link.evidence_id = evidence.id
        else:
            link.threshold_suppressed = 0.95
        db.add(models.AuditLog(action="fingerprint.link_verified" if verified else "fingerprint.link_rejected", target_type="fingerprint_link", target_id=link.id, metadata_json={"from_entity_id": link.from_entity_id, "to_entity_id": link.to_entity_id, "score": link.score, "analyst_note": analyst_note}))
        return link

