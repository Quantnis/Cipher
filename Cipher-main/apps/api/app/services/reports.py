from datetime import datetime, timezone
import hashlib
import json

from app import models
from app.services.graph import GraphService
from app.services.repository import repo, to_dict


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
            h2 {{ margin-top: 28px; font-size: 16px; text-transform: uppercase; letter-spacing: .12em; color: #67e8f9; }}
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

    def export_json(self, report_id: int) -> dict:
        report = repo.get("reports", report_id)
        return report["json_content"]
