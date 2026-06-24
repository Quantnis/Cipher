from __future__ import annotations

from datetime import datetime
import hashlib
import math
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.database import SessionLocal

COLLECTION_NAME = "entity_fingerprints"


def hash_to_int(entity_id: str | int) -> int:
    return int(hashlib.md5(str(entity_id).encode("utf-8")).hexdigest(), 16) % (2**63)


def cosine(left: list[float], right: list[float]) -> float:
    size = min(len(left), len(right))
    if size == 0:
        return 0.0
    dot = sum(left[i] * right[i] for i in range(size))
    left_norm = math.sqrt(sum(v * v for v in left[:size]))
    right_norm = math.sqrt(sum(v * v for v in right[:size]))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0


class FingerprintStore:
    def __init__(self) -> None:
        self._client: Any | None = None
        self._qdrant_ready = False
        self._init_qdrant()

    def _init_qdrant(self) -> None:
        try:
            from qdrant_client import QdrantClient  # type: ignore
            from qdrant_client.http.models import Distance, VectorParams  # type: ignore
            client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port, timeout=2)
            names = {collection.name for collection in client.get_collections().collections}
            if COLLECTION_NAME not in names:
                client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=530, distance=Distance.COSINE),
                )
            self._client = client
            self._qdrant_ready = True
        except Exception:
            self._client = None
            self._qdrant_ready = False

    @property
    def backend(self) -> str:
        return "qdrant" if self._qdrant_ready else "sql_fallback"

    def upsert_fingerprint(self, entity_id: int | str, fingerprint: list[float], metadata: dict[str, Any] | None = None) -> None:
        metadata = metadata or {}
        payload = {
            "entity_id": str(entity_id),
            "entity_type": metadata.get("type"),
            "category": metadata.get("category"),
            "created_at": datetime.utcnow().isoformat(),
            "source_count": metadata.get("source_count", 1),
        }
        if self._qdrant_ready and self._client is not None:
            try:
                from qdrant_client.http.models import PointStruct  # type: ignore
                self._client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=[PointStruct(id=hash_to_int(entity_id), vector=fingerprint, payload=payload)],
                )
            except Exception:
                self._qdrant_ready = False
        with SessionLocal() as db:
            row = db.scalar(select(models.EntityFingerprint).where(models.EntityFingerprint.entity_id == int(entity_id)))
            if row:
                row.vector_json = fingerprint
                row.metadata_json = payload
                row.updated_at = datetime.utcnow()
            else:
                db.add(models.EntityFingerprint(entity_id=int(entity_id), vector_json=fingerprint, metadata_json=payload))
            db.commit()

    def find_similar(self, fingerprint: list[float], exclude_entity_id: int | str, threshold: float | None = None, top_k: int | None = None) -> list[dict[str, Any]]:
        threshold = threshold if threshold is not None else settings.fingerprint_similarity_threshold
        top_k = top_k if top_k is not None else settings.fingerprint_top_k
        if self._qdrant_ready and self._client is not None:
            try:
                results = self._client.search(
                    collection_name=COLLECTION_NAME,
                    query_vector=fingerprint,
                    limit=top_k + 1,
                    score_threshold=threshold,
                    with_payload=True,
                )
                matches: list[dict[str, Any]] = []
                for result in results:
                    payload = result.payload or {}
                    entity_id = str(payload.get("entity_id"))
                    if entity_id == str(exclude_entity_id):
                        continue
                    matches.append({
                        "entity_id": int(entity_id),
                        "score": round(float(result.score), 4),
                        "entity_type": payload.get("entity_type"),
                        "confidence_pct": int(float(result.score) * 100),
                    })
                return matches[:top_k]
            except Exception:
                self._qdrant_ready = False
        return self._find_similar_sql(fingerprint, int(exclude_entity_id), threshold, top_k)

    def _find_similar_sql(self, fingerprint: list[float], exclude_entity_id: int, threshold: float, top_k: int) -> list[dict[str, Any]]:
        with SessionLocal() as db:
            rows = db.scalars(select(models.EntityFingerprint).where(models.EntityFingerprint.entity_id != exclude_entity_id)).all()
            matches: list[dict[str, Any]] = []
            for row in rows:
                score = cosine(fingerprint, [float(v) for v in (row.vector_json or [])])
                if score < threshold:
                    continue
                entity = db.get(models.Entity, row.entity_id)
                matches.append({
                    "entity_id": row.entity_id,
                    "score": round(score, 4),
                    "entity_type": entity.type if entity else row.metadata_json.get("entity_type"),
                    "confidence_pct": int(score * 100),
                })
            matches.sort(key=lambda item: item["score"], reverse=True)
            return matches[:top_k]
