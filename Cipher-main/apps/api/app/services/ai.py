from __future__ import annotations

import json
import urllib.request

from app.config import settings


class AIAnalyst:
    def analyze_item(self, item: dict, entities: list[dict], risk_scores: list[dict]) -> dict:
        evidence = {
            "item_id": item.get("id"),
            "source_url": item.get("source_url"),
            "captured_at": item.get("captured_at"),
            "content_hash": item.get("content_hash"),
            "risk_category": item.get("risk_category"),
            "risk_score": item.get("risk_score"),
            "entities": [
                {"type": entity.get("type"), "value_redacted": entity.get("value_redacted"), "confidence": entity.get("confidence")}
                for entity in entities[:20]
            ],
            "risk_reasons": risk_scores[0].get("reasons", []) if risk_scores else [],
            "excerpt": item.get("raw_text", "")[:1800],
        }
        if settings.openai_api_key:
            provider_result = self._openai_analysis(evidence)
            if provider_result:
                return provider_result
        return self._rules_analysis(evidence)

    def _openai_analysis(self, evidence: dict) -> dict | None:
        prompt = (
            "You are an OSINT analyst assistant for Kazakhstan public-source risk intelligence. "
            "Analyze only the supplied evidence. Do not assert criminality. Use language such as "
            "'indicator', 'possible connection', and 'requires analyst verification'. Redact sensitive values. "
            "Return strict JSON with keys: summary, risk_explanation, possible_connections, recommended_next_steps, "
            "confidence_level, limitations, cited_source_items."
        )
        body = {
            "model": "gpt-4.1-mini",
            "input": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(evidence, ensure_ascii=False)},
            ],
            "text": {"format": {"type": "json_object"}},
        }
        request = urllib.request.Request(
            "https://api.openai.com/v1/responses",
            data=json.dumps(body).encode("utf-8"),
            headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            text = payload.get("output_text")
            if not text:
                parts = payload.get("output", [{}])[0].get("content", [])
                text = "".join(part.get("text", "") for part in parts)
            return json.loads(text)
        except Exception:
            return None

    def _rules_analysis(self, evidence: dict) -> dict:
        entities = evidence.get("entities", [])
        reasons = evidence.get("risk_reasons", [])
        return {
            "summary": f"Automated public-source indicator classified as {evidence.get('risk_category', 'unclassified')} with score {evidence.get('risk_score', 0)}.",
            "risk_explanation": reasons or ["No high-confidence risk reason is available."],
            "possible_connections": [f"{entity['type']}: {entity['value_redacted']}" for entity in entities[:8]],
            "recommended_next_steps": [
                "Verify the source URL, capture timestamp, and content hash.",
                "Review repeated entities in the graph before escalation.",
                "Treat the result as an indicator requiring human verification.",
            ],
            "confidence_level": "medium" if evidence.get("risk_score", 0) >= 40 else "low",
            "limitations": "AI provider is not configured; this analysis uses transparent rules and extracted redacted entities only.",
            "cited_source_items": [
                {
                    "item_id": evidence.get("item_id"),
                    "source_url": evidence.get("source_url"),
                    "captured_at": evidence.get("captured_at"),
                    "content_hash": evidence.get("content_hash"),
                }
            ],
        }
