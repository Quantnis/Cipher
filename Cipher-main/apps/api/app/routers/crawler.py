from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.schemas import CrawlJobIn
from app.services.crawler import CollectionPipeline, SourceCollector
from app.services.repository import repo

router = APIRouter(prefix="/crawler", tags=["crawler"])


@router.post("/jobs")
def create_job(payload: CrawlJobIn, db: Session = Depends(get_db)):
    job = models.CollectionJob(source_id=payload.source_id, status="pending")
    db.add(job)
    db.commit()
    db.refresh(job)
    repo.log("crawler.job_create", "crawl_job", job.id)
    return repo.get("jobs", job.id)


@router.get("/jobs")
def list_jobs():
    return repo.list("jobs")


@router.get("/jobs/{job_id}")
def get_job(job_id: int):
    try:
        return repo.get("jobs", job_id)
    except KeyError:
        raise HTTPException(404, "Crawl job not found")


@router.post("/jobs/{job_id}/start")
def start_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(models.CollectionJob, job_id)
    if not job:
        raise HTTPException(404, "Crawl job not found")
    source = db.get(models.Source, job.source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    return SourceCollector().run(db, source)


@router.post("/jobs/{job_id}/pause")
def pause_job(job_id: int):
    return _set_status(job_id, "paused")


@router.post("/jobs/{job_id}/stop")
def stop_job(job_id: int):
    return _set_status(job_id, "stopped")


@router.post("/demo-run")
def demo_run(source_id: int = 1, pages: int = 1, db: Session = Depends(get_db)):
    source = db.get(models.Source, source_id)
    if not source:
        source = models.Source(name="Demo mode manual source", type="manual_upload", url_or_identifier="demo://explicit-sample", legal_basis_note="Explicit demo mode sample source")
        db.add(source)
        db.commit()
        db.refresh(source)
    text = "DEMO MODE SAMPLE ONLY: public post text mentions @demo_handle_01, +7 701 222 33 44, Алматы, USDT TRC20. This is explicitly labeled demo data."
    item, entities, risk = CollectionPipeline().ingest_text(db, source=source, platform="demo", source_url="demo://explicit-sample", title="Explicit demo sample", raw_text=text, metadata={"demo_mode": True})
    return {"job": {"status": "completed"}, "alerts": repo.list("alerts")[:1], "item_id": item.id, "entities": len(entities), "risk": risk, "safety": "Explicit demo mode sample created; not real evidence."}


def _set_status(job_id: int, status: str):
    with repo.session() as db:
        job = db.get(models.CollectionJob, job_id)
        if not job:
            raise HTTPException(404, "Crawl job not found")
        job.status = status
        job.finished_at = datetime.utcnow()
        db.commit()
    repo.log(f"crawler.job_{status}", "crawl_job", job_id)
    return repo.get("jobs", job_id)
