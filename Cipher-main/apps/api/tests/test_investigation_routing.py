from app.services.investigations import infer_investigation_type


def test_router_selects_mixed_for_broad_osint_query():
    assert infer_investigation_type("vape delivery Almaty telegram usdt") == "mixed_full_scan"


def test_router_detects_web_and_wallet_and_override():
    assert infer_investigation_type("https://example.org/path") == "web_search"
    assert infer_investigation_type("0x1111111111111111111111111111111111111111") == "crypto_wallet_lookup"
    assert infer_investigation_type("anything", "telegram_public") == "telegram_public"
