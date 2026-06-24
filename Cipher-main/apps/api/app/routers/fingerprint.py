from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app import models
from app.config import settings
from app.database import SessionLocal
from app.services.fingerprint_extractor import FingerprintExtractor
from app.services.fingerprint_store import FingerprintStore
from app.services.hidden_link_creator import HiddenLinkCreator

router = APIRouter(tags=["fingerprint"])


class VerifyLinkPayload(BaseModel):
    verified: bool
    analyst_note: str = ""


def _entity_metadata(entity: models.Entity, source_count: int = 1) -> dict[str, Any]:
    metadata = dict(entity.metadata_json or {})
    metadata.update({"type": entity.type, "risk_score": entity.risk_score, "source_count": source_count})
    return metadata


def analyze_entity_fingerprint(entity_id: int) -> dict[str, Any]:
    extractor = FingerprintExtractor()
    store = FingerprintStore()
    creator = HiddenLinkCreator()
    with SessionLocal() as db:
        entity = db.get(models.Entity, entity_id)
        if not entity:
            raise KeyError(f"Entity {entity_id} not found")
        source_count = len(db.scalars(select(models.ItemEntity).where(models.ItemEntity.entity_id == entity_id)).all()) or 1
        fingerprint = extractor.extract(entity_id)
        store.upsert_fingerprint(entity_id, fingerprint, _entity_metadata(entity, source_count))
        matches = store.find_similar(
            fingerprint,
            exclude_entity_id=entity_id,
            threshold=settings.fingerprint_similarity_threshold,
            top_k=settings.fingerprint_top_k,
        )
        links = creator.create_hidden_links(db, entity_id, matches)
        db.commit()
        return {
            "entity_id": entity_id,
            "fingerprint_dim": len(fingerprint),
            "fingerprint_backend": store.backend,
            "fingerprint_stored": True,
            "matches_found": len(matches),
            "matches": matches,
            "hidden_links": [link.id for link in links],
        }


def _reindex_task(task_id: str) -> None:
    extractor = FingerprintExtractor()
    store = FingerprintStore()
    creator = HiddenLinkCreator()
    with SessionLocal() as db:
        entities = db.scalars(select(models.Entity)).all()
    for entity in entities:
        fingerprint = extractor.extract(entity.id)
        store.upsert_fingerprint(entity.id, fingerprint, _entity_metadata(entity))
    with SessionLocal() as db:
        for entity in entities:
            fingerprint = extractor.extract(entity.id)
            matches = store.find_similar(
                fingerprint,
                exclude_entity_id=entity.id,
                threshold=settings.fingerprint_similarity_threshold,
                top_k=settings.fingerprint_top_k,
            )
            creator.create_hidden_links(db, entity.id, matches)
        db.commit()


@router.post("/entities/{entity_id}/fingerprint/analyze")
def analyze_entity(entity_id: int):
    try:
        return analyze_entity_fingerprint(entity_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/fingerprint/reindex")
def reindex(background_tasks: BackgroundTasks):
    task_id = str(uuid4())
    with SessionLocal() as db:
        count = len(db.scalars(select(models.Entity.id)).all())
    background_tasks.add_task(_reindex_task, task_id)
    estimated = max(1, round(count / 120)) if count else 1
    return {"status": "started", "task_id": task_id, "entities": count, "estimated_minutes": estimated}


@router.get("/fingerprint/hidden-links")
def hidden_links(min_score: float = 0.82):
    with SessionLocal() as db:
        rows = db.scalars(
            select(models.FingerprintLink)
            .where(models.FingerprintLink.score >= min_score, models.FingerprintLink.status != "rejected")
            .order_by(models.FingerprintLink.score.desc())
        ).all()
        payload = []
        for row in rows:
            left = db.get(models.Entity, row.from_entity_id)
            right = db.get(models.Entity, row.to_entity_id)
            payload.append({
                "id": row.id,
                "from_entity_id": row.from_entity_id,
                "to_entity_id": row.to_entity_id,
                "from_label": left.value_redacted if left else f"entity-{row.from_entity_id}",
                "to_label": right.value_redacted if right else f"entity-{row.to_entity_id}",
                "score": row.score,
                "confidence_pct": row.confidence_pct,
                "components": row.components_json,
                "status": row.status,
                "detected_at": row.detected_at.isoformat(),
                "requires_analyst_review": row.status == "pending",
            })
        return payload


@router.post("/fingerprint/hidden-links/{link_id}/verify")
def verify_link(link_id: int, payload: VerifyLinkPayload):
    with SessionLocal() as db:
        link = HiddenLinkCreator().verify_hidden_link(db, link_id, payload.verified, payload.analyst_note)
        if not link:
            raise HTTPException(status_code=404, detail=f"Hidden link {link_id} not found")
        db.commit()
        return {"id": link.id, "status": link.status, "verified": payload.verified, "evidence_id": link.evidence_id}


@router.get("/entities/{entity_id}/fingerprint")
def entity_fingerprint(entity_id: int):
    with SessionLocal() as db:
        entity = db.get(models.Entity, entity_id)
        if not entity:
            raise HTTPException(status_code=404, detail=f"Entity {entity_id} not found")
    extractor = FingerprintExtractor()
    fingerprint = extractor.extract(entity_id)
    store = FingerprintStore()
    matches = store.find_similar(
        fingerprint,
        exclude_entity_id=entity_id,
        threshold=0.0,
        top_k=settings.fingerprint_top_k,
    )
    data = extractor.inspect(entity_id)
    data.update({"fingerprint_dim": len(fingerprint), "backend": store.backend, "similar_entities": matches})
    return data
