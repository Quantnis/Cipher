from collections import defaultdict, deque
from datetime import datetime
from sqlalchemy import desc, select

from app import models
from app.database import SessionLocal
from app.services.repository import entity_to_api, source_to_api, to_dict

CLUSTER_PALETTE = ["#22d3ee", "#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#a855f7", "#38bdf8"]


class GraphService:
    def react_flow(self, risk_min: int = 0, category: str | None = None, entity_type: str | None = None, limit: int = 100, date_from: str | None = None, date_to: str | None = None) -> dict:
        with SessionLocal() as db:
            items_query = select(models.RawItem).where(models.RawItem.risk_score >= risk_min)
            if category:
                items_query = items_query.where(models.RawItem.risk_category == category)
            if date_from:
                items_query = items_query.where(models.RawItem.captured_at >= datetime.fromisoformat(date_from.replace("Z", "+00:00")).replace(tzinfo=None))
            if date_to:
                items_query = items_query.where(models.RawItem.captured_at <= datetime.fromisoformat(date_to.replace("Z", "+00:00")).replace(tzinfo=None))
            items = db.scalars(items_query.order_by(desc(models.RawItem.risk_score), desc(models.RawItem.captured_at)).limit(limit)).all()
            nodes: list[dict] = []
            edges: list[dict] = []
            seen_nodes: set[str] = set()

            def add_node(node: dict) -> None:
                if node["id"] not in seen_nodes:
                    seen_nodes.add(node["id"])
                    nodes.append(node)

            for item in items:
                source = db.get(models.Source, item.source_id) if item.source_id else None
                if source:
                    add_node({"id": f"source-{source.id}", "type": source.type, "label": source.name, "riskScore": int(item.risk_score), "metadata": {**source_to_api(source), "captured_at": item.captured_at.isoformat()}})
                item_node = {"id": f"item-{item.id}", "type": "post/message", "label": item.title or item.risk_category, "riskScore": int(item.risk_score), "metadata": to_dict(item)}
                add_node(item_node)
                if source:
                    edges.append({"id": f"source-item-{source.id}-{item.id}", "source": f"source-{source.id}", "target": f"item-{item.id}", "label": "collected", "relationshipType": "mentioned_in", "weight": 1})
                links = db.scalars(select(models.ItemEntity).where(models.ItemEntity.item_id == item.id)).all()
                for link in links:
                    entity = db.get(models.Entity, link.entity_id)
                    if not entity or (entity_type and entity.type != entity_type and entity.type.lower() != entity_type.lower()):
                        continue
                    add_node({"id": f"entity-{entity.id}", "type": entity.type, "label": entity.value_redacted, "riskScore": int(max(entity.risk_score, item.risk_score)), "metadata": entity_to_api(entity)})
                    relationship = "uses wallet" if entity.type == "crypto_wallet" else "located in" if entity.type == "city" else "mentions"
                    edges.append({"id": f"item-entity-{item.id}-{entity.id}", "source": f"item-{item.id}", "target": f"entity-{entity.id}", "label": relationship, "relationshipType": relationship.replace(" ", "_"), "weight": max(1, link.confidence * 3)})
            self._append_hidden_links(db, nodes, edges, seen_nodes, entity_type)
            clusters = self._clusters(nodes, edges)
            cluster_by_node = {node_id: cluster["id"] for cluster in clusters for node_id in cluster["node_ids"]}
            color_by_cluster = {cluster["id"]: cluster["color"] for cluster in clusters}
            for node in nodes:
                cluster_id = cluster_by_node.get(node["id"], "cluster-0")
                node["metadata"] = {**node.get("metadata", {}), "cluster_id": cluster_id, "cluster_color": color_by_cluster.get(cluster_id, CLUSTER_PALETTE[0])}
            return {"nodes": nodes, "edges": edges, "clusters": clusters}

    def _append_hidden_links(self, db, nodes: list[dict], edges: list[dict], seen_nodes: set[str], entity_type: str | None = None) -> None:
        def add_node(node: dict) -> None:
            if node["id"] not in seen_nodes:
                seen_nodes.add(node["id"])
                nodes.append(node)

        links = db.scalars(
            select(models.FingerprintLink)
            .where(models.FingerprintLink.status != "rejected", models.FingerprintLink.score >= 0.0)
            .order_by(desc(models.FingerprintLink.score))
            .limit(120)
        ).all()
        for link in links:
            left = db.get(models.Entity, link.from_entity_id)
            right = db.get(models.Entity, link.to_entity_id)
            if not left or not right:
                continue
            if entity_type and left.type != entity_type and right.type != entity_type and left.type.lower() != entity_type.lower() and right.type.lower() != entity_type.lower():
                continue
            add_node({"id": f"entity-{left.id}", "type": left.type, "label": left.value_redacted, "riskScore": int(left.risk_score), "metadata": entity_to_api(left)})
            add_node({"id": f"entity-{right.id}", "type": right.type, "label": right.value_redacted, "riskScore": int(right.risk_score), "metadata": entity_to_api(right)})
            edges.append({
                "id": f"hidden-link-{link.id}",
                "source": f"entity-{left.id}",
                "target": f"entity-{right.id}",
                "label": f"~схожий субъект {link.confidence_pct}%",
                "relationshipType": "HIDDEN_SIMILARITY" if link.status != "verified" else "VERIFIED_SIMILARITY",
                "weight": max(1.0, link.score * 4),
                "metadata": {
                    "link_id": link.id,
                    "score": link.score,
                    "confidence_pct": link.confidence_pct,
                    "components": link.components_json,
                    "status": link.status,
                    "detected_at": link.detected_at.isoformat(),
                    "requires_analyst_review": link.status == "pending",
                    "method": "digital_fingerprint_5_components",
                },
            })
    def _clusters(self, nodes: list[dict], edges: list[dict]) -> list[dict]:
        adjacency: dict[str, set[str]] = defaultdict(set)
        for node in nodes:
            adjacency[node["id"]]
        for edge in edges:
            adjacency[edge["source"]].add(edge["target"])
            adjacency[edge["target"]].add(edge["source"])
        seen: set[str] = set()
        clusters: list[dict] = []
        for node in nodes:
            if node["id"] in seen:
                continue
            queue = deque([node["id"]])
            seen.add(node["id"])
            node_ids: list[str] = []
            risk = 0
            while queue:
                current = queue.popleft()
                node_ids.append(current)
                risk = max(risk, next((n.get("riskScore", 0) for n in nodes if n["id"] == current), 0))
                for neighbor in adjacency[current]:
                    if neighbor not in seen:
                        seen.add(neighbor)
                        queue.append(neighbor)
            cluster_id = f"cluster-{len(clusters) + 1}"
            clusters.append({"id": cluster_id, "node_ids": node_ids, "size": len(node_ids), "max_risk": risk, "color": CLUSTER_PALETTE[len(clusters) % len(CLUSTER_PALETTE)]})
        return clusters

    def entity_subgraph(self, entity_id: int) -> dict:
        with SessionLocal() as db:
            entity = db.get(models.Entity, entity_id)
            if not entity:
                return {"nodes": [], "edges": [], "clusters": []}
            item_ids = [link.item_id for link in db.scalars(select(models.ItemEntity).where(models.ItemEntity.entity_id == entity_id)).all()]
            payload = self.react_flow(risk_min=0, entity_type=None, limit=150)
            if not item_ids:
                return {"nodes": [{"id": f"entity-{entity.id}", "type": entity.type, "label": entity.value_redacted, "riskScore": int(entity.risk_score), "metadata": entity_to_api(entity)}], "edges": [], "clusters": []}
            keep = {f"entity-{entity_id}"} | {f"item-{item_id}" for item_id in item_ids}
            related_edges = [edge for edge in payload["edges"] if edge["source"] in keep or edge["target"] in keep]
            keep |= {edge["source"] for edge in related_edges} | {edge["target"] for edge in related_edges}
            return {"nodes": [node for node in payload["nodes"] if node["id"] in keep], "edges": related_edges, "clusters": payload.get("clusters", [])}

    def expand_node(self, node_id: str) -> dict:
        if node_id.startswith("entity-"):
            return self.entity_subgraph(int(node_id.split("-", 1)[1]))
        return self.react_flow(limit=150)

    def rebuild_persistent_graph(self) -> dict:
        payload = self.react_flow(limit=200)
        with SessionLocal() as db:
            db.query(models.GraphEdge).delete()
            db.query(models.GraphNode).delete()
            id_map: dict[str, int] = {}
            for node in payload["nodes"]:
                entity_id = None
                raw_item_id = None
                if node["id"].startswith("entity-"):
                    entity_id = int(node["id"].split("-", 1)[1])
                if node["id"].startswith("item-"):
                    raw_item_id = int(node["id"].split("-", 1)[1])
                row = models.GraphNode(node_type=node["type"], label=node["label"], entity_id=entity_id, raw_item_id=raw_item_id, risk_score=node["riskScore"], metadata_json=node.get("metadata", {}))
                db.add(row)
                db.flush()
                id_map[node["id"]] = row.id
            for edge in payload["edges"]:
                if edge["source"] in id_map and edge["target"] in id_map:
                    db.add(models.GraphEdge(source_node_id=id_map[edge["source"]], target_node_id=id_map[edge["target"]], edge_type=edge["relationshipType"], weight=edge.get("weight", 1), evidence_item_id=None))
            db.commit()
            return {"status": "completed", "nodes": len(payload["nodes"]), "edges": len(payload["edges"]), "clusters": len(payload.get("clusters", []))}

    def cluster(self, cluster_id: str) -> dict:
        payload = self.react_flow(risk_min=40 if cluster_id == "top-risk" else 0, limit=100)
        if cluster_id.startswith("cluster-"):
            cluster = next((item for item in payload.get("clusters", []) if item["id"] == cluster_id), None)
            if cluster:
                keep = set(cluster["node_ids"])
                return {"nodes": [node for node in payload["nodes"] if node["id"] in keep], "edges": [edge for edge in payload["edges"] if edge["source"] in keep and edge["target"] in keep], "clusters": [cluster]}
        return payload


