from sqlalchemy import select

from app import models
from app.config import settings
from app.database import SessionLocal, init_db
from app.services.crawler import CollectionPipeline
from app.services.graph import GraphService


def test_graph_builder_persists_document_entity_edges():
    settings.fingerprint_auto_analyze = False
    init_db()
    with SessionLocal() as db:
        source = models.Source(
            name="pytest synthetic source",
            type="web",
            url_or_identifier="pytest://graph-source",
            enabled=True,
            legal_basis_note="test source",
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        text = "pytest unique graph signal @pytest_handle +77009998877 wallet TQ7DemoWallet000000000000009999 Алматы vape delivery"
        item, entities, risk = CollectionPipeline().ingest_text(db, source=source, platform="web", source_url="pytest://graph-doc", title="pytest graph doc", raw_text=text, metadata={"pytest": True})
        assert item.id
        assert entities
        result = GraphService().rebuild_persistent_graph()
        assert result["nodes"] >= 2
        edge_types = set(db.scalars(select(models.GraphEdge.edge_type)).all())
        assert "DOCUMENT_MENTIONS_ENTITY" in edge_types
