from dataclasses import dataclass
from datetime import datetime, timezone

CATEGORY_ALIASES = {
    "illegal_vape_sales": "suspected_illicit_vape_sales",
    "alcohol_smuggling": "suspected_illicit_alcohol_sales",
    "narcotics_advertising": "suspected_narcotics_market",
    "drug_related": "suspected_narcotics_market",
    "dropper_recruitment": "suspected_drop_account_recruitment",
    "data_leak_mentions": "suspected_database_leak",
    "data_leak": "suspected_database_leak",
    "kz_database_leak": "suspected_database_leak",
    "phishing": "suspected_payment_fraud",
    "suspicious_payment_infrastructure": "suspected_payment_fraud",
    "suspicious_crypto_wallet": "suspected_crypto_fraud",
    "suspicious_telegram_shop": "suspicious_marketplace",
    "unknown": "suspicious_but_unclear",
    "unclassified": "benign",
}

CATEGORY_COLORS = {
    "suspected_illicit_vape_sales": "#D29922",
    "suspected_illicit_alcohol_sales": "#79C0FF",
    "suspected_narcotics_market": "#F85149",
    "suspected_drop_account_recruitment": "#D29922",
    "suspected_crypto_fraud": "#BC8CFF",
    "suspected_database_leak": "#2F81F7",
    "suspected_document_forgery": "#E09B3D",
    "suspected_payment_fraud": "#F85149",
    "suspicious_marketplace": "#D29922",
    "suspicious_but_unclear": "#8B949E",
    "benign": "#3FB950",
    "default": "#8B949E",
}

SEVERITY_COLORS = {
    "CRITICAL": "#F85149",
    "HIGH": "#D29922",
    "MEDIUM": "#2F81F7",
    "LOW": "#8B949E",
    "NEW": "#3FB950",
}


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
        "suspected_narcotics_market": 35,
        "suspected_database_leak": 30,
        "suspected_drop_account_recruitment": 25,
        "suspected_payment_fraud": 25,
        "suspected_document_forgery": 24,
        "suspected_crypto_fraud": 22,
        "suspected_illicit_vape_sales": 20,
        "suspected_illicit_alcohol_sales": 20,
        "suspicious_marketplace": 15,
        "suspicious_but_unclear": 8,
        "benign": 0,
    }
    KZ_HINTS = ["казахстан", "алматы", "астана", "шымкент", "туркестан", "караганда", "каспи", "халык", "+7", "kz", "тг", "тенге", "almaty"]
    SUSPICIOUS_HINTS = ["delivery", "доставка", "оптом", "usdt", "trc20", "wallet", "кошелек", "слив", "database", "дроп", "карта"]

    def normalize_category(self, category: str) -> str:
        return CATEGORY_ALIASES.get((category or "").strip(), category or "suspicious_but_unclear")

    def level(self, score: float) -> str:
        if score >= 80:
            return "critical"
        if score >= 60:
            return "high"
        if score >= 35:
            return "medium"
        return "low"

    def score(self, payload: RiskInput | dict) -> dict:
        data = payload if isinstance(payload, RiskInput) else RiskInput(**payload)
        category = self.normalize_category(data.category)
        text = data.text.lower()
        factors: list[dict] = []

        def add(name: str, points: int, explanation: str) -> int:
            if points:
                factors.append({"name": name, "points": points, "explanation": explanation})
            return points

        category_points = add("category risk", self.CATEGORY_SEVERITY.get(category, 8), f"Matched category {category}.")
        keyword_hits = sorted({hint for hint in self.SUSPICIOUS_HINTS if hint in text})
        keyword_points = add("suspicious keyword risk", min(12, len(keyword_hits) * 3), f"Suspicious terms observed: {', '.join(keyword_hits[:6])}.")
        entity_points = add("entity richness", min(20, data.entity_count * 4), f"{data.entity_count} entities were extracted from the evidence.")
        repeated_points = add("repeated entity risk", min(15, data.repeated_entities * 5), "Same entity appears in multiple documents.")
        graph_points = add("graph centrality risk", min(15, data.graph_connections * 3), "Entity graph has multiple connected observations.")
        source_points = add("source attribution risk", min(10, max(0, data.source_reliability)), "Source has provenance or configured legal basis metadata.")
        kz_hits = sorted({hint for hint in self.KZ_HINTS if hint in text})
        location_points = add("location relevance", min(8, len(kz_hits) * 4), f"Kazakhstan relevance detected: {', '.join(kz_hits[:5])}.")
        if data.first_seen:
            age_days = max(0, (datetime.now(timezone.utc) - data.first_seen.replace(tzinfo=timezone.utc)).days)
            recency = 8 if age_days <= 2 else 5 if age_days <= 7 else 2
        else:
            recency = 6
        recency_points = add("recency risk", recency, "Recent or newly collected evidence receives higher triage priority.")
        confidence_points = 0
        if data.confidence >= 0.75:
            confidence_points = add("AI confidence", 5, "Classifier confidence is high enough to increase triage priority.")
        elif data.confidence < 0.45:
            confidence_points = -10
            factors.append({"name": "low confidence", "points": -10, "explanation": "Low classifier confidence reduced the score."})

        total = max(0, min(100, category_points + keyword_points + entity_points + repeated_points + graph_points + source_points + location_points + recency_points + confidence_points))
        components = {
            "category_severity": category_points,
            "illegal_intent": category_points,
            "suspicious_keywords": keyword_points,
            "entity_richness": entity_points,
            "kazakhstan_relevance": location_points,
            "freshness": recency_points,
            "graph_connectivity": graph_points + repeated_points,
            "source_reliability": source_points,
            "ai_confidence": confidence_points,
        }
        reasons = [f"{factor['explanation']} ({factor['points']:+d})" for factor in factors]
        reasons.append("Automated indicator only; requires analyst verification before action.")
        return {
            "score": total,
            "level": self.level(total),
            "confidence": round(min(0.97, max(data.confidence, 0.35) + total / 240), 2),
            "reasons": reasons,
            "factors": factors,
            "components": components,
            "category": category,
            "model_version": "transparent-rules-v2",
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
