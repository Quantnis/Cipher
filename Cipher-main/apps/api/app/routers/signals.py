from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.services.repository import case_to_api, repo, to_dict

router = APIRouter(prefix="/signals", tags=["signals"])


def _signal_api(db: Session, signal: models.RiskSignal) -> dict:
    data = to_dict(signal)
    document = db.get(models.Document, signal.document_id) if signal.document_id else None
    data.update({
        "risk_level": signal.risk_level,
        "source_type": signal.source_type,
        "collected_date": signal.created_at.isoformat(),
        "location": next((e.get("value_redacted") for e in signal.key_entities if e.get("type") in {"location", "city"}), None),
    })
    if document:
        data.update({"document_id": document.id, "source_url": document.source_url, "source_name": document.source_name, "raw_item_id": document.raw_item_id})
    return data


@router.get("")
def list_signals(risk_level: str | None = None, category: str | None = None, source_type: str | None = None, location: str | None = None, q: str | None = None, risk_min: int = 0, db: Session = Depends(get_db)):
    query = select(models.RiskSignal).where(models.RiskSignal.risk_score >= risk_min)
    if risk_level:
        query = query.where(models.RiskSignal.risk_level == risk_level)
    if category:
        query = query.where(models.RiskSignal.category == category)
    if source_type:
        query = query.where(models.RiskSignal.source_type == source_type)
    rows = db.scalars(query.order_by(desc(models.RiskSignal.risk_score), desc(models.RiskSignal.created_at)).limit(250)).all()
    result = [_signal_api(db, row) for row in rows]
    if q:
        result = [row for row in result if q.lower() in f"{row.get('title')} {row.get('snippet')} {row.get('category')}".lower()]
    if location:
        result = [row for row in result if location.lower() in str(row.get("location") or "").lower()]
    if result:
        return result
    return repo.list("alerts")


@router.get("/{signal_id}")
def get_signal(signal_id: int, db: Session = Depends(get_db)):
    signal = db.get(models.RiskSignal, signal_id)
    if not signal:
        try:
            return repo.get("alerts", signal_id)
        except KeyError:
            raise HTTPException(404, "Signal not found")
    return _signal_api(db, signal)


@router.post("/{signal_id}/create-case")
def create_case_from_signal(signal_id: int, payload: dict | None = None, db: Session = Depends(get_db)):
    payload = payload or {}
    signal = db.get(models.RiskSignal, signal_id)
    if not signal:
        raise HTTPException(404, "Signal not found")
    case = models.AnalystCase(
        title=payload.get("title") or f"Case from signal {signal_id}: {signal.category}",
        summary=signal.snippet[:1000],
        severity=signal.risk_level,
        status="new",
        evidence_items=[{"item_type": "signal", "item_id": signal.id, "risk_score": signal.risk_score, "added_at": datetime.utcnow().isoformat()}],
        recommended_actions=["Verify source attribution", "Review linked entities", "Export report after analyst validation"],
    )
    db.add(case)
    db.flush()
    if signal.document_id:
        db.merge(models.CaseDocument(case_id=case.id, document_id=signal.document_id, metadata_json={"from_signal_id": signal.id}))
    db.commit()
    db.refresh(case)
    repo.log("signal.create_case", "case", case.id, {"signal_id": signal_id})
    return case_to_api(case)
