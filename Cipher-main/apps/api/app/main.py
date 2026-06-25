from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import admin, audit, auth, cases, crawler, dashboard, entities, evidence, fingerprint, graph, investigations, mvp, osint, reports, signals, sources, threats
from app.services.repository import repo

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Evidence-first OSINT/risk intelligence API for legally accessible configured sources.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [
    auth.router,
    investigations.router,
    signals.router,
    audit.router,
    dashboard.router,
    sources.router,
    crawler.router,
    threats.router,
    osint.router,
    entities.router,
    graph.router,
    cases.router,
    evidence.router,
    fingerprint.router,
    reports.router,
    admin.router,
    mvp.router,
]:
    app.include_router(router)
    if router is not mvp.router:
        app.include_router(router, prefix="/api")


@app.on_event("startup")
def startup() -> None:
    init_db()
    repo.ensure_defaults()


@app.get("/health")
def health():
    return {"status": "healthy", "demo_mode": settings.demo_mode, "real_crawler_enabled": settings.enable_real_crawler, "database": "configured"}

