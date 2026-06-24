from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_raw_items_source_captured ON raw_items (source_id, captured_at)",
        "CREATE INDEX IF NOT EXISTS ix_raw_items_score_category ON raw_items (risk_score, risk_category)",
        "CREATE INDEX IF NOT EXISTS ix_entities_type_value ON entities (type, normalized_value)",
        "CREATE INDEX IF NOT EXISTS ix_alerts_severity_created ON alerts (severity, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_locations_city_category ON locations (city, category)",
        "CREATE INDEX IF NOT EXISTS ix_graph_edges_nodes ON graph_edges (source_node_id, target_node_id)",
    ]
    with engine.begin() as connection:
        for statement in indexes:
            connection.execute(text(statement))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
