from fastapi import APIRouter, HTTPException

from app.services.graph import GraphService
from app.services.repository import repo
from app.services.risk import ExplanationGenerator

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("")
def list_entities(entity_type: str | None = None, q: str | None = None):
    return [e for e in repo.list("entities") if (not entity_type or e["type"] == entity_type or e["entity_type"] == entity_type) and (not q or q.lower() in e["value_redacted"].lower())]


@router.get("/{entity_id}")
def get_entity(entity_id: int):
    try:
        entity = repo.get("entities", entity_id)
    except KeyError:
        raise HTTPException(404, "Entity not found")
    alerts = [a for a in repo.list("alerts") if a.get("primary_entity_id") == entity_id]
    explanation = ExplanationGenerator().explain(alerts[0], [entity]) if alerts else {}
    return {**entity, "alerts": alerts, "risk_explanation": explanation}


@router.get("/{entity_id}/connections")
def connections(entity_id: int):
    return GraphService().entity_subgraph(entity_id)


@router.get("/{entity_id}/related")
def related(entity_id: int):
    return GraphService().entity_subgraph(entity_id)


@router.get("/{entity_id}/timeline")
def timeline(entity_id: int):
    entity = repo.get("entities", entity_id)
    return [
        {"timestamp": entity["first_seen"], "event": "first_seen", "summary": "Entity first observed in redacted configured-source evidence."},
        {"timestamp": entity["last_seen"], "event": "last_seen", "summary": "Entity last observed in configured source evidence."},
    ]
