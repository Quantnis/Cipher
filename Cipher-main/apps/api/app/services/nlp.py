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
    "illegal_vape_sales": ["вейп", "одноразка", "жидкость", "под", "жижа", "оптом", "vape"],
    "alcohol_smuggling": ["акциз", "алкоголь", "контрафакт", "оптом алкоголь"],
    "narcotics_advertising": ["клад", "закладка", "курьер", "район", "доставка"],
    "dropper_recruitment": ["дроп", "карта", "обнал", "перевод", "drop", "cashout"],
    "data_leak_mentions": ["база", "слив", "иин", "номер", "пробив", "leak", "database"],
    "phishing": ["фишинг", "login", "credential", "clone", "phishing"],
    "suspicious_crypto_wallet": ["usdt", "btc", "eth", "trc20", "wallet", "кошелек"],
    "suspicious_telegram_shop": ["telegram", "телеграм", "канал", "магазин", "витрина"],
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
    if entity_type in {"crypto_wallet", "bank_card_hint"} and len(value) > 14:
        return f"{value[:6]}...{value[-4:]}"
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
        ("telegram_username", r"(?<!\w)@[a-zA-Z0-9_]{5,32}"),
        ("telegram_channel", r"https?://t\.me/[a-zA-Z0-9_]{5,64}"),
        ("url", r"https?://[^\s<>'\"]+"),
        ("phone", r"\+?7[\s()-]*\d{3}[\s()-]*\d{3}[\s()-]*\d{2}[\s()-]*\d{2}"),
        ("phone", r"\+?7[\s()-]*\d{3}[\s()-]*\*{2,4}[\s()-]*\d{2,4}"),
        ("crypto_wallet", r"\b0x[a-fA-F0-9]{16,40}\b|\bT[A-Za-z0-9]{16,40}\b|\bbc1[A-Za-z0-9]{12,74}\b|\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b"),
        ("price", r"\b\d[\d\s.,]{2,12}\s?(?:₸|тг|kzt|usd|usdt|\$)\b"),
        ("iin_pattern_redacted", r"(?<!\d)\d{12}(?!\d)"),
    ]

    def extract(self, text: str) -> list[dict]:
        entities: list[dict] = []
        seen: set[tuple[str, str]] = set()
        for entity_type, pattern in self.PATTERNS:
            for match in re.findall(pattern, text, flags=re.IGNORECASE):
                value = match.strip(".,);]")
                self._append(entities, seen, entity_type, value, 0.9, "regex")
                if entity_type == "url":
                    domain = urlparse(value).netloc.lower().removeprefix("www.")
                    if domain:
                        self._append(entities, seen, "domain", domain, 0.9, "url_parse")
        lowered = text.lower()
        for key, (city, lat, lon) in KZ_CITIES.items():
            if key in lowered:
                self._append(entities, seen, "city", city, 0.86, "dictionary", {"latitude": lat, "longitude": lon})
        for category, keywords in RISK_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in lowered:
                    self._append(entities, seen, "keyword", keyword, 0.78, "dictionary", {"category": category})
                    self._append(entities, seen, "product" if "vape" in category or "narcotics" in category else "keyword", category, 0.72, "classifier_hint")
                    break
        return entities

    def _append(self, entities: list[dict], seen: set[tuple[str, str]], entity_type: str, value: str, confidence: float, method: str, metadata: dict | None = None) -> None:
        legacy = {
            "telegram_username": "TelegramHandle",
            "telegram_channel": "TelegramChannel",
            "phone": "Phone",
            "crypto_wallet": "CryptoWallet",
            "city": "City",
            "url": "Url",
            "domain": "Domain",
            "price": "Price",
        }.get(entity_type, entity_type)
        normalized = value.lower().strip()
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
        category = max(scores, key=scores.get) if scores else "unknown"
        if scores.get(category, 0) == 0:
            category = "unclassified"
        signals = [key for key, value in scores.items() if value > 0]
        return {"category": category, "confidence": min(0.96, 0.48 + scores.get(category, 0) * 0.12), "signals": signals}


class SimilarityClusterer:
    def signature(self, text: str) -> str:
        tokens = sorted(set(re.findall(r"[\wа-яА-Я]{4,}", text.lower())))
        return sha256(" ".join(tokens[:30]))[:16]
