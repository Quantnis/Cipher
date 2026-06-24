from app.services.nlp import EntityExtractor


def test_entity_extractor_redacts_sensitive_patterns():
    entities = EntityExtractor().extract("Reach @demo_handle_01 phone +7 701 *** 1234 wallet bc1DEMOHASHONLY000000 in Almaty")
    types = {entity["entity_type"] for entity in entities}
    assert {"TelegramHandle", "Phone", "CryptoWallet", "City"}.issubset(types)
    phone = next(entity for entity in entities if entity["entity_type"] == "Phone")
    assert "*" in phone["value_redacted"]
