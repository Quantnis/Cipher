from collections import Counter, defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.database import get_db
from app.schemas import ManualTextIn
from app.services.ai import AIAnalyst
from app.services.crawler import CollectionPipeline, SourceCollector
from app.services.repository import repo, source_to_api, to_dict

router = APIRouter(tags=["mvp"])


def item_api(item: models.RawItem) -> dict:
    data = to_dict(item)
    data["raw_text"] = item.raw_text_redacted or item.raw_text[:1200]
    return data


@router.get("/items")
@router.get("/api/items")
def list_items(risk_min: int = 0, category: str | None = None, limit: int = 50, db: Session = Depends(get_db)):
    query = select(models.RawItem).where(models.RawItem.risk_score >= risk_min)
    if category:
        query = query.where(models.RawItem.risk_category == category)
    rows = db.scalars(query.order_by(desc(models.RawItem.captured_at)).limit(min(limit, 200))).all()
    return [item_api(row) for row in rows]


@router.get("/items/{item_id}")
@router.get("/api/items/{item_id}")
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.RawItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    links = db.scalars(select(models.ItemEntity).where(models.ItemEntity.item_id == item_id)).all()
    entities = [repo.get("entities", link.entity_id) for link in links]
    scores = db.scalars(select(models.RiskScore).where(models.RiskScore.item_id == item_id)).all()
    return {**item_api(item), "entities": entities, "risk_scores": [to_dict(score) for score in scores]}


@router.post("/items/manual")
@router.post("/api/items/manual")
def ingest_manual(payload: ManualTextIn, db: Session = Depends(get_db)):
    source = db.get(models.Source, payload.source_id) if payload.source_id else None
    item, entities, risk = CollectionPipeline().ingest_text(db, source=source, platform=payload.platform, source_url=payload.source_url, title=payload.title, raw_text=payload.raw_text, metadata={"manual_upload": True})
    return {"item": item_api(item), "entities": [repo.get("entities", e.id) for e in entities], "risk": risk}


@router.post("/items/{item_id}/analyze")
@router.post("/api/items/{item_id}/analyze")
def analyze_item(item_id: int, db: Session = Depends(get_db)):
    item = get_item(item_id, db)
    return {"item": item, "analysis": AIAnalyst().analyze_item(item, item.get("entities", []), item.get("risk_scores", []))}


@router.post("/items/{item_id}/mark-reviewed")
@router.post("/api/items/{item_id}/mark-reviewed")
def mark_reviewed(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.RawItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    from datetime import datetime
    item.reviewed_at = datetime.utcnow()
    db.commit()
    repo.log("item.mark_reviewed", "raw_item", item_id)
    return item_api(item)


@router.post("/jobs/run-all")
@router.post("/api/jobs/run-all")
def run_all(db: Session = Depends(get_db)):
    results = []
    for source in db.scalars(select(models.Source).where(models.Source.enabled == True)).all():  # noqa: E712
        try:
            results.append({"source": source_to_api(source), "result": SourceCollector().run(db, source)})
        except Exception as exc:
            results.append({"source": source_to_api(source), "result": {"status": "failed", "message": str(exc)}})
    return {"results": results}


@router.get("/jobs")
@router.get("/api/jobs")
def jobs():
    return repo.list("jobs")


@router.get("/jobs/{job_id}")
@router.get("/api/jobs/{job_id}")
def job(job_id: int):
    return repo.get("jobs", job_id)


@router.get("/map/signals")
@router.get("/api/map/signals")
def map_signals(db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Location)).all()
    by_city: dict[str, dict] = {}
    category_counts: dict[str, Counter] = defaultdict(Counter)
    for row in rows:
        if row.city not in by_city:
            by_city[row.city] = {"city": row.city, "region": row.region, "latitude": row.latitude, "longitude": row.longitude, "total_signals": 0, "high_risk_signals": 0, "max_risk": 0, "top_category": "unclassified"}
        city = by_city[row.city]
        city["total_signals"] += 1
        city["high_risk_signals"] += 1 if row.risk_score >= 70 else 0
        city["max_risk"] = max(city["max_risk"], row.risk_score)
        category_counts[row.city][row.category] += 1
    for city, counts in category_counts.items():
        by_city[city]["top_category"] = counts.most_common(1)[0][0]
    return list(by_city.values())


@router.get("/map/cities/{city}")
@router.get("/api/map/cities/{city}")
def city_detail(city: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Location).where(models.Location.city == city)).all()
    item_ids = [row.item_id for row in rows if row.item_id]
    items = db.scalars(select(models.RawItem).where(models.RawItem.id.in_(item_ids))).all() if item_ids else []
    return {"city": city, "signals": [to_dict(row) for row in rows], "items": [item_api(item) for item in items]}


@router.get("/settings/integrations")
@router.get("/api/settings/integrations")
def integrations():
    return {
        "search": {"configured": bool(settings.search_api_provider and settings.search_api_key), "message": "Search API not configured" if not settings.search_api_key else "configured"},
        "telegram": {"configured": bool(settings.telegram_api_id and settings.telegram_api_hash), "message": "Telegram integration not configured" if not (settings.telegram_api_id and settings.telegram_api_hash) else "configured"},
        "darknet": {"configured": bool(settings.tor_proxy_url), "message": "DarkNet adapter not configured" if not settings.tor_proxy_url else "configured"},
        "blockchain": {"configured": bool(settings.etherscan_api_key or settings.tronscan_api_key or settings.blockchain_provider), "message": "Blockchain provider not configured" if not (settings.etherscan_api_key or settings.tronscan_api_key or settings.blockchain_provider) else "configured"},
        "ai": {"configured": bool(settings.openai_api_key), "message": "AI provider not configured" if not settings.openai_api_key else "configured"},
        "map": {"configured": bool(settings.mapbox_token), "message": "Mapbox token not configured; city coordinates still available from extracted city names"},
    }


@router.patch("/settings/integrations")
@router.patch("/api/settings/integrations")
def patch_integrations():
    return {"status": "environment_only", "message": "Integration secrets are configured through environment variables, not stored through the UI."}
