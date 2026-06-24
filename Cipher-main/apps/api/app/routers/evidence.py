import hashlib
from fastapi import APIRouter, HTTPException

from app.schemas import EvidenceIn
from app.services.repository import now_iso, repo

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("")
def list_evidence():
    return repo.list("evidence")


@router.get("/{evidence_id}")
def get_evidence(evidence_id: int):
    try:
        return repo.get("evidence", evidence_id)
    except KeyError:
        raise HTTPException(404, "Evidence not found")


@router.post("")
def create_evidence(payload: EvidenceIn):
    from app import models
    digest = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    with repo.session() as db:
        evidence = models.Evidence(item_id=payload.item_id or payload.page_id, alert_id=payload.alert_id, evidence_type=payload.evidence_type, storage_path=payload.storage_path, extracted_text_redacted=payload.extracted_text_redacted, source_url=payload.source_url, sha256_hash=digest)
        db.add(evidence)
        db.commit()
        db.refresh(evidence)
    repo.log("evidence.create", "evidence", evidence.id)
    return repo.get("evidence", evidence.id)


@router.patch("/{evidence_id}/redact")
def redact_evidence(evidence_id: int):
    from app import models
    with repo.session() as db:
        evidence = db.get(models.Evidence, evidence_id)
        if not evidence:
            raise HTTPException(404, "Evidence not found")
        evidence.redaction_status = "redacted"
        db.commit()
    repo.log("evidence.redact", "evidence", evidence_id)
    return repo.get("evidence", evidence_id)
