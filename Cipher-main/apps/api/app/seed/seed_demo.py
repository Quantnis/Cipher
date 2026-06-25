from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select

from app import models
from app.database import SessionLocal, init_db
from app.services.crawler import CollectionPipeline
from app.services.graph import GraphService
from app.services.repository import repo

ROOT_DIR = Path(__file__).resolve().parents[4]


def ensure_source(db, *, name: str, source_type: str, identifier: str) -> models.Source:
    source = db.scalar(select(models.Source).where(models.Source.url_or_identifier == identifier))
    if source:
        return source
    source = models.Source(
        name=name,
        type=source_type,
        url_or_identifier=identifier,
        enabled=True,
        legal_basis_note="Synthetic safe demo data generated locally for authorized MVP testing.",
        metadata_json={"synthetic_seed": True},
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def write_sample_files(records: list[dict]) -> None:
    buckets = {"web": [], "telegram": [], "darknet": []}
    for record in records:
        buckets[record["kind"]].append({k: v for k, v in record.items() if k != "kind"})
    for kind, items in buckets.items():
        folder = ROOT_DIR / "data" / f"{kind}_samples"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "synthetic_samples.json").write_text(json.dumps(items[:20], ensure_ascii=False, indent=2), encoding="utf-8")


def build_records() -> list[dict]:
    cities = ["Алматы", "Астана", "Шымкент", "Туркестан", "Караганда"]
    clusters = [
        {"category": "suspected_illicit_vape_sales", "handle": "@sample_vape_kz", "phone": "+77000000000", "wallet": "TQ7DemoWallet000000000000000001", "terms": "вейп delivery одноразка USDT TRC20"},
        {"category": "suspected_drop_account_recruitment", "handle": "@drop_alert_demo", "phone": "+77000000001", "wallet": "0x1111111111111111111111111111111111111111", "terms": "дроп карта перевод cashout"},
        {"category": "suspected_database_leak", "handle": "@leak_watch_kz", "phone": "+77000000002", "wallet": "bc1demoaddress000000000000000001", "terms": "база слив database ИИН"},
        {"category": "suspected_payment_fraud", "handle": "@pay_clone_demo", "phone": "+77000000003", "wallet": "TQ7DemoWallet000000000000000002", "terms": "фишинг clone credential kaspi"},
        {"category": "suspected_crypto_fraud", "handle": "@crypto_claims_kz", "phone": "+77000000004", "wallet": "0x2222222222222222222222222222222222222222", "terms": "crypto wallet USDT инвестиция"},
    ]
    records: list[dict] = []
    for index in range(100):
        cluster = clusters[index % len(clusters)]
        city = cities[index % len(cities)]
        kind = "web" if index < 40 else "telegram" if index < 75 else "darknet"
        source_url = (
            f"https://synthetic.local/public/{index + 1}"
            if kind == "web"
            else f"https://t.me/{cluster['handle'].lstrip('@')}/{5000 + index}"
            if kind == "telegram"
            else f"mock://onion/post/{index + 1}"
        )
        title = f"{kind.title()} demo signal {index + 1}: {cluster['category']}"
        content = (
            f"Synthetic public/authorized demo record for {cluster['category']}. "
            f"Mentions {cluster['handle']} phone {cluster['phone']} wallet {cluster['wallet']} location {city}. "
            f"Terms: {cluster['terms']}. This is non-operational mock evidence for analyst workflow testing only. "
            f"Alias user: demo_alias_{index % 9}. Contact email demo{index % 7}@example.kz."
        )
        records.append({"kind": kind, "title": title, "sourceUrl": source_url, "content": content, "metadata": {"cluster": index % len(clusters), "synthetic": True}})
    return records


def main() -> None:
    init_db()
    repo.ensure_defaults()
    records = build_records()
    write_sample_files(records)
    pipeline = CollectionPipeline()
    with SessionLocal() as db:
        sources = {
            "web": ensure_source(db, name="Synthetic public web dataset", source_type="web", identifier="connector://seed_web"),
            "telegram": ensure_source(db, name="Synthetic public Telegram dataset", source_type="telegram", identifier="connector://seed_telegram"),
            "darknet": ensure_source(db, name="Synthetic mock authorized darknet dataset", source_type="darknet_authorized", identifier="connector://seed_darknet"),
        }
        before = db.scalar(select(models.RawItem.id).order_by(models.RawItem.id.desc())) or 0
        for record in records:
            kind = record["kind"]
            pipeline.ingest_text(
                db,
                source=sources[kind],
                platform="darknet_authorized" if kind == "darknet" else kind,
                source_url=record["sourceUrl"],
                title=record["title"],
                raw_text=record["content"],
                metadata={"seed_demo": True, **record["metadata"]},
            )
        after = db.scalar(select(models.RawItem.id).order_by(models.RawItem.id.desc())) or before
    graph = GraphService().rebuild_persistent_graph()
    print(f"Seeded synthetic OSINT dataset: 100 records prepared, {max(0, after - before)} new raw items, graph={graph}.")
    print("Sample files written under data/web_samples, data/telegram_samples, and data/darknet_samples.")


if __name__ == "__main__":
    main()
