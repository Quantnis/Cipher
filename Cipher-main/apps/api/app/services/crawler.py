from __future__ import annotations

from datetime import datetime
from html.parser import HTMLParser
import hashlib
import json
import socket
import ssl
import xml.etree.ElementTree as ET
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.services.nlp import CategoryClassifier, EntityExtractor, LanguageDetector, redact_text
from app.services.risk import RiskInput, RiskScoringEngine
from app.services.repository import severity_from_score


COLLECTOR_VERSION = "shadowgraph-collector-v1"


def _snippet(text: str, value: str, radius: int = 120) -> str:
    lowered = text.lower()
    needle = value.lower()
    index = lowered.find(needle)
    if index < 0:
        return text[: radius * 2]
    start = max(0, index - radius)
    end = min(len(text), index + len(value) + radius)
    return text[start:end]


class AllowlistError(ValueError):
    pass


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.skip = False
        self.parts: list[str] = []
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "noscript"}:
            self.skip = True
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"}:
            self.skip = False
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        cleaned = " ".join(data.split())
        if not cleaned:
            return
        if self.in_title:
            self.title = cleaned[:240]
        if not self.skip:
            self.parts.append(cleaned)

    def text(self) -> str:
        return "\n".join(self.parts)


class CollectionPipeline:
    def __init__(self) -> None:
        self.language = LanguageDetector()
        self.extractor = EntityExtractor()
        self.classifier = CategoryClassifier()
        self.risk = RiskScoringEngine()

    def ingest_text(self, db: Session, *, source: models.Source | None, platform: str, source_url: str, title: str, raw_text: str, metadata: dict | None = None) -> tuple[models.RawItem, list[models.Entity], dict]:
        content_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
        existing = db.scalar(select(models.RawItem).where(models.RawItem.source_id == (source.id if source else None), models.RawItem.content_hash == content_hash))
        if existing:
            return existing, [], {"score": existing.risk_score, "confidence": existing.confidence, "reasons": ["Duplicate content hash already stored"], "components": {}}

        classification = self.classifier.classify(raw_text)
        extracted = self.extractor.extract(raw_text)
        risk = self.risk.score(
            RiskInput(
                category=classification["category"],
                text=raw_text,
                entity_count=len(extracted),
                source_reliability=8 if source and source.legal_basis_note else 5,
                confidence=classification["confidence"],
            )
        )
        item = models.RawItem(
            source_id=source.id if source else None,
            platform=platform,
            source_url=source_url,
            title=title[:250] if title else source_url[:250],
            raw_text=raw_text,
            raw_text_redacted=redact_text(raw_text[:4000]),
            language=self.language.detect(raw_text),
            captured_at=datetime.utcnow(),
            content_hash=content_hash,
            risk_category=classification["category"],
            risk_score=risk["score"],
            confidence=risk["confidence"],
            is_flagged=risk["score"] >= 40,
            metadata_json={**(metadata or {}), "collector_version": COLLECTOR_VERSION, "classifier_signals": classification["signals"]},
        )
        db.add(item)
        db.flush()

        metadata_payload = metadata or {}
        document = db.scalar(select(models.Document).where(models.Document.raw_item_id == item.id))
        if not document:
            document = models.Document(
                raw_item_id=item.id,
                investigation_id=metadata_payload.get("investigation_id"),
                source_id=source.id if source else None,
                source_type=platform,
                source_name=source.name if source else metadata_payload.get("sourceName", platform),
                source_url=source_url,
                title=item.title,
                content_hash=content_hash,
                language=item.language,
                published_at=item.published_at,
                collected_at=item.captured_at,
                metadata_json={"evidence_hash": content_hash, **metadata_payload},
            )
            db.add(document)
            db.flush()

        saved_entities: list[models.Entity] = []
        for entity in extracted:
            row = db.scalar(select(models.Entity).where(models.Entity.type == entity["type"], models.Entity.normalized_value == entity["normalized_value"]))
            if row:
                row.last_seen_at = datetime.utcnow()
                row.risk_score = max(row.risk_score, risk["score"])
            else:
                row = models.Entity(
                    type=entity["type"],
                    value=entity["value"],
                    value_hash=entity["value_hash"],
                    value_redacted=entity["value_redacted"],
                    normalized_value=entity["normalized_value"],
                    risk_score=risk["score"],
                    metadata_json=entity.get("metadata", {}),
                )
                db.add(row)
                db.flush()
            db.merge(models.ItemEntity(item_id=item.id, entity_id=row.id, confidence=entity["confidence"], extraction_method=entity["extraction_method"]))
            db.merge(models.DocumentEntity(document_id=document.id, entity_id=row.id, confidence=entity["confidence"], context_snippet=_snippet(raw_text, entity["value"])))
            saved_entities.append(row)
            if entity["type"] in {"location", "city"}:
                db.add(models.Location(city=entity["value_redacted"], latitude=entity["metadata"].get("latitude"), longitude=entity["metadata"].get("longitude"), item_id=item.id, risk_score=risk["score"], category=classification["category"]))
            if entity["type"] in {"wallet", "crypto_wallet"}:
                chain = "eth" if entity["normalized_value"].startswith("0x") else "tron" if entity["normalized_value"].startswith("t") else "btc"
                if not db.scalar(select(models.CryptoWallet).where(models.CryptoWallet.address == entity["value"])):
                    db.add(models.CryptoWallet(address=entity["value"], chain=chain, evidence_item_id=item.id))
        db.add(models.RiskScore(item_id=item.id, score=risk["score"], category=classification["category"], reasons=risk["reasons"], evidence={"source_url": source_url, "content_hash": content_hash}, confidence=risk["confidence"], model_version=risk["model_version"]))
        db.add(models.Classification(document_id=document.id, category=classification["category"], confidence=classification["confidence"], severity=risk["level"], summary=f"Automated classification for {classification['category']}.", risk_signals=classification["signals"], reasoning=risk["reasons"], recommended_next_steps=["Verify source attribution", "Review extracted entities", "Open graph neighborhood"], provider="rules"))
        db.add(models.Evidence(item_id=item.id, evidence_type="text_snapshot", sha256_hash=content_hash, extracted_text_redacted=item.raw_text_redacted[:1200], source_url=source_url, collector_version=COLLECTOR_VERSION))
        alert = None
        if item.is_flagged:
            primary = saved_entities[0].id if saved_entities else None
            alert = models.Alert(
                title=f"{classification['category'].replace('_', ' ').title()} indicator",
                description="Automated indicator from configured public source. Requires analyst verification.",
                severity=severity_from_score(risk["score"]),
                category=classification["category"],
                risk_score=risk["score"],
                confidence=risk["confidence"],
                source_id=source.id if source else None,
                item_id=item.id,
                primary_entity_id=primary,
                reason_summary="; ".join(risk["reasons"]),
            )
            db.add(alert)
            db.flush()
        db.add(models.RiskSignal(
            investigation_id=metadata_payload.get("investigation_id"),
            document_id=document.id,
            alert_id=alert.id if alert else None,
            category=classification["category"],
            risk_score=risk["score"],
            risk_level=risk["level"],
            title=item.title,
            snippet=item.raw_text_redacted[:500],
            source_type=platform,
            key_entities=[{"id": entity.id, "type": entity.type, "value_redacted": entity.value_redacted} for entity in saved_entities[:10]],
            risk_factors=risk.get("factors", []),
        ))
        if source:
            source.items_collected_count += 1
            source.last_sync_status = "completed"
            source.last_crawled_at = datetime.utcnow()
        db.commit()
        if settings.fingerprint_auto_analyze and saved_entities:
            try:
                from app.routers.fingerprint import analyze_entity_fingerprint
                for entity in saved_entities[:8]:
                    analyze_entity_fingerprint(entity.id)
            except Exception:
                pass
        return item, saved_entities, risk


class PublicWebCollector:
    def fetch(self, url: str) -> tuple[str, str, dict]:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise AllowlistError("Only http/https public web URLs can use the web collector.")
        robot_url = urllib.parse.urljoin(f"{parsed.scheme}://{parsed.netloc}", "/robots.txt")
        robots = urllib.robotparser.RobotFileParser(robot_url)
        try:
            robots.read()
            if not robots.can_fetch("ShadowGraphKZBot", url):
                raise AllowlistError("robots.txt disallows collection for this URL.")
        except urllib.error.URLError:
            pass
        socket.setdefaulttimeout(12)
        request = urllib.request.Request(url, headers={"User-Agent": "ShadowGraphKZBot/1.0 authorized-osint"})
        with urllib.request.urlopen(request, timeout=12) as response:
            body = response.read(1_500_000).decode(response.headers.get_content_charset() or "utf-8", errors="replace")
        parser = TextExtractor()
        parser.feed(body)
        return parser.title or parsed.netloc, parser.text()[:100_000], {"final_url": response.geturl(), "content_type": response.headers.get("content-type")}


def _fetch_json(url: str, headers: dict[str, str] | None = None) -> dict:
    request = urllib.request.Request(url, headers=headers or {"User-Agent": "ShadowGraphKZBot/1.0 authorized-osint"})
    with urllib.request.urlopen(request, timeout=15, context=ssl.create_default_context()) as response:
        return json.loads(response.read(1_500_000).decode("utf-8", errors="replace"))


class SearchCollector:
    def run(self, db: Session, source: models.Source) -> dict:
        if not (settings.search_api_provider and settings.search_api_key):
            return {"status": "not_configured", "message": "Search API not configured. Set SEARCH_API_PROVIDER and SEARCH_API_KEY."}
        provider = settings.search_api_provider.lower()
        query = source.url_or_identifier
        results: list[dict] = []
        if provider == "bing":
            url = "https://api.bing.microsoft.com/v7.0/search?" + urllib.parse.urlencode({"q": query, "count": 10, "mkt": "ru-KZ"})
            payload = _fetch_json(url, {"Ocp-Apim-Subscription-Key": settings.search_api_key, "User-Agent": "ShadowGraphKZBot/1.0 authorized-osint"})
            results = payload.get("webPages", {}).get("value", [])
        elif provider == "serpapi":
            url = "https://serpapi.com/search.json?" + urllib.parse.urlencode({"q": query, "api_key": settings.search_api_key, "num": 10})
            payload = _fetch_json(url)
            results = payload.get("organic_results", [])
        elif provider == "google":
            if not settings.search_engine_id:
                return {"status": "not_configured", "message": "Google Programmable Search requires SEARCH_ENGINE_ID."}
            url = "https://www.googleapis.com/customsearch/v1?" + urllib.parse.urlencode({"q": query, "key": settings.search_api_key, "cx": settings.search_engine_id, "num": 10})
            payload = _fetch_json(url)
            results = payload.get("items", [])
        else:
            return {"status": "unsupported", "message": f"Unsupported SEARCH_API_PROVIDER '{settings.search_api_provider}'."}

        pipeline = CollectionPipeline()
        collected = 0
        for result in results:
            link = result.get("link") or result.get("url")
            title = result.get("title") or result.get("name") or query
            snippet = result.get("snippet") or result.get("description") or ""
            if not link or not snippet:
                continue
            pipeline.ingest_text(db, source=source, platform="search", source_url=link, title=title, raw_text=f"{title}\n{snippet}", metadata={"query": query, "search_provider": provider})
            collected += 1
        return {"status": "completed", "items_collected_count": collected, "message": f"Collected {collected} public search result snippets."}


class RssFeedCollector:
    def run(self, db: Session, source: models.Source) -> dict:
        parsed = urllib.parse.urlparse(source.url_or_identifier)
        if parsed.scheme not in {"http", "https"}:
            raise AllowlistError("Only http/https public feeds are supported.")
        request = urllib.request.Request(source.url_or_identifier, headers={"User-Agent": "ShadowGraphKZBot/1.0 authorized-osint"})
        with urllib.request.urlopen(request, timeout=15) as response:
            xml_text = response.read(2_000_000).decode(response.headers.get_content_charset() or "utf-8", errors="replace")
            metadata = {"final_url": response.geturl(), "content_type": response.headers.get("content-type")}
        root = ET.fromstring(xml_text.encode("utf-8"))
        title = root.findtext(".//title") or parsed.netloc
        items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
        pipeline = CollectionPipeline()
        collected = 0
        for entry in items[:25]:
            entry_title = "".join(entry.findtext("title") or "").strip() or title
            link = entry.findtext("link") or source.url_or_identifier
            description = entry.findtext("description") or entry.findtext("summary") or entry.findtext("{http://www.w3.org/2005/Atom}summary") or ""
            if not description and not entry_title:
                continue
            pipeline.ingest_text(db, source=source, platform="threat_feed", source_url=link, title=entry_title, raw_text=f"{entry_title}\n{description}", metadata={**metadata, "feed_url": source.url_or_identifier})
            collected += 1
        return {"status": "completed", "items_collected_count": collected, "message": f"Collected {collected} public feed entries."}


class OnionCollector:
    def run(self, db: Session, source: models.Source) -> dict:
        if not settings.tor_proxy_url:
            return {"status": "not_configured", "message": "DarkNet adapter not configured. Set TOR_PROXY_URL for analyst-provided open onion URLs only."}
        if not source.legal_basis_note:
            return {"status": "blocked", "message": "Analyst-provided onion sources require a legal basis note."}
        parsed = urllib.parse.urlparse(source.url_or_identifier)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or not parsed.hostname.endswith(".onion"):
            return {"status": "blocked", "message": "DarkNet collector only accepts analyst-provided http(s) .onion URLs."}
        try:
            import requests  # type: ignore
        except ImportError:
            return {"status": "dependency_missing", "message": "Install requests[socks] to enable TOR_PROXY_URL SOCKS collection."}
        response = requests.get(
            source.url_or_identifier,
            proxies={"http": settings.tor_proxy_url, "https": settings.tor_proxy_url},
            timeout=20,
            headers={"User-Agent": "ShadowGraphKZBot/1.0 authorized-open-source"},
        )
        response.raise_for_status()
        parser = TextExtractor()
        parser.feed(response.text[:1_500_000])
        item, entities, risk = CollectionPipeline().ingest_text(db, source=source, platform="darknet", source_url=source.url_or_identifier, title=parser.title or parsed.hostname, raw_text=parser.text()[:100_000], metadata={"tor_proxy": "configured", "compliance": "public open onion text only; no login, purchase, captcha bypass, or harmful file download"})
        return {"status": "completed", "item_id": item.id, "entities": len(entities), "risk": risk}


class BlockchainCollector:
    def run(self, db: Session, source: models.Source) -> dict:
        wallet = source.url_or_identifier.strip()
        if not (settings.etherscan_api_key or settings.tronscan_api_key or settings.blockchain_provider):
            return {"status": "not_configured", "message": "Blockchain provider not configured. Wallet evidence can still be extracted from ingested text."}
        chain = "eth" if wallet.startswith("0x") else "tron" if wallet.startswith("T") else "btc"
        metadata: dict = {"chain": chain, "wallet": wallet, "provider": settings.blockchain_provider or "public_api"}
        try:
            if chain == "eth" and settings.etherscan_api_key:
                url = "https://api.etherscan.io/api?" + urllib.parse.urlencode({"module": "account", "action": "txlist", "address": wallet, "page": 1, "offset": 10, "sort": "desc", "apikey": settings.etherscan_api_key})
                payload = _fetch_json(url)
                txs = payload.get("result", []) if isinstance(payload.get("result"), list) else []
                metadata.update({"transaction_count_sample": len(txs), "latest_transactions": txs[:3]})
            elif chain == "tron" and settings.tronscan_api_key:
                url = "https://apilist.tronscanapi.com/api/transaction?" + urllib.parse.urlencode({"address": wallet, "limit": 10, "sort": "-timestamp"})
                payload = _fetch_json(url, {"TRON-PRO-API-KEY": settings.tronscan_api_key, "User-Agent": "ShadowGraphKZBot/1.0 authorized-osint"})
                txs = payload.get("data", [])
                metadata.update({"transaction_count_sample": len(txs), "latest_transactions": txs[:3]})
            else:
                metadata["note"] = "Provider configured, but no supported API key exists for this chain."
        except Exception as exc:
            return {"status": "failed", "message": f"Blockchain provider request failed: {exc}"}
        text = f"Analyst-configured public blockchain wallet indicator: {wallet}\nChain: {chain}\nTransaction sample count: {metadata.get('transaction_count_sample', 0)}"
        item, entities, risk = CollectionPipeline().ingest_text(db, source=source, platform="blockchain", source_url=f"blockchain://{chain}/{wallet}", title=f"{chain.upper()} wallet indicator", raw_text=text, metadata=metadata)
        return {"status": "completed", "item_id": item.id, "entities": len(entities), "risk": risk, "wallet": wallet, "chain": chain}

class TelegramBotCollector:
    def run(self, db: Session, source: models.Source) -> dict:
        if not settings.tg_bot_token:
            return {"status": "not_configured", "message": "Telegram monitor not configured. Set TG_BOT_TOKEN and add the bot to analyst-approved public channels."}
        from sqlalchemy import select
        terms = db.scalars(select(models.SlangTerm)).all()
        keywords = [term.term.lower() for term in terms] or ["вейп", "алкоголь", "дроп", "крипто"]
        try:
            payload = _fetch_json(f"https://api.telegram.org/bot{settings.tg_bot_token}/getUpdates")
        except Exception as exc:
            return {"status": "failed", "message": f"Telegram Bot API request failed: {exc}"}
        target = source.url_or_identifier.lower().replace("https://t.me/", "").replace("@", "").strip("/")
        pipeline = CollectionPipeline()
        collected = 0
        for update in payload.get("result", [])[-100:]:
            message = update.get("channel_post") or update.get("message") or {}
            chat = message.get("chat", {})
            username = str(chat.get("username") or chat.get("title") or "").lower()
            if target and target not in username and username not in target:
                continue
            text = message.get("text") or message.get("caption") or ""
            if not text or not any(keyword in text.lower() for keyword in keywords):
                continue
            title = f"Telegram public channel match: {chat.get('title') or username or source.name}"
            pipeline.ingest_text(db, source=source, platform="telegram", source_url=f"https://t.me/{username}" if username else source.url_or_identifier, title=title, raw_text=text, metadata={"telegram_update_id": update.get("update_id"), "keywords": keywords, "collector": "telegram_bot_getUpdates"})
            collected += 1
        source.last_sync_status = "completed" if collected else "no_matches"
        source.last_crawled_at = datetime.utcnow()
        db.commit()
        return {"status": "completed", "items_collected_count": collected, "message": f"Scanned Telegram bot updates and ingested {collected} matching public posts."}

class SourceCollector:
    def run(self, db: Session, source: models.Source) -> dict:
        if not source.enabled:
            return {"status": "skipped", "message": "Source is disabled."}
        job = models.CollectionJob(source_id=source.id, status="running", started_at=datetime.utcnow())
        db.add(job)
        db.commit()
        try:
            if source.type in {"web", "public_web"}:
                title, text, metadata = PublicWebCollector().fetch(source.url_or_identifier)
                item, entities, risk = CollectionPipeline().ingest_text(db, source=source, platform="web", source_url=source.url_or_identifier, title=title, raw_text=text, metadata=metadata)
                job.status = "completed"
                job.items_collected_count = 1
                job.finished_at = datetime.utcnow()
                db.commit()
                return {"status": "completed", "job_id": job.id, "item_id": item.id, "entities": len(entities), "risk": risk}
            if source.type in {"search", "keyword_search"}:
                result = SearchCollector().run(db, source)
                job.status = result["status"]
                job.items_collected_count = result.get("items_collected_count", 0)
                job.finished_at = datetime.utcnow()
                db.commit()
                return {**result, "job_id": job.id}
            if source.type in {"rss", "feed", "threat_feed"}:
                result = RssFeedCollector().run(db, source)
                job.status = result["status"]
                job.items_collected_count = result.get("items_collected_count", 0)
                job.finished_at = datetime.utcnow()
                db.commit()
                return {**result, "job_id": job.id}
            if source.type == "darknet":
                result = OnionCollector().run(db, source)
                job.status = result["status"]
                job.items_collected_count = 1 if result["status"] == "completed" else 0
                job.finished_at = datetime.utcnow()
                db.commit()
                return {**result, "job_id": job.id}
            if source.type == "blockchain":
                result = BlockchainCollector().run(db, source)
                job.status = result["status"]
                job.items_collected_count = 1 if result["status"] == "completed" else 0
                job.finished_at = datetime.utcnow()
                db.commit()
                return {**result, "job_id": job.id}
            if source.type == "manual_upload":
                return {"status": "ready", "message": "Use POST /api/items/manual to ingest analyst-provided text."}
            if source.type == "telegram":
                result = TelegramBotCollector().run(db, source)
                job.status = result["status"]
                job.items_collected_count = result.get("items_collected_count", 0)
                job.finished_at = datetime.utcnow()
                db.commit()
                return {**result, "job_id": job.id}
            return {"status": "unsupported", "message": f"Collector for {source.type} is not active."}
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            job.finished_at = datetime.utcnow()
            source.last_sync_status = "failed"
            db.commit()
            raise



