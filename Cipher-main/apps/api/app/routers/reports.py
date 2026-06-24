from fastapi import APIRouter, HTTPException

from app.services.reports import ReportGenerator
from app.services.repository import repo

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
def list_reports():
    return repo.list("reports")


@router.post("/generate")
def generate_report(payload: dict):
    case_id = int(payload.get("case_id", 0))
    if not case_id:
        raise HTTPException(422, "case_id is required")
    return ReportGenerator().generate(case_id)


@router.get("/{report_id}")
def get_report(report_id: int):
    try:
        return repo.get("reports", report_id)
    except KeyError:
        raise HTTPException(404, "Report not found")


@router.post("/{report_id}/export-json")
def export_json(report_id: int):
    return ReportGenerator().export_json(report_id)

