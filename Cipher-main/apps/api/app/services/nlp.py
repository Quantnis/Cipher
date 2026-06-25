import hashlib
import re
from urllib.parse import urlparse

KZ_CITIES = {
    "алматы": ("Алматы", 43.238949, 76.889709),
    "астана": ("Астана", 51.160523, 71.470356),
    "шымкент": ("Шымкент", 42.341684, 69.590101),
    "туркестан": ("Туркестан", 43.29733, 68.25175),
    "караганда": ("Караганда", 49.806, 73.085),
    "актобе": ("Актобе", 50.2839, 57.167),
    "павлодар": ("Павлодар", 52.287, 76.967),
    "тараз": ("Тараз", 42.9, 71.3667),
    "кызылорда": ("Кызылорда", 44.8488, 65.4823),
    "семей": ("Семей", 50.4111, 80.2275),
    "усть-каменогорск": ("Усть-Каменогорск", 49.9483, 82.6275),
    "атырау": ("Атырау", 47.1167, 51.8833),
    "актау": ("Актау", 43.65, 51.1667),
    "костанай": ("Костанай", 53.2144, 63.6246),
    "almaty": ("Алматы", 43.238949, 76.889709),
    "astana": ("Астана", 51.160523, 71.470356),
    "shymkent": ("Шымкент", 42.341684, 69.590101),
}

RISK_KEYWORDS = {
    "suspected_illicit_vape_sales": ["вейп", "одноразка", "жидкость", "под", "жижа", "оптом", "vape", "delivery"],
    "suspected_illicit_alcohol_sales": ["акциз", "алкоголь", "контрафакт", "оптом алкоголь"],
    "suspected_narcotics_market": ["клад", "закладка", "нарко", "район", "тайник"],
    "suspected_drop_account_recruitment": ["дроп", "карта", "обнал", "перевод", "drop", "cashout", "account rental"],
    "suspected_crypto_fraud": ["usdt", "btc", "eth", "trc20", "wallet", "кошелек", "crypto", "крипто"],
    "suspected_database_leak": ["база", "слив", "иин", "номер", "пробив", "leak", "database", "dump"],
    "suspected_document_forgery": ["справка", "удостоверение", "паспорт", "диплом", "document", "forgery", "поддел"],
    "suspected_payment_fraud": ["фишинг", "login", "credential", "clone", "phishing", "chargeback", "carding"],
    "suspicious_marketplace": ["telegram", "телеграм", "канал", "магазин", "витрина", "market", "escrow"],
}

CATEGORY_ALIASES = {
    "illegal_vape_sales": "suspected_illicit_vape_sales",
    "alcohol_smuggling": "suspected_illicit_alcohol_sales",
    "narcotics_advertising": "suspected_narcotics_market",
    "drug_related": "suspected_narcotics_market",
    "dropper_recruitment": "suspected_drop_account_recruitment",
    "data_leak_mentions": "suspected_database_leak",
    "data_leak": "suspected_database_leak",
    "phishing": "suspected_payment_fraud",
    "suspicious_payment_infrastructure": "suspected_payment_fraud",
    "suspicious_crypto_wallet": "suspected_crypto_fraud",
    "suspicious_telegram_shop": "suspicious_marketplace",
    "unknown": "suspicious_but_unclear",
    "unclassified": "benign",
}

def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def redact_value(entity_type: str, value: str) -> str:
    if entity_type == "phone":
        digits = re.sub(r"\D", "", value)
        if len(digits) >= 6:
            return f"+{digits[:1]} {digits[1:4]} *** ** {digits[-2:]}"
    if entity_type == "iin_pattern_redacted":
        return f"********{value[-4:]}"
    if entity_type in {"wallet", "crypto_wallet", "bank_card_hint", "payment_method"} and len(value) > 14:
        return f"{value[:6]}...{value[-4:]}"
    if entity_type == "email" and "@" in value:
        left, right = value.split("@", 1)
        return f"{left[:2]}***@{right}"
    return value


def redact_text(text: str) -> str:
    text = re.sub(r"(?<!\d)(\d{12})(?!\d)", lambda m: f"********{m.group(1)[-4:]}", text)
    text = re.sub(r"\+?7[\s()-]*\d{3}[\s()-]*\d{3}[\s()-]*\d{2}[\s()-]*\d{2}", lambda m: redact_value("phone", m.group(0)), text)
    return text


class LanguageDetector:
    def detect(self, text: str) -> str:
        lowered = text.lower()
        if any(ch in lowered for ch in "әғқңөұүһі"):
            return "kk/ru"
        if re.search(r"[а-яА-Я]", text):
            return "ru/mixed"
        return "en/translit"


class EntityExtractor:
    PATTERNS = [
        ("telegram_handle", r"(?<!\w)@[a-zA-Z0-9_]{5,32}"),
        ("telegram_handle", r"https?://t\.me/[a-zA-Z0-9_]{5,64}"),
        ("email", r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+"),
        ("url", r"https?://[^\s<>'\"]+"),
        ("phone", r"\+?7[\s()-]*\d{3}[\s()-]*\d{3}[\s()-]*\d{2}[\s()-]*\d{2}"),
        ("phone", r"\+?7[\s()-]*\d{3}[\s()-]*\*{2,4}[\s()-]*\d{2,4}"),
        ("wallet", r"\b0x[a-fA-F0-9]{16,40}\b|\bT[A-Za-z0-9]{16,40}\b|\bbc1[A-Za-z0-9]{12,74}\b|\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b"),
        ("payment_method", r"\b(?:kaspi|каспи|halyk|халык|usdt|trc20|карта|банк|перевод)\b"),
        ("payment_method", r"\b(?:\d{4}[ -]?){2,3}\*{2,4}(?:[ -]?\d{2,4})?\b"),
        ("price", r"\b\d[\d\s.,]{2,12}\s?(?:₸|тг|kzt|usd|usdt|\$)\b"),
        ("iin_pattern_redacted", r"(?<!\d)\d{12}(?!\d)"),
        ("alias", r"(?i)(?:aka|alias|ник|username|user)[:\s]+[a-zA-Z0-9_.-]{4,32}"),
    ]

    def extract(self, text: str) -> list[dict]:
        entities: list[dict] = []
        seen: set[tuple[str, str]] = set()
        for entity_type, pattern in self.PATTERNS:
            for match in re.findall(pattern, text, flags=re.IGNORECASE):
                value = match.strip(".,);]")
                self._append(entities, seen, entity_type, value, 0.9, "regex")
                if entity_type == "telegram_handle" and value.lower().startswith("http"):
                    value = "@" + value.rstrip("/").split("/")[-1]
                if entity_type == "alias" and ":" in value:
                    value = value.split(":", 1)[1].strip()
                if entity_type == "url":
                    domain = urlparse(value).netloc.lower().removeprefix("www.")
                    if domain:
                        self._append(entities, seen, "domain", domain, 0.9, "url_parse")
        lowered = text.lower()
        for key, (city, lat, lon) in KZ_CITIES.items():
            if key in lowered:
                self._append(entities, seen, "location", city, 0.86, "dictionary", {"latitude": lat, "longitude": lon})
        for category, keywords in RISK_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in lowered:
                    self._append(entities, seen, "keyword", keyword, 0.78, "dictionary", {"category": category})
                    self._append(entities, seen, "keyword", category, 0.72, "classifier_hint", {"category": category})
                    break
        return entities

    def _append(self, entities: list[dict], seen: set[tuple[str, str]], entity_type: str, value: str, confidence: float, method: str, metadata: dict | None = None) -> None:
        legacy = {
            "telegram_handle": "TelegramHandle",
            "telegram_username": "TelegramHandle",
            "telegram_channel": "TelegramChannel",
            "phone": "Phone",
            "email": "Email",
            "wallet": "CryptoWallet",
            "crypto_wallet": "CryptoWallet",
            "location": "City",
            "city": "City",
            "url": "Url",
            "domain": "Domain",
            "price": "Price",
            "payment_method": "PaymentMethod",
            "alias": "Alias",
        }.get(entity_type, entity_type)
        normalized = value.lower().strip()
        if entity_type == "phone":
            digits = re.sub(r"\D", "", value)
            normalized = "+" + digits if digits.startswith("7") else digits
        if entity_type == "telegram_handle" and not normalized.startswith("@"):
            normalized = "@" + normalized.rsplit("/", 1)[-1]
        key = (entity_type, normalized)
        if key in seen:
            return
        seen.add(key)
        entities.append(
            {
                "entity_type": legacy,
                "legacy_entity_type": legacy,
                "type": entity_type,
                "value": value,
                "value_hash": sha256(normalized),
                "value_redacted": redact_value(entity_type, value),
                "normalized_value": normalized,
                "confidence": confidence,
                "extraction_method": method,
                "metadata": metadata or {},
            }
        )


class CategoryClassifier:
    def classify(self, text: str) -> dict:
        lowered = text.lower()
        scores = {category: sum(1 for kw in keywords if kw.lower() in lowered) for category, keywords in RISK_KEYWORDS.items()}
        category = max(scores, key=scores.get) if scores else "suspicious_but_unclear"
        if scores.get(category, 0) == 0:
            category = "benign"
        category = CATEGORY_ALIASES.get(category, category)
        signals = [CATEGORY_ALIASES.get(key, key) for key, value in scores.items() if value > 0]
        return {"category": category, "confidence": min(0.96, 0.48 + scores.get(category, 0) * 0.12), "signals": sorted(set(signals))}


class SimilarityClusterer:
    def signature(self, text: str) -> str:
        tokens = sorted(set(re.findall(r"[\wа-яА-Я]{4,}", text.lower())))
        return sha256(" ".join(tokens[:30]))[:16]
