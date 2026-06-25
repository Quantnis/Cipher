from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.services.investigations import InvestigationOrchestrator, infer_investigation_type, serialize_investigation
from app.services.repository import repo

router = APIRouter(prefix="/investigations", tags=["investigations"])
orchestrator = InvestigationOrchestrator()


@router.post("")
def create_investigation(payload: dict, db: Session = Depends(get_db)):
    try:
        investigation = orchestrator.create(db, payload)
        repo.log("investigation.create", "investigation", investigation.id, {"type": investigation.investigation_type})
        if payload.get("run_immediately", True):
            return orchestrator.run(db, investigation.id)
        return serialize_investigation(investigation)
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@router.get("")
def list_investigations(db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Investigation).order_by(desc(models.Investigation.created_at))).all()
    return [serialize_investigation(row) for row in rows]


@router.post("/route-preview")
def route_preview(payload: dict):
    text = str(payload.get("input_text") or payload.get("query") or "")
    override = payload.get("investigation_type") or payload.get("source_mode")
    return {"input_text": text, "investigation_type": infer_investigation_type(text, None if override == "auto" else override)}


@router.get("/{investigation_id}")
def get_investigation(investigation_id: int, db: Session = Depends(get_db)):
    investigation = db.get(models.Investigation, investigation_id)
    if not investigation:
        raise HTTPException(404, "Investigation not found")
    return orchestrator.status(db, investigation_id)


@router.post("/{investigation_id}/run")
def run_investigation(investigation_id: int, db: Session = Depends(get_db)):
    try:
        return orchestrator.run(db, investigation_id)
    except KeyError:
        raise HTTPException(404, "Investigation not found")


@router.get("/{investigation_id}/status")
def investigation_status(investigation_id: int, db: Session = Depends(get_db)):
    try:
        return orchestrator.status(db, investigation_id)
    except KeyError:
        raise HTTPException(404, "Investigation not found")


@router.get("/{investigation_id}/results")
def investigation_results(investigation_id: int, db: Session = Depends(get_db)):
    try:
        return orchestrator.results(db, investigation_id)
    except KeyError:
        raise HTTPException(404, "Investigation not found")
