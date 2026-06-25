from fastapi import APIRouter

from app.services.repository import repo

router = APIRouter(prefix="/audit-logs", tags=["audit"] )


@router.get("")
def audit_logs():
    return repo.list("audit_logs")
