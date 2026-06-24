from __future__ import annotations

from collections import Counter
from datetime import datetime
import hashlib
import math
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal

try:  # Optional runtime dependency; fallback keeps demo usable without ML install.
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover - exercised only when numpy is absent
    np = None  # type: ignore

_TOPIC_MODEL: Any | None = None

TOKEN_RE = re.compile(r"[а-яёА-ЯЁa-zA-Z0-9_]{2,}")
PRICE_RE = re.compile(r"\d+\s*(тг|тенге|руб|₸|\$|usdt)", re.IGNORECASE)
EMOJI_RE = re.compile(r"[\U0001F300-\U0001FFFF]")
CTA_WORDS = ["пишите", "пиши", "заказывай", "звоните", "жми", "переходи", "подписывайся"]
KZ_CITIES = ["алматы", "астана", "шымкент", "караганда", "актобе", "тараз", "павлодар"]
PAYMENT_WORDS = ["kaspi", "каспи", "halyk", "халык", "bcc", "forte", "usdt", "btc", "eth", "trx"]


def _to_float_list(values: Any) -> list[float]:
    if np is not None and hasattr(values, "tolist"):
        return [float(v) for v in values.tolist()]
    return [float(v) for v in values]


def _normalize(values: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in values))
    return [v / norm for v in values] if norm > 0 else values


def _hash_bucket(token: str, size: int) -> int:
    return int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % size


class FingerprintExtractor:
    fingerprint_dim = 530

    def extract(self, entity_id: int | str) -> list[float]:
        with SessionLocal() as db:
            texts = self._get_entity_texts(db, int(entity_id))
            timestamps = self._get_entity_timestamps(db, int(entity_id))
            metadata = self._get_entity_metadata(db, int(entity_id), texts)

        c1 = [v * 0.30 for v in self._lexical_profile(texts)]
        c2 = [v * 0.25 for v in self._temporal_pattern(timestamps)]
        c3 = [v * 0.20 for v in self._behavioral_style(texts)]
        c4 = [v * 0.15 for v in self._network_profile(metadata)]
        c5 = [v * 0.10 for v in self._topic_vector(texts)]
        return _normalize(c1 + c2 + c3 + c4 + c5)

    def inspect(self, entity_id: int | str) -> dict[str, Any]:
        with SessionLocal() as db:
            entity = db.get(models.Entity, int(entity_id))
            texts = self._get_entity_texts(db, int(entity_id))
            timestamps = self._get_entity_timestamps(db, int(entity_id))
            metadata = self._get_entity_metadata(db, int(entity_id), texts)
        tokens = [token.lower() for text in texts for token in TOKEN_RE.findall(text)]
        total = max(len(tokens), 1)
        top_words = [{"word": word, "share": round(count / total, 3)} for word, count in Counter(tokens).most_common(8)]
        behavior = self._behavioral_style(texts)
        return {
            "entity_id": int(entity_id),
            "label": entity.value_redacted if entity else f"entity-{entity_id}",
            "type": entity.type if entity else "unknown",
            "top_words": top_words,
            "temporal_pattern": self._temporal_pattern(timestamps),
            "behavior": {
                "avg_length": behavior[0],
                "emoji_rate": behavior[1],
                "price_rate": behavior[2],
                "caps_rate": behavior[3],
                "cta_rate": behavior[4],
                "avg_words": behavior[5],
            },
            "network_profile": metadata,
            "texts_analyzed": len(texts),
        }

    def component_similarity(self, source_entity_id: int, target_entity_id: int) -> dict[str, int]:
        with SessionLocal() as db:
            source_texts = self._get_entity_texts(db, source_entity_id)
            target_texts = self._get_entity_texts(db, target_entity_id)
            source_ts = self._get_entity_timestamps(db, source_entity_id)
            target_ts = self._get_entity_timestamps(db, target_entity_id)
            source_meta = self._get_entity_metadata(db, source_entity_id, source_texts)
            target_meta = self._get_entity_metadata(db, target_entity_id, target_texts)
        components = {
            "lexical": self._cosine(self._lexical_profile(source_texts), self._lexical_profile(target_texts)),
            "temporal": self._cosine(self._temporal_pattern(source_ts), self._temporal_pattern(target_ts)),
            "behavior": self._cosine(self._behavioral_style(source_texts), self._behavioral_style(target_texts)),
            "network": self._cosine(self._network_profile(source_meta), self._network_profile(target_meta)),
            "topics": self._cosine(self._topic_vector(source_texts), self._topic_vector(target_texts)),
        }
        return {key: int(round(max(0.0, min(score, 1.0)) * 100)) for key, score in components.items()}

    def _get_entity_texts(self, db: Session, entity_id: int) -> list[str]:
        links = db.scalars(select(models.ItemEntity).where(models.ItemEntity.entity_id == entity_id)).all()
        item_ids = [link.item_id for link in links]
        texts: list[str] = []
        if item_ids:
            items = db.scalars(select(models.RawItem).where(models.RawItem.id.in_(item_ids))).all()
            for item in items:
                text = item.raw_text_redacted or item.raw_text[:4000]
                if text:
                    texts.append(text)
            evidence = db.scalars(select(models.Evidence).where(models.Evidence.item_id.in_(item_ids))).all()
            for row in evidence:
                if row.extracted_text_redacted:
                    texts.append(row.extracted_text_redacted)
        entity = db.get(models.Entity, entity_id)
        if entity and entity.value_redacted:
            texts.append(entity.value_redacted)
        return texts or [f"entity-{entity_id}"]

    def _get_entity_timestamps(self, db: Session, entity_id: int) -> list[datetime]:
        item_ids = [link.item_id for link in db.scalars(select(models.ItemEntity).where(models.ItemEntity.entity_id == entity_id)).all()]
        if not item_ids:
            entity = db.get(models.Entity, entity_id)
            return [entity.first_seen_at] if entity else []
        items = db.scalars(select(models.RawItem).where(models.RawItem.id.in_(item_ids))).all()
        return [item.published_at or item.captured_at for item in items if item.captured_at or item.published_at]

    def _get_entity_metadata(self, db: Session, entity_id: int, texts: list[str]) -> dict[str, Any]:
        entity = db.get(models.Entity, entity_id)
        combined = "\n".join(texts).lower()
        metadata = dict(entity.metadata_json or {}) if entity else {}
        value = (entity.normalized_value if entity else "") or ""
        metadata.setdefault("type", entity.type if entity else "unknown")
        if entity and entity.type == "phone":
            metadata["phone"] = value
        if entity and entity.type == "crypto_wallet":
            metadata["crypto_type"] = "eth" if value.startswith("0x") else "trx" if value.startswith("t") else "btc"
        if entity and entity.type in {"domain", "url"}:
            metadata["domain"] = value
        for city in KZ_CITIES:
            if city in combined or (entity and city in entity.value_redacted.lower()):
                metadata["city"] = city
                break
        metadata["payment_methods"] = [word for word in PAYMENT_WORDS if word in combined]
        return metadata

    def _lexical_profile(self, texts: list[str]) -> list[float]:
        tokens = [token.lower() for text in texts for token in TOKEN_RE.findall(text)]
        if not tokens:
            return [0.0] * 100
        counts = Counter(tokens)
        total = float(sum(counts.values()))
        vector = [0.0] * 100
        for token, count in counts.items():
            vector[_hash_bucket(token, 100)] += count / total
        return _normalize(vector)

    def _temporal_pattern(self, timestamps: list[datetime]) -> list[float]:
        hist = [0.0] * 24
        for ts in timestamps:
            if ts:
                hist[ts.hour] += 1.0
        total = sum(hist)
        return [value / total for value in hist] if total > 0 else hist

    def _behavioral_style(self, texts: list[str]) -> list[float]:
        if not texts:
            return [0.0] * 6
        avg_len = min(sum(len(text) for text in texts) / len(texts) / 500.0, 1.0)
        emoji_rate = sum(1 for text in texts if EMOJI_RE.search(text)) / len(texts)
        price_rate = sum(1 for text in texts if PRICE_RE.search(text)) / len(texts)
        caps_rate = sum(sum(1 for char in text if char.isupper()) / max(len(text), 1) for text in texts) / len(texts)
        cta_rate = sum(1 for text in texts if any(word in text.lower() for word in CTA_WORDS)) / len(texts)
        avg_words = min(sum(len(text.split()) for text in texts) / len(texts) / 100.0, 1.0)
        return [avg_len, emoji_rate, price_rate, min(caps_rate, 1.0), cta_rate, avg_words]

    def _network_profile(self, metadata: dict[str, Any]) -> list[float]:
        phone_prefixes = ["701", "702", "705", "707", "777", "778", "771"]
        crypto_types = ["btc", "eth", "usdt", "trx"]
        cities = ["алматы", "астана", "шымкент"]
        vector = [0.0] * 16
        phone = str(metadata.get("phone", ""))
        matched = False
        for index, prefix in enumerate(phone_prefixes):
            if phone.startswith("+7" + prefix) or phone.startswith(prefix):
                vector[index] = 1.0
                matched = True
                break
        if phone and not matched:
            vector[7] = 1.0
        crypto = str(metadata.get("crypto_type", "")).lower()
        vector[8 + (crypto_types.index(crypto) if crypto in crypto_types else 4)] = 1.0 if crypto else 0.0
        city = str(metadata.get("city", "")).lower()
        vector[13 + (cities.index(city) if city in cities else 3)] = 1.0 if city else 0.0
        return vector

    def _topic_vector(self, texts: list[str]) -> list[float]:
        global _TOPIC_MODEL
        combined = " ".join(texts[:10])[:512]
        if not combined:
            return [0.0] * 384
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            if _TOPIC_MODEL is None:
                _TOPIC_MODEL = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
            encoded = _TOPIC_MODEL.encode(combined, normalize_embeddings=True)
            values = _to_float_list(encoded)
            return values[:384] + [0.0] * max(0, 384 - len(values))
        except Exception:
            vector = [0.0] * 384
            for token in TOKEN_RE.findall(combined.lower()):
                vector[_hash_bucket(token, 384)] += 1.0
            return _normalize(vector)

    def _cosine(self, left: list[float], right: list[float]) -> float:
        size = min(len(left), len(right))
        if size == 0:
            return 0.0
        dot = sum(left[i] * right[i] for i in range(size))
        left_norm = math.sqrt(sum(v * v for v in left[:size]))
        right_norm = math.sqrt(sum(v * v for v in right[:size]))
        return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0
