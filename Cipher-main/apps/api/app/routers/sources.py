from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.schemas import SourceIn
from app.services.crawler import SourceCollector
from app.services.repository import repo, source_to_api

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("")
def list_sources():
    return repo.list("sources")


@router.post("")
def create_source(payload: SourceIn, db: Session = Depends(get_db)):
    source_type = payload.type or payload.source_type or "web"
    url = payload.url_or_identifier or payload.url
    name = payload.name or payload.label or url or "Configured source"
    if not url:
        raise HTTPException(422, "url_or_identifier is required")
    if source_type == "darknet" and not payload.legal_basis_note:
        raise HTTPException(422, "Analyst-provided onion sources require a legal basis note.")
    if source_type == "darknet" and ".onion" not in url:
        raise HTTPException(422, "DarkNet source must be an analyst-provided open .onion URL.")
    source = models.Source(name=name, type=source_type, url_or_identifier=url, enabled=payload.enabled, legal_basis_note=payload.legal_basis_note, updated_at=datetime.utcnow())
    db.add(source)
    db.commit()
    db.refresh(source)
    repo.log("source.create", "source", source.id, {"type": source.type})
    return source_to_api(source)


@router.get("/{source_id}")
def get_source(source_id: int):
    try:
        return repo.get("sources", source_id)
    except KeyError:
        raise HTTPException(404, "Source not found")


@router.patch("/{source_id}")
def patch_source(source_id: int, payload: dict, db: Session = Depends(get_db)):
    source = db.get(models.Source, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    aliases = {"label": "name", "url": "url_or_identifier", "source_type": "type", "is_allowlisted": "enabled"}
    for key, value in payload.items():
        attr = aliases.get(key, key)
        if hasattr(source, attr):
            setattr(source, attr, value)
    source.updated_at = datetime.utcnow()
    db.commit()
    repo.log("source.patch", "source", source_id, payload)
    return source_to_api(source)


@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.get(models.Source, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    db.delete(source)
    db.commit()
    repo.log("source.delete", "source", source_id)
    return {"ok": True}


@router.post("/{source_id}/test")
def test_source(source_id: int, db: Session = Depends(get_db)):
    source = db.get(models.Source, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    if source.type in {"web", "public_web"}:
        return {"ok": True, "message": "Public web source configured. Run collection to fetch and store evidence."}
    if source.type in {"search", "keyword_search"}:
        from app.config import settings
        return {"ok": bool(settings.search_api_key), "message": "Search API configured." if settings.search_api_key else "Search API not configured. Set SEARCH_API_PROVIDER and SEARCH_API_KEY."}
    return SourceCollector().run(db, source)


@router.post("/{source_id}/run")
def run_source(source_id: int, db: Session = Depends(get_db)):
    source = db.get(models.Source, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    try:
        return SourceCollector().run(db, source)
    except Exception as exc:
        return {"status": "failed", "message": str(exc)}
