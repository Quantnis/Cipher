from collections import Counter
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.services.repository import repo

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    sources = repo.list("sources")
    jobs = repo.list("jobs")
    alerts = repo.list("alerts")
    entities = repo.list("entities")
    cases = repo.list("cases")
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "total_crawled_sources": len(sources),
        "total_monitored_sources": len(sources),
        "items_collected_today": db.scalar(select(func.count(models.RawItem.id)).where(func.date(models.RawItem.captured_at) == today)) or 0,
        "active_crawl_jobs": len([j for j in jobs if j["status"] in {"pending", "running"}]),
        "high_risk_alerts": len([a for a in alerts if a["risk_score"] >= 70 and a["status"] != "Closed"]),
        "active_cases": len([c for c in cases if c["status"] not in {"closed", "Closed"}]),
        "new_entities_discovered": len(entities),
        "high_risk_wallets": len([e for e in entities if e["type"] in {"wallet", "crypto_wallet"} and e["risk_score"] >= 70]),
        "leak_mentions": len([a for a in alerts if a["category"] in {"data_leak_mentions", "suspected_database_leak"}]),
        "top_risky_clusters": cases[:5],
        "system_health": {"api": "healthy", "crawler": "configured sources only", "database": "active", "redaction": "enabled", "demo_mode": "off by default"},
    }


@router.get("/risk-trends")
def risk_trends(db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Alert).order_by(desc(models.Alert.created_at)).limit(200)).all()
    by_day: dict[str, dict] = {}
    for row in rows:
        day = row.created_at.date().isoformat()
        bucket = by_day.setdefault(day, {"date": day, "risk_total": 0.0, "alerts": 0})
        bucket["risk_total"] += row.risk_score
        bucket["alerts"] += 1
    return [
        {"date": day, "risk": round(bucket["risk_total"] / bucket["alerts"], 1), "alerts": bucket["alerts"]}
        for day, bucket in sorted(by_day.items())[-14:]
    ]


@router.get("/category-distribution")
def category_distribution():
    counts = Counter(a["category"] for a in repo.list("alerts"))
    return [{"category": category, "count": count} for category, count in counts.items()]
