from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class RiskInput:
    category: str
    text: str
    entity_count: int
    repeated_entities: int = 0
    graph_connections: int = 0
    source_reliability: int = 6
    first_seen: datetime | None = None
    confidence: float = 0.5


class RiskScoringEngine:
    CATEGORY_SEVERITY = {
        "narcotics_advertising": 25,
        "data_leak_mentions": 24,
        "phishing": 22,
        "dropper_recruitment": 21,
        "suspicious_payment_infrastructure": 19,
        "suspicious_crypto_wallet": 17,
        "alcohol_smuggling": 16,
        "illegal_vape_sales": 15,
        "suspicious_telegram_shop": 13,
        "unclassified": 3,
        "unknown": 0,
    }
    KZ_HINTS = ["казахстан", "алматы", "астана", "шымкент", "каспи", "халык", "+7", "kz", "тг", "тенге"]

    def score(self, payload: RiskInput | dict) -> dict:
        data = payload if isinstance(payload, RiskInput) else RiskInput(**payload)
        text = data.text.lower()
        category_severity = self.CATEGORY_SEVERITY.get(data.category, 8)
        entity_richness = min(20, data.entity_count * 4)
        kazakhstan_relevance = min(15, sum(5 for hint in self.KZ_HINTS if hint in text))
        if data.first_seen:
            age_days = max(0, (datetime.now(timezone.utc) - data.first_seen.replace(tzinfo=timezone.utc)).days)
            freshness = 15 if age_days <= 1 else 11 if age_days <= 7 else 5
        else:
            freshness = 12
        graph_connectivity = min(15, data.graph_connections * 3 + data.repeated_entities * 4)
        source_reliability = min(10, max(0, data.source_reliability))
        components = {
            "category_severity": category_severity,
            "illegal_intent": category_severity,
            "entity_richness": entity_richness,
            "kazakhstan_relevance": kazakhstan_relevance,
            "freshness": freshness,
            "graph_connectivity": graph_connectivity,
            "source_reliability": source_reliability,
        }
        total = min(100, category_severity + entity_richness + kazakhstan_relevance + freshness + graph_connectivity + source_reliability)
        reasons = []
        if category_severity:
            reasons.append(f"Risk category indicator detected: {data.category.replace('_', ' ')} (+{category_severity})")
        if entity_richness:
            reasons.append(f"{data.entity_count} public entities extracted from the item (+{entity_richness})")
        if kazakhstan_relevance:
            reasons.append(f"Kazakhstan relevance detected in language, location, domain, payment, or phone hints (+{kazakhstan_relevance})")
        if graph_connectivity:
            reasons.append(f"Entity reuse or graph connectivity increased score (+{graph_connectivity})")
        reasons.append("Automated indicator only; requires analyst verification before action")
        return {
            "score": total,
            "confidence": round(min(0.97, max(data.confidence, 0.35) + total / 220), 2),
            "reasons": reasons,
            "components": components,
            "model_version": "transparent-rules-v1",
        }


class ExplanationGenerator:
    def explain(self, alert: dict, entities: list[dict]) -> dict:
        entity_preview = ", ".join(e.get("value_redacted", "") for e in entities[:5]) or "no extracted entities"
        return {
            "why_flagged": f"Flagged as an indicator of {alert.get('category', 'unknown')} with score {alert.get('risk_score', 0)}. This is not a verified finding.",
            "connections": f"Connected redacted entities include {entity_preview}.",
            "evidence": alert.get("reason_summary", "Evidence record includes source URL, capture time, content hash, and redacted excerpt."),
            "recommended_action": "Review source provenance, validate entity reuse, and escalate only after human verification.",
            "limitations": "Automated OSINT analysis can misclassify slang, reposts, jokes, and copied text.",
        }
