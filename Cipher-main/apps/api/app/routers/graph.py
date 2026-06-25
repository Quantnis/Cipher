from fastapi import APIRouter

from app.schemas import GraphQuery
from app.services.graph import GraphService
from app.services.repository import case_to_api, repo

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("")
def graph(risk_min: int = 0, category: str | None = None, entity_type: str | None = None, date_from: str | None = None, date_to: str | None = None):
    repo.log("graph.view", "graph", None, {"risk_min": risk_min, "category": category, "entity_type": entity_type})
    return GraphService().react_flow(risk_min=risk_min, category=category, entity_type=entity_type, date_from=date_from, date_to=date_to)


@router.get("/entity/{entity_id}")
def entity_graph(entity_id: int):
    repo.log("graph.entity", "entity", entity_id)
    return GraphService().entity_subgraph(entity_id)


@router.get("/cluster/{cluster_id}")
def graph_cluster(cluster_id: str):
    repo.log("graph.cluster", "graph", None, {"cluster_id": cluster_id})
    return GraphService().cluster(cluster_id)


@router.get("/expand/{node_id}")
def expand_node(node_id: str):
    repo.log("graph.expand", "graph", None, {"node_id": node_id})
    return GraphService().expand_node(node_id)


@router.get("/export")
def export_graph():
    repo.log("graph.export_json", "graph")
    return GraphService().react_flow(limit=250)


@router.post("/rebuild")
def rebuild_graph():
    repo.log("graph.rebuild", "graph")
    return GraphService().rebuild_persistent_graph()


@router.post("/case-from-cluster")
def case_from_cluster(payload: dict):
    from app import models

    cluster_id = payload.get("cluster_id", "top-risk")
    graph = GraphService().cluster(cluster_id)
    evidence_items = [
        {"item_type": "graph_node", "node_id": node["id"], "risk_score": node.get("riskScore", 0)}
        for node in graph["nodes"][:25]
    ]
    severity = "critical" if any(node.get("riskScore", 0) >= 85 for node in graph["nodes"]) else "high" if any(node.get("riskScore", 0) >= 70 for node in graph["nodes"]) else "medium"
    with repo.session() as db:
        case = models.AnalystCase(
            title=payload.get("title") or f"Graph cluster review: {cluster_id}",
            summary="Generated from selected graph cluster. Connections are automated indicators and require analyst verification.",
            severity=severity,
            status="new",
            main_entities=[node for node in graph["nodes"] if str(node["id"]).startswith("entity-")][:10],
            evidence_items=evidence_items,
            recommended_actions=["Review node provenance", "Validate shared entities manually", "Attach verified evidence before escalation"],
        )
        db.add(case)
        db.commit()
        db.refresh(case)
    repo.log("graph.case_from_cluster", "case", case.id, {"cluster_id": cluster_id})
    return case_to_api(case)


@router.post("/query")
def query(payload: GraphQuery):
    return GraphService().react_flow(payload.risk_min, payload.category, payload.entity_type)


@router.post("/selected-to-case")
def selected_to_case(payload: dict):
    repo.log("graph.selected_to_case", "case", payload.get("case_id"), payload)
    return {"case_id": payload.get("case_id", 1), "selected_nodes": payload.get("node_ids", []), "status": "added"}


@router.get("/search")
def search_graph(q: str = "", risk_min: int = 0, entity_type: str | None = None):
    payload = GraphService().react_flow(risk_min=risk_min, entity_type=entity_type, limit=250)
    if not q:
        return payload
    keep = {node["id"] for node in payload["nodes"] if q.lower() in f"{node.get('label')} {node.get('type')}".lower()}
    related = [edge for edge in payload["edges"] if edge["source"] in keep or edge["target"] in keep]
    keep |= {edge["source"] for edge in related} | {edge["target"] for edge in related}
    return {"nodes": [node for node in payload["nodes"] if node["id"] in keep], "edges": related, "clusters": payload.get("clusters", [])}


@router.get("/neighbors/{node_id}")
def neighbors(node_id: str):
    return GraphService().expand_node(node_id)
