from datetime import datetime
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app import models
from app.schemas import AlertUpdate
from app.services.repository import case_to_api, item_to_alert_api, repo

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _alert_with_duplicate_context(db, alert: models.Alert) -> dict:
    data = item_to_alert_api(alert)
    content_hash = None
    duplicate_count = 1
    if alert.item_id:
        item = db.get(models.RawItem, alert.item_id)
        if item:
            content_hash = item.content_hash
            duplicate_count = db.scalars(select(models.RawItem).where(models.RawItem.content_hash == item.content_hash)).all()
            duplicate_count = len(duplicate_count)
    data["content_hash"] = content_hash
    data["duplicate_count"] = duplicate_count
    return data


@router.get("")
def list_alerts(category: str | None = None, status: str | None = None, risk_min: int = 0):
    with repo.session() as db:
        rows = db.scalars(select(models.Alert).order_by(models.Alert.created_at.desc())).all()
        result = [_alert_with_duplicate_context(db, row) for row in rows]
    return [a for a in result if a["risk_score"] >= risk_min and (not category or a["category"] == category) and (not status or a["status"] == status)]


@router.get("/{alert_id}")
def get_alert(alert_id: int):
    try:
        alert = repo.get("alerts", alert_id)
        evidence = [e for e in repo.list("evidence") if e.get("alert_id") == alert_id or e.get("item_id") == alert.get("item_id")]
        return {**alert, "evidence": evidence}
    except KeyError:
        raise HTTPException(404, "Alert not found")


@router.patch("/{alert_id}")
def patch_alert(alert_id: int, payload: AlertUpdate):
    with repo.session() as db:
        alert = db.get(models.Alert, alert_id)
        if not alert:
            raise HTTPException(404, "Alert not found")
        updates = payload.model_dump(exclude_none=True)
        for key, value in updates.items():
            setattr(alert, key, value)
        db.commit()
    repo.log("alert.patch", "alert", alert_id, updates)
    return repo.get("alerts", alert_id)


@router.post("/bulk/create-case")
def bulk_create_case(payload: dict):
    alert_ids = [int(item) for item in payload.get("alert_ids", [])]
    if not alert_ids:
        raise HTTPException(422, "alert_ids is required")
    with repo.session() as db:
        alerts = db.scalars(select(models.Alert).where(models.Alert.id.in_(alert_ids))).all()
        if not alerts:
            raise HTTPException(404, "No alerts found")
        severity = "critical" if any(a.risk_score >= 80 for a in alerts) else "high" if any(a.risk_score >= 60 for a in alerts) else "medium"
        case = models.AnalystCase(
            title=payload.get("title") or f"Bulk alert case: {len(alerts)} selected signals",
            summary="Created from selected Live Monitoring alerts. Automated indicators require analyst verification.",
            severity=severity,
            status="new",
            evidence_items=[{"item_type": "alert", "item_id": a.id, "risk_score": a.risk_score, "added_at": datetime.utcnow().isoformat()} for a in alerts],
            recommended_actions=["Validate duplicate groups", "Review evidence hashes", "Escalate only verified indicators"],
        )
        db.add(case)
        db.flush()
        for alert in alerts:
            alert.related_case_id = case.id
            alert.status = "Reviewing"
        db.commit()
        db.refresh(case)
    repo.log("alert.bulk_create_case", "case", case.id, {"alert_ids": alert_ids})
    return case_to_api(case)


@router.post("/{alert_id}/assign")
def assign_alert(alert_id: int, analyst_id: int = 1):
    return patch_alert(alert_id, AlertUpdate(assigned_to=analyst_id, status="Reviewing"))


@router.post("/{alert_id}/mark-false-positive")
def mark_false_positive(alert_id: int):
    return patch_alert(alert_id, AlertUpdate(status="Closed"))


@router.post("/{alert_id}/read")
def mark_read(alert_id: int):
    with repo.session() as db:
        alert = db.get(models.Alert, alert_id)
        if not alert:
            raise HTTPException(404, "Alert not found")
        alert.read_at = datetime.utcnow()
        db.commit()
    return repo.get("alerts", alert_id)
