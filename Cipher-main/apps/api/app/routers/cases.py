from fastapi import APIRouter, HTTPException

from app.schemas import CaseIn, CaseItemIn
from app.services.narrative_context import get_case_context
from app.services.narrative_generator import generate_narrative, latest_narrative
from app.services.reports import ReportGenerator
from app.services.repository import now_iso, repo, case_to_api

router = APIRouter(prefix="/cases", tags=["cases"])


@router.get("")
def list_cases():
    return repo.list("cases")


@router.post("")
def create_case(payload: CaseIn):
    from app import models
    with repo.session() as db:
        case = models.AnalystCase(title=payload.title, summary=payload.summary or payload.description, severity=(payload.severity or payload.priority).lower(), status="new", recommended_actions=["Verify source provenance", "Review connected entities", "Escalate only after human validation"])
        db.add(case)
        db.commit()
        db.refresh(case)
        repo.log("case.create", "case", case.id)
        return case_to_api(case)


@router.get("/{case_id}")
def get_case(case_id: int):
    try:
        case = repo.get("cases", case_id)
    except KeyError:
        raise HTTPException(404, "Case not found")
    items = case.get("evidence_items", [])
    return {**case, "items": items}


@router.patch("/{case_id}")
def patch_case(case_id: int, payload: dict):
    from app import models
    with repo.session() as db:
        case = db.get(models.AnalystCase, case_id)
        if not case:
            raise HTTPException(404, "Case not found")
        for key, value in payload.items():
            if key == "description":
                case.summary = value
            elif hasattr(case, key):
                setattr(case, key, value)
        repo.log("case.patch", "case", case_id, payload)
        db.commit()
        db.refresh(case)
        return case_to_api(case)


@router.post("/{case_id}/add-alert")
def add_alert(case_id: int, payload: CaseItemIn):
    return _add_item(case_id, "alert", payload.item_id)


@router.post("/{case_id}/add-entity")
def add_entity(case_id: int, payload: CaseItemIn):
    return _add_item(case_id, "entity", payload.item_id)


@router.post("/{case_id}/add-evidence")
def add_evidence(case_id: int, payload: CaseItemIn):
    return _add_item(case_id, "evidence", payload.item_id)


@router.get("/{case_id}/narrative")
def get_narrative(case_id: int):
    try:
        repo.get("cases", case_id)
    except KeyError:
        raise HTTPException(404, f"Кейс {case_id} не найден")
    narrative = latest_narrative(case_id)
    if not narrative:
        return {"status": "empty", "case_id": case_id, "narrative": None}
    return {"status": "ready", "case_id": case_id, "narrative": narrative["content_json"]}


@router.post("/{case_id}/narrative")
def create_narrative(case_id: int):
    try:
        repo.get("cases", case_id)
    except KeyError:
        raise HTTPException(404, f"Кейс {case_id} не найден")
    context = get_case_context(case_id)
    result = generate_narrative(context, case_id)
    if result.get("error"):
        return result
    return {"status": "ready", "case_id": case_id, "narrative": result}


@router.post("/{case_id}/generate-report")
def generate_report(case_id: int):
    return ReportGenerator().generate(case_id)


@router.post("/{case_id}/export")
def export_case(case_id: int):
    return ReportGenerator().generate(case_id)


def _add_item(case_id: int, item_type: str, item_id: int):
    from app import models
    with repo.session() as db:
        case = db.get(models.AnalystCase, case_id)
        if not case:
            raise HTTPException(404, "Case not found")
        evidence = list(case.evidence_items or [])
        evidence.append({"item_type": item_type, "item_id": item_id, "added_at": now_iso()})
        case.evidence_items = evidence
        db.commit()
    repo.log(f"case.add_{item_type}", "case", case_id, {"item_id": item_id})
    return {"case_id": case_id, "item_type": item_type, "item_id": item_id, "added_at": now_iso()}
