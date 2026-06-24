from datetime import datetime, timezone
from fastapi import APIRouter

from app.services.repository import repo

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/demo-login")
def demo_login():
    user = repo.list("users")[0]
    repo.log("auth.demo_login", "user", user["id"])
    return {"token": "local-authorized-analyst-session", "user": user, "issued_at": datetime.now(timezone.utc)}


@router.get("/me")
def me():
    return repo.list("users")[0]
