from app.services.risk import RiskScoringEngine


def test_risk_scoring_returns_explainable_components():
    result = RiskScoringEngine().score({"category": "kz_database_leak", "text": "mirror wallet bc1DEMO redacted", "entity_count": 4})
    assert 0 <= result["score"] <= 100
    assert "illegal_intent" in result["components"]
    assert result["reasons"]
