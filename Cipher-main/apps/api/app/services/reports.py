from datetime import datetime, timezone
from html import escape
import hashlib
import json
import urllib.request

from sqlalchemy import select

from app import models
from app.config import settings
from app.database import SessionLocal
from app.services.graph import GraphService
from app.services.repository import entity_to_api, repo, to_dict


class ReportGenerator:
    def generate(self, case_id: int) -> dict:
        case = repo.get("cases", case_id)
        case_items = case.get("evidence_items", [])
        alerts = repo.list("alerts")
        entities = repo.list("entities")
        evidence = repo.list("evidence")
        selected_alerts = [a for a in alerts if any(i.get("item_type") == "alert" and i.get("item_id") == a["id"] for i in case_items)]
        selected_entities = [e for e in entities if any(i.get("item_type") == "entity" and i.get("item_id") == e["id"] for i in case_items)]
        alert_item_ids = {a.get("item_id") for a in selected_alerts}
        selected_evidence = [e for e in evidence if any(i.get("item_type") == "evidence" and i.get("item_id") == e["id"] for i in case_items) or e.get("alert_id") in {a["id"] for a in selected_alerts} or e.get("item_id") in alert_item_ids]
        if not selected_alerts:
            selected_alerts = alerts[:8]
        if not selected_evidence:
            selected_evidence = evidence[:8]
        generated_at = datetime.now(timezone.utc).isoformat()
        graph_snapshot = GraphService().react_flow(risk_min=0, limit=120)
        risk_score = max([a.get("risk_score", 0) for a in selected_alerts] + [0])
        payload = {"case": case, "alerts": selected_alerts, "entities": selected_entities, "evidence": selected_evidence, "graph": graph_snapshot, "generated_at": generated_at, "risk_score": risk_score}
        document_hash = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()
        payload["document_hash"] = document_hash
        html = self._html(case, selected_alerts, selected_entities, selected_evidence, graph_snapshot, generated_at, risk_score, document_hash)
        with repo.session() as db:
            report = models.Report(case_id=case_id, title=f"{case['title']} Report", html_content=html, json_content=payload)
            db.add(report)
            db.commit()
            db.refresh(report)
            repo.log("report.generate", "case", case_id, {"report_id": report.id, "document_hash": document_hash})
            return to_dict(report)

    def generate_deep_analysis(self, entity_id: int) -> dict:
        context = self._entity_deep_context(entity_id)
        generated_at = datetime.now(timezone.utc).isoformat()
        model_name = settings.ollama_model
        section_specs = [
            ("assumed_role", "Return JSON: {\"role\": string, \"confidence\": string, \"rationale\": [string], \"analyst_disclaimer\": string}. Classify cautiously from supplied graph facts only."),
            ("graph_connections", "Return JSON: {\"summary\": string, \"bridges\": [string], \"notable_connections\": [string]}. Mention only supplied links and categories."),
            ("risk_basis", "Return JSON: {\"risk_score\": number, \"risk_level\": string, \"category_breakdown\": [string], \"evidence_ids\": [string]}. Use supplied scores and evidence IDs only."),
            ("narrative", "Return JSON: {\"text\": string}. Write a concise investigative narrative from supplied facts only."),
            ("next_steps", "Return JSON: {\"items\": [string]}. Recommend analyst verification steps only."),
            ("limitations", "Return JSON: {\"items\": [string]}. Include local model limitations, failed sections if any, and human-review requirement."),
        ]
        sections: dict[str, dict] = {}
        failed_sections: list[str] = []
        for name, instruction in section_specs:
            result = self._ollama_section(name, instruction, context)
            if result.get("status") == "failed":
                failed_sections.append(name)
            sections[name] = result
        if failed_sections:
            limitations = sections.get("limitations", {})
            items = limitations.get("items") if isinstance(limitations.get("items"), list) else []
            limitations["items"] = [*items, f"Failed AI sections: {', '.join(failed_sections)}"]
            sections["limitations"] = limitations

        payload = {
            "report_type": "deep_analysis",
            "entity_id": entity_id,
            "generated_at": generated_at,
            "generated_by": f"Ollama local model: {model_name}",
            "ollama": {"base_url": settings.ollama_base_url, "endpoint": settings.ollama_endpoint, "model": model_name},
            "context": context,
            "sections": sections,
            "failed_sections": failed_sections,
        }
        document_hash = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str, ensure_ascii=False).encode("utf-8")).hexdigest()
        payload["document_hash"] = document_hash
        title = f"Deep Analysis - {context['entity'].get('value_redacted') or 'entity'}"
        html = self._deep_html(title, payload)
        with repo.session() as db:
            report = models.Report(case_id=None, title=title, html_content=html, json_content=payload)
            db.add(report)
            db.commit()
            db.refresh(report)
            repo.log("report.deep_analysis", "entity", entity_id, {"report_id": report.id, "document_hash": document_hash, "failed_sections": failed_sections})
            return to_dict(report)

    def _entity_deep_context(self, entity_id: int) -> dict:
        with SessionLocal() as db:
            entity = db.get(models.Entity, entity_id)
            if not entity:
                raise KeyError(f"entity {entity_id} not found")
            entity_api = entity_to_api(entity)
            item_links = db.scalars(select(models.ItemEntity).where(models.ItemEntity.entity_id == entity_id)).all()
            item_ids = [link.item_id for link in item_links]
            items = [db.get(models.RawItem, item_id) for item_id in item_ids]
            items = [item for item in items if item]
            evidence = db.scalars(select(models.Evidence).where(models.Evidence.item_id.in_(item_ids))).all() if item_ids else []
            alerts = db.scalars(select(models.Alert).where(models.Alert.item_id.in_(item_ids))).all() if item_ids else []
            hidden_links = db.scalars(select(models.FingerprintLink).where((models.FingerprintLink.from_entity_id == entity_id) | (models.FingerprintLink.to_entity_id == entity_id))).all()

        graph = GraphService().react_flow(risk_min=0, limit=220)
        node_id = f"entity-{entity_id}"
        node_by_id = {node["id"]: node for node in graph.get("nodes", [])}
        graph_edges = [edge for edge in graph.get("edges", []) if edge.get("source") == node_id or edge.get("target") == node_id]
        connections = []
        categories: dict[str, int] = {}
        for edge in graph_edges:
            other_id = edge["target"] if edge["source"] == node_id else edge["source"]
            other = node_by_id.get(other_id, {"id": other_id, "label": other_id, "type": "unknown", "metadata": {}})
            category = str(other.get("metadata", {}).get("risk_category") or other.get("metadata", {}).get("category") or "unknown")
            categories[category] = categories.get(category, 0) + 1
            connections.append({
                "entity_or_item_id": other_id,
                "label": other.get("label"),
                "type": other.get("type"),
                "relationship_type": edge.get("relationshipType"),
                "basis": edge.get("label"),
                "category": category,
                "metadata": edge.get("metadata") or {},
            })
        hidden_connection_rows = []
        for link in hidden_links:
            other_entity_id = link.to_entity_id if link.from_entity_id == entity_id else link.from_entity_id
            hidden_connection_rows.append({
                "other_entity_id": other_entity_id,
                "relationship_type": "HIDDEN_SIMILARITY" if link.status != "verified" else "VERIFIED_SIMILARITY",
                "confidence_pct": link.confidence_pct,
                "status": link.status,
                "components": link.components_json,
                "evidence_id": link.evidence_id,
            })
        return {
            "entity": {
                "id": entity_api.get("id"),
                "type": entity_api.get("entity_type"),
                "value_redacted": entity_api.get("value_redacted"),
                "value_hash": entity_api.get("value_hash"),
                "risk_score": entity_api.get("risk_score"),
                "first_seen": entity_api.get("first_seen"),
                "last_seen": entity_api.get("last_seen"),
                "metadata_json": entity_api.get("metadata_json") or {},
            },
            "profile_fields_policy": "Only redacted fields already stored by ShadowGraph are supplied. Missing fields must be rendered as data unavailable.",
            "items": [to_dict(item) for item in items[:30]],
            "alerts": [to_dict(alert) for alert in alerts[:30]],
            "evidence": [to_dict(row) for row in evidence[:30]],
            "connections": connections,
            "hidden_similarity_connections": hidden_connection_rows,
            "category_counts": categories,
            "graph_totals": {"nodes": len(graph.get("nodes", [])), "edges": len(graph.get("edges", [])), "connections_for_entity": len(connections) + len(hidden_connection_rows)},
        }

    def _ollama_section(self, name: str, instruction: str, context: dict) -> dict:
        system = (
            "You are a local OSINT analyst assistant. Use only supplied redacted ShadowGraph facts. "
            "Do not invent phone numbers, handles, wallets, locations, subscribers, identities, evidence IDs, or dates. "
            "If data is absent, say data unavailable. Return strict JSON only. Do not assert guilt or criminality."
        )
        user = f"Section: {name}\nInstruction: {instruction}\nContext JSON:\n{json.dumps(context, ensure_ascii=False, default=str)[:14000]}"
        try:
            if settings.ollama_endpoint.endswith("/api/generate"):
                body = {"model": settings.ollama_model, "prompt": f"{system}\n\n{user}", "stream": False, "format": "json"}
            else:
                body = {"model": settings.ollama_model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}], "stream": False, "format": "json"}
            url = settings.ollama_base_url.rstrip("/") + settings.ollama_endpoint
            request = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(request, timeout=settings.ollama_timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
            text = payload.get("response") or payload.get("message", {}).get("content") or ""
            parsed = json.loads(text)
            parsed["status"] = "generated"
            return parsed
        except Exception as exc:
            return {"status": "failed", "message": "generation failed - manual analyst review required", "error": str(exc)[:240]}

    def _html(self, case: dict, alerts: list[dict], entities: list[dict], evidence: list[dict], graph: dict, generated_at: str, risk_score: float, document_hash: str) -> str:
        alert_rows = "".join(f"<tr><td>ALT-{a['id']:04d}</td><td>{a['category']}</td><td>{int(a['risk_score'])}</td><td>{a['status']}</td><td>{a['reason_summary']}</td></tr>" for a in alerts) or "<tr><td colspan='5'>No alerts attached.</td></tr>"
        entity_rows = "".join(f"<tr><td>{e.get('entity_type') or e.get('type')}</td><td>{e.get('value_redacted')}</td><td>{int(e.get('risk_score', 0))}</td><td>{e.get('value_hash')}</td></tr>" for e in entities[:30]) or "<tr><td colspan='4'>No explicit entities attached. Review graph snapshot for related nodes.</td></tr>"
        evidence_rows = "".join(f"<tr><td>EVD-{e['id']:04d}</td><td>{e['evidence_type']}</td><td>{e['sha256_hash']}</td><td>{e.get('source_url','')}</td><td>{e['created_at']}</td></tr>" for e in evidence[:30]) or "<tr><td colspan='5'>No evidence attached.</td></tr>"
        timeline_rows = "".join(f"<tr><td>{a['created_at']}</td><td>{a['title']}</td><td>{a['category']}</td><td>{int(a['risk_score'])}</td></tr>" for a in sorted(alerts, key=lambda x: x.get('created_at', '')))
        recommendations = case.get("recommended_actions") or ["Verify source authorization and provenance", "Validate entity links manually before escalation", "Preserve hashes and timestamps in downstream case systems"]
        return f"""
        <article class="shadowgraph-report">
          <style>
            @media print {{ body {{ background: #fff !important; }} .no-print {{ display: none !important; }} .shadowgraph-report {{ color: #111827 !important; }} }}
            .shadowgraph-report {{ position: relative; font-family: Inter, Arial, sans-serif; color: #e5e7eb; }}
            .watermark {{ position: fixed; inset: 35% auto auto 8%; transform: rotate(-24deg); font-size: 54px; font-weight: 800; letter-spacing: .18em; color: rgba(34,211,238,.09); z-index: 0; pointer-events: none; }}
            .content {{ position: relative; z-index: 1; }}
            h1 {{ font-size: 28px; text-transform: uppercase; letter-spacing: .14em; }}
            h2 {{ margin-top: 28px; font-size: 16px; text-transform: uppercase; letter-spacing: .12em; color: #79C0FF; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }}
            th, td {{ border: 1px solid rgba(113,113,122,.45); padding: 8px; vertical-align: top; }}
            th {{ text-align: left; color: #a1a1aa; text-transform: uppercase; letter-spacing: .08em; }}
            .hash {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }}
            .score {{ display: inline-block; border: 1px solid rgba(244,63,94,.45); background: rgba(244,63,94,.12); padding: 8px 12px; border-radius: 8px; font-family: ui-monospace, monospace; }}
          </style>
          <div class="watermark">CONFIDENTIAL / SHADOWGRAPH KZ</div>
          <div class="content">
            <h1>{case['title']} - ShadowGraph KZ Intelligence Brief</h1>
            <p><strong>Status:</strong> {case['status']} | <strong>Severity:</strong> {case['severity']} | <strong>Generated:</strong> {generated_at}</p>
            <p><strong>Document hash:</strong> <span class="hash">{document_hash}</span></p>
            <h2>Executive Summary</h2>
            <p>{case.get('description') or 'No analyst summary has been added yet. This report was generated from attached alerts, evidence, and graph context.'}</p>
            <h2>Risk Score</h2>
            <p class="score">{int(risk_score)} / 100</p>
            <h2>Key Alerts</h2>
            <table><thead><tr><th>ID</th><th>Category</th><th>Risk</th><th>Status</th><th>Reason</th></tr></thead><tbody>{alert_rows}</tbody></table>
            <h2>Key Entities</h2>
            <table><thead><tr><th>Type</th><th>Redacted value</th><th>Risk</th><th>Hash</th></tr></thead><tbody>{entity_rows}</tbody></table>
            <h2>Timeline</h2>
            <table><thead><tr><th>Time</th><th>Event</th><th>Category</th><th>Risk</th></tr></thead><tbody>{timeline_rows or '<tr><td colspan="4">No timeline events.</td></tr>'}</tbody></table>
            <h2>Evidence Table With Hashes</h2>
            <table><thead><tr><th>ID</th><th>Type</th><th>SHA-256</th><th>Source</th><th>Captured</th></tr></thead><tbody>{evidence_rows}</tbody></table>
            <h2>Graph Snapshot</h2>
            <p>{len(graph.get('nodes', []))} nodes, {len(graph.get('edges', []))} edges, {len(graph.get('clusters', []))} detected clusters.</p>
            <h2>AI Explanation</h2>
            <p>Transparent rule-based classifier combined category severity, Kazakhstan relevance, extracted entities, graph connectivity, freshness, and source provenance. This explanation is an analyst aid and not an attribution claim.</p>
            <h2>Recommended Actions</h2>
            <ul>{''.join(f'<li>{item}</li>' for item in recommendations)}</ul>
            <h2>Legal Note</h2>
            <p>All indicators are derived from analyst-configured public or legally accessible sources. No raw PII should be redistributed. Automated indicators require human verification under applicable authority.</p>
          </div>
        </article>
        """

    def _deep_html(self, title: str, payload: dict) -> str:
        context = payload["context"]
        entity = context["entity"]
        sections = payload["sections"]
        failed = payload.get("failed_sections", [])

        def text_section(name: str, fallback_key: str = "text") -> str:
            section = sections.get(name, {})
            if section.get("status") == "failed":
                return "generation failed - manual analyst review required"
            value = section.get(fallback_key) or section.get("summary") or section.get("rationale") or section.get("items") or section
            if isinstance(value, list):
                return "<ul>" + "".join(f"<li>{escape(str(item))}</li>" for item in value) + "</ul>"
            return escape(str(value))

        profile_rows = "".join(
            f"<tr><td>{escape(label)}</td><td>{escape(str(value if value not in [None, '', []] else 'data unavailable'))}</td></tr>"
            for label, value in [
                ("Entity ID", entity.get("id")),
                ("Type", entity.get("type")),
                ("Redacted value", entity.get("value_redacted")),
                ("Value hash", entity.get("value_hash")),
                ("Risk score", entity.get("risk_score")),
                ("First seen", entity.get("first_seen")),
                ("Last seen", entity.get("last_seen")),
                ("Metadata", json.dumps(entity.get("metadata_json") or {}, ensure_ascii=False)),
            ]
        )
        connection_rows = "".join(
            f"<tr><td>{escape(str(row.get('label')))}</td><td>{escape(str(row.get('type')))}</td><td>{escape(str(row.get('relationship_type')))}</td><td>{escape(str(row.get('basis')))}</td><td>{escape(str(row.get('category')))}</td></tr>"
            for row in context.get("connections", [])[:80]
        ) or "<tr><td colspan='5'>No graph connections available.</td></tr>"
        evidence_rows = "".join(
            f"<tr><td>EVD-{row.get('id'):04d}</td><td>{escape(str(row.get('evidence_type')))}</td><td>{escape(str(row.get('sha256_hash')))}</td><td>{escape(str(row.get('source_url')))}</td></tr>"
            for row in context.get("evidence", [])
        ) or "<tr><td colspan='4'>No evidence rows available.</td></tr>"
        role = sections.get("assumed_role", {})
        risk = sections.get("risk_basis", {})
        steps = sections.get("next_steps", {})
        limitations = sections.get("limitations", {})
        return f"""
        <article class="shadowgraph-report deep-analysis-report">
          <style>
            .shadowgraph-report {{ position: relative; font-family: Inter, Arial, sans-serif; color: #e5e7eb; background: #050816; padding: 32px; }}
            .watermark {{ position: fixed; inset: 35% auto auto 7%; transform: rotate(-24deg); font-size: 50px; font-weight: 800; letter-spacing: .18em; color: rgba(34,211,238,.08); pointer-events: none; }}
            h1 {{ font-size: 26px; text-transform: uppercase; letter-spacing: .14em; }}
            h2 {{ margin-top: 26px; font-size: 15px; text-transform: uppercase; letter-spacing: .12em; color: #79C0FF; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }}
            th, td {{ border: 1px solid rgba(113,113,122,.45); padding: 8px; vertical-align: top; }}
            th {{ text-align: left; color: #a1a1aa; text-transform: uppercase; letter-spacing: .08em; }}
            .notice {{ border: 1px solid rgba(210,153,34,.45); background: rgba(210,153,34,.10); padding: 12px; border-radius: 8px; }}
            .hash {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; color: #22d3ee; }}
          </style>
          <div class="watermark">CONFIDENTIAL / LOCAL AI</div>
          <h1>{escape(title)}</h1>
          <p><strong>Generated:</strong> {escape(payload['generated_at'])} | <strong>Model:</strong> {escape(payload['ollama']['model'])} | <strong>Endpoint:</strong> {escape(payload['ollama']['endpoint'])}</p>
          <p><strong>Document hash:</strong> <span class="hash">{escape(payload['document_hash'])}</span></p>
          <div class="notice">Automated AI inference - requires analyst verification before action. The model received only redacted stored profile fields and graph facts.</div>
          <h2>Personal Information</h2><table><tbody>{profile_rows}</tbody></table>
          <h2>Assumed Role</h2><p><strong>{escape(str(role.get('role', 'data unavailable')))}</strong> ({escape(str(role.get('confidence', 'unknown')))} confidence)</p><div>{text_section('assumed_role', 'rationale')}</div>
          <h2>Graph Connections</h2><div>{text_section('graph_connections', 'summary')}</div><table><thead><tr><th>Connected node</th><th>Type</th><th>Relationship</th><th>Basis</th><th>Category</th></tr></thead><tbody>{connection_rows}</tbody></table>
          <h2>Risk And Evidence Base</h2><p><strong>Score:</strong> {escape(str(risk.get('risk_score', entity.get('risk_score', 'data unavailable'))))} | <strong>Level:</strong> {escape(str(risk.get('risk_level', 'data unavailable')))}</p><div>{text_section('risk_basis', 'category_breakdown')}</div><table><thead><tr><th>ID</th><th>Type</th><th>SHA-256</th><th>Source</th></tr></thead><tbody>{evidence_rows}</tbody></table>
          <h2>Narrative Analysis</h2><p>{text_section('narrative')}</p>
          <h2>Recommended Next Steps</h2><div>{'<ul>' + ''.join(f'<li>{escape(str(item))}</li>' for item in steps.get('items', [])) + '</ul>' if steps.get('status') != 'failed' else 'generation failed - manual analyst review required'}</div>
          <h2>Limitations</h2><div>{'<ul>' + ''.join(f'<li>{escape(str(item))}</li>' for item in limitations.get('items', [])) + '</ul>' if limitations.get('status') != 'failed' else 'generation failed - manual analyst review required'}</div>
          <p><strong>Failed sections:</strong> {escape(', '.join(failed) if failed else 'none')}</p>
        </article>
        """

    def export_json(self, report_id: int) -> dict:
        report = repo.get("reports", report_id)
        return report["json_content"]