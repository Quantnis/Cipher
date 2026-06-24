from fastapi import APIRouter

from app.schemas import RiskWeightPatch, SlangTermIn
from app.services.repository import repo

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-logs")
def audit_logs():
    return repo.list("audit_logs")


@router.get("/risk-weights")
def risk_weights():
    return repo.list("risk_weights")


@router.patch("/risk-weights")
def patch_risk_weights(payload: RiskWeightPatch):
    from app import models
    from sqlalchemy import select
    with repo.session() as db:
        weight = db.scalar(select(models.RiskWeight).where(models.RiskWeight.name == payload.name))
        if not weight:
            weight = models.RiskWeight(name=payload.name, weight=payload.weight, description="Custom analyst weight")
            db.add(weight)
        else:
            weight.weight = payload.weight
        db.commit()
        db.refresh(weight)
        repo.log("admin.risk_weight_patch", "risk_weight", weight.id, payload.model_dump())
        return {"id": weight.id, "name": weight.name, "weight": weight.weight, "description": weight.description}


@router.get("/slang-dictionary")
def slang_dictionary():
    return repo.list("slang_terms")


@router.post("/slang-dictionary")
def add_slang(payload: SlangTermIn):
    from app import models
    with repo.session() as db:
        term = models.SlangTerm(**payload.model_dump())
        db.add(term)
        db.commit()
        db.refresh(term)
        repo.log("admin.slang_add", "slang_term", term.id)
        return {"id": term.id, **payload.model_dump()}


@router.delete("/slang-dictionary/{term_id}")
def delete_slang(term_id: int):
    from app import models
    with repo.session() as db:
        term = db.get(models.SlangTerm, term_id)
        if term:
            db.delete(term)
            db.commit()
    repo.log("admin.slang_delete", "slang_term", term_id)
    return {"ok": True}
