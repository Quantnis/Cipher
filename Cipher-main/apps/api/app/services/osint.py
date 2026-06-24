from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import re
import socket
import ssl
import urllib.parse
import urllib.request

from app.config import settings
from app.services.repository import repo

USER_AGENT = "ShadowGraphKZBot/1.0 authorized-osint"
KZ_LEAKS = {
    "+77001234567": [
        {"name": "Kolesa.kz exposure sample", "date": "2022-09-14", "data_classes": ["phone", "city", "vehicle listing metadata"]},
        {"name": "2GIS business contact dump sample", "date": "2021-04-02", "data_classes": ["phone", "name", "business category"]},
    ],
    "+77771234567": [
        {"name": "Kaspi marketplace phishing list sample", "date": "2023-11-08", "data_classes": ["phone", "messenger handle", "city"]}
    ],
}


def _json_get(url: str, headers: dict[str, str] | None = None) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=18, context=ssl.create_default_context()) as response:
        return json.loads(response.read(2_000_000).decode("utf-8", errors="replace"))


def _audit(action: str, metadata: dict) -> None:
    repo.log(action, "osint", None, metadata)


def detect_chain(address: str, requested: str | None = None) -> str:
    if requested and requested != "auto":
        return requested
    value = address.strip()
    if value.startswith("0x") and len(value) == 42:
        return "ethereum"
    if value.startswith("T") and 30 <= len(value) <= 36:
        return "tron"
    return "bitcoin"


def crypto_tracker(address: str, chain: str | None = None) -> dict:
    chain_name = detect_chain(address, chain)
    url = f"https://api.blockchair.com/{chain_name}/dashboards/address/{urllib.parse.quote(address)}"
    _audit("osint.crypto_tracker", {"chain": chain_name, "address_hash": hashlib.sha256(address.encode()).hexdigest()})
    try:
        payload = _json_get(url)
        data = payload.get("data", {}).get(address, {})
        address_info = data.get("address", {}) if isinstance(data, dict) else {}
        txs = data.get("transactions", []) if isinstance(data, dict) else []
        tx_count = int(address_info.get("transaction_count") or address_info.get("transactions") or len(txs) or 0)
        balance_raw = address_info.get("balance") or address_info.get("balance_usd") or 0
        risk_tags: list[str] = []
        if tx_count > 50:
            risk_tags.append("high transaction velocity")
        if _looks_round_amount(balance_raw):
            risk_tags.append("round amount pattern")
        if not risk_tags:
            risk_tags.append("no automated risk tag")
        connected = [str(tx) for tx in txs[:8]]
        risk_score = min(95, 25 + (35 if tx_count > 50 else 0) + (20 if "round amount pattern" in risk_tags else 0) + min(15, tx_count // 25))
        return {
            "address": address,
            "chain": chain_name,
            "balance": balance_raw,
            "tx_count": tx_count,
            "risk_score": risk_score,
            "risk_tags": risk_tags,
            "connected_wallets": connected,
            "provider": "blockchair",
            "source_url": url,
        }
    except Exception as exc:
        return {
            "address": address,
            "chain": chain_name,
            "balance": 0,
            "tx_count": 0,
            "risk_score": 35,
            "risk_tags": ["provider unavailable", "manual analyst review required"],
            "connected_wallets": [],
            "provider": "blockchair",
            "error": str(exc),
            "source_url": url,
        }


def _looks_round_amount(value: object) -> bool:
    try:
        number = int(float(value))
    except Exception:
        return False
    if number <= 0:
        return False
    return number % 10_000 == 0 or number % 100_000 == 0


def leak_scanner(indicator: str) -> dict:
    normalized = indicator.strip().lower()
    _audit("osint.leak_scanner", {"indicator_hash": hashlib.sha256(normalized.encode()).hexdigest()})
    if normalized.startswith("+7") or normalized.startswith("8"):
        phone = normalized.replace(" ", "").replace("-", "")
        if phone.startswith("8"):
            phone = "+7" + phone[1:]
        breaches = KZ_LEAKS.get(phone, [])
        return {"indicator_type": "phone", "indicator_redacted": phone[:4] + "***" + phone[-2:], "breaches": breaches, "provider": "internal_kz_mock_db"}
    if not settings.hibp_api_key:
        return {"indicator_type": "email", "indicator_redacted": _redact_email(normalized), "breaches": [], "provider": "hibp", "setup_required": "Set HIBP_API_KEY to query HaveIBeenPwned v3."}
    url = "https://haveibeenpwned.com/api/v3/breachedaccount/" + urllib.parse.quote(normalized) + "?truncateResponse=false"
    try:
        payload = _json_get(url, {"hibp-api-key": settings.hibp_api_key})
        breaches = [
            {"name": item.get("Name"), "date": item.get("BreachDate"), "data_classes": item.get("DataClasses", [])}
            for item in payload
        ] if isinstance(payload, list) else []
        return {"indicator_type": "email", "indicator_redacted": _redact_email(normalized), "breaches": breaches, "provider": "hibp"}
    except Exception as exc:
        return {"indicator_type": "email", "indicator_redacted": _redact_email(normalized), "breaches": [], "provider": "hibp", "error": str(exc)}


def _redact_email(email: str) -> str:
    if "@" not in email:
        return "***"
    left, right = email.split("@", 1)
    return f"{left[:2]}***@{right}"


def domain_intel(target: str) -> dict:
    parsed = urllib.parse.urlparse(target if "://" in target else f"https://{target}")
    domain = parsed.hostname or target.strip().split("/")[0]
    _audit("osint.domain_intel", {"domain": domain})
    ips = sorted({item[4][0] for item in socket.getaddrinfo(domain, None, proto=socket.IPPROTO_TCP)}) if domain else []
    rdap: dict = {}
    try:
        rdap = _json_get("https://rdap.org/domain/" + urllib.parse.quote(domain))
    except Exception as exc:
        rdap = {"error": str(exc)}
    events = rdap.get("events", []) if isinstance(rdap, dict) else []
    created = next((event.get("eventDate") for event in events if event.get("eventAction") in {"registration", "registered"}), None)
    nameservers = [ns.get("ldhName") for ns in rdap.get("nameservers", []) if ns.get("ldhName")] if isinstance(rdap, dict) else []
    registrar = "unknown"
    for entity in rdap.get("entities", []) if isinstance(rdap, dict) else []:
      if "registrar" in entity.get("roles", []):
        registrar = entity.get("vcardArray", [None, []])[1][0][3] if entity.get("vcardArray") else entity.get("handle", "unknown")
        break
    risk_indicators = []
    if not created:
        risk_indicators.append("missing creation date")
    if len(ips) > 8:
        risk_indicators.append("many resolved IPs")
    if any(domain.endswith(tld) for tld in [".top", ".xyz", ".click"]):
        risk_indicators.append("high-abuse TLD")
    return {"domain": domain, "registrar": registrar, "creation_date": created, "ips": ips, "nameservers": nameservers, "risk_indicators": risk_indicators or ["no automated indicator"], "screenshot_available": False, "provider": "rdap_dns_backend"}


def social_scanner(query: str) -> dict:
    keywords = [part.lower() for part in re.split(r"[,\s]+", query.strip()) if part]
    _audit("osint.social_scanner", {"query_hash": hashlib.sha256(query.encode()).hexdigest()})
    matches: list[dict] = []
    if settings.tg_bot_token:
        try:
            payload = _json_get(f"https://api.telegram.org/bot{settings.tg_bot_token}/getUpdates")
            for update in payload.get("result", [])[-100:]:
                message = update.get("channel_post") or update.get("message") or {}
                text = message.get("text") or message.get("caption") or ""
                lower = text.lower()
                if keywords and not any(k in lower for k in keywords):
                    continue
                chat = message.get("chat", {})
                matches.append({"channel": chat.get("username") or chat.get("title") or "telegram", "timestamp": message.get("date"), "text_redacted": _redact_social(text), "entities": _extract_light_entities(text)})
        except Exception as exc:
            matches.append({"channel": "telegram", "timestamp": None, "text_redacted": f"Telegram Bot API unavailable: {exc}", "entities": []})
    else:
        matches.append({"channel": "setup", "timestamp": None, "text_redacted": "Set TG_BOT_TOKEN and add the bot to public analyst-approved channels to scan updates.", "entities": []})
    return {"query": query, "matches": matches[:25], "provider": "telegram_bot_getUpdates"}


def _redact_social(text: str) -> str:
    text = re.sub(r"\+?7\d{10}", "+7***REDACTED", text)
    text = re.sub(r"[\w.+-]+@[\w.-]+", "email***redacted", text)
    return text[:600]


def _extract_light_entities(text: str) -> list[str]:
    entities = []
    entities.extend(re.findall(r"@[\w_]{4,}", text))
    entities.extend(re.findall(r"0x[a-fA-F0-9]{8,}", text))
    entities.extend(re.findall(r"\+?7\d{10}", text))
    return entities[:10]
