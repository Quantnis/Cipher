from __future__ import annotations

from datetime import datetime
import hashlib
import json
import time
from typing import Any

from app import models
from app.config import settings
from app.services.repository import repo, to_dict

SYSTEM_PROMPT = """Ты — старший аналитик по цифровой безопасности
Республики Казахстан. Ты пишешь официальные
аналитические записки для государственных органов.

Твой стиль: точный, профессиональный, без воды.
Структура мышления: от фактов к выводам.
Язык: русский, официально-деловой стиль.

Ты НИКОГДА не выдумываешь факты.
Ты работаешь ТОЛЬКО с данными которые тебе дали.
Если данных недостаточно — ты так и пишешь."""

USER_TEMPLATE = """На основе следующих данных разведки составь
аналитическую записку по форме ниже.

ДАННЫЕ КЕЙСА:
{context_json}

ОБЯЗАТЕЛЬНАЯ СТРУКТУРА ОТВЕТА (строго JSON):
{{
  "executive_summary": "2-3 предложения. Суть угрозы, масштаб, срочность. Без технических деталей.",
  "threat_narrative": "Связный текст 300-500 слов. Пиши как детектив: 'Анализ показал что субъект X использует канал Y для реализации схемы Z...' Объясняй СВЯЗИ между сущностями человеческим языком. Указывай временну́ю последовательность.",
  "entity_risk_table": [
    {{
      "entity": "название/значение сущности",
      "type": "тип (канал/кошелёк/телефон/город)",
      "risk_level": "ВЫСОКИЙ/СРЕДНИЙ/НИЗКИЙ",
      "risk_reason": "1 предложение почему такой риск",
      "connection_to_case": "как связан с основной схемой"
    }}
  ],
  "connection_analysis": "Текст 100-150 слов. Описывает граф связей человеческим языком.",
  "risk_assessment": {{
    "overall_score": <число от 0 до 100>,
    "confidence": <число от 0 до 100>,
    "risk_category": "КРИТИЧЕСКИЙ/ВЫСОКИЙ/СРЕДНИЙ/НИЗКИЙ",
    "risk_factors": ["фактор 1", "фактор 2", "фактор 3"]
  }},
  "recommended_actions": [
    {{
      "priority": "НЕМЕДЛЕННО/В ТЕЧЕНИЕ 24Ч/ПЛАНОВОЕ",
      "action": "конкретное действие",
      "responsible_body": "орган РК (ФСФР/КНБ/МВД/МЦРИАП)"
    }}
  ],
  "legal_note": "Текст 50-80 слов. Правовая основа для действий. Ссылка на статьи КоАП или УК РК применимые к данной категории угрозы.",
  "limitations": "Что система НЕ смогла проверить. Честно: 'Источник X требует ручной верификации.'"
}}"""

REQUIRED_KEYS = {
    "executive_summary",
    "threat_narrative",
    "entity_risk_table",
    "connection_analysis",
    "risk_assessment",
    "recommended_actions",
    "legal_note",
    "limitations",
}


def latest_narrative(case_id: int) -> dict | None:
    from sqlalchemy import desc, select

    with repo.session() as db:
        row = db.scalar(select(models.Narrative).where(models.Narrative.case_id == case_id).order_by(desc(models.Narrative.created_at)).limit(1))
        return to_dict(row) if row else None


def generate_narrative(context: dict[str, Any], case_id: int) -> dict[str, Any]:
    started = time.perf_counter()
    if not settings.openai_api_key or settings.openai_api_key == "sk-...":
        narrative = _fallback_narrative(context)
        return _persist(case_id, narrative, model="local-fallback", tokens_used=0, elapsed_ms=_elapsed(started), raw_response="")

    user_prompt = USER_TEMPLATE.format(context_json=json.dumps(context, ensure_ascii=False, indent=2))
    response_text = ""
    tokens_used = 0
    try:
        from openai import APITimeoutError, OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=settings.narrative_temperature,
            max_tokens=settings.narrative_max_tokens,
            timeout=30,
        )
        response_text = response.choices[0].message.content or "{}"
        tokens_used = int(getattr(response.usage, "total_tokens", 0) or 0)
    except Exception as exc:
        if exc.__class__.__name__ == "APITimeoutError":
            return {"error": "timeout", "message": "Попробуйте через 30 секунд"}
        return {"error": "openai_error", "message": str(exc)[:500]}

    try:
        narrative = json.loads(response_text)
        missing = REQUIRED_KEYS - set(narrative.keys())
        if missing:
            narrative = {**_fallback_narrative(context), **narrative, "limitations": f"Ответ модели не содержал обязательные поля: {', '.join(sorted(missing))}. Требуется ручная проверка."}
    except json.JSONDecodeError:
        repo.log("narrative.parse_error", "case", case_id, {"raw": response_text[:500]})
        return {"error": "parse_error", "raw": response_text[:500]}

    return _persist(case_id, narrative, model=settings.openai_model, tokens_used=tokens_used, elapsed_ms=_elapsed(started), raw_response=response_text)


def _persist(case_id: int, narrative: dict[str, Any], *, model: str, tokens_used: int, elapsed_ms: int, raw_response: str) -> dict[str, Any]:
    narrative["generated_at"] = datetime.utcnow().isoformat()
    narrative["generated_by"] = "GPT-4o / ShadowGraph KZ" if model != "local-fallback" else "Local Fallback / ShadowGraph KZ"
    narrative["case_id"] = case_id
    narrative["document_hash"] = hashlib.sha256(json.dumps(narrative, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    with repo.session() as db:
        row = models.Narrative(case_id=case_id, content_json=narrative, document_hash=narrative["document_hash"], model=model, tokens_used=tokens_used, generation_time_ms=elapsed_ms, raw_response=raw_response[:4000])
        db.add(row)
        db.commit()
        db.refresh(row)
    repo.log(
        "narrative.generate",
        "case",
        case_id,
        {
            "tokens_used": tokens_used,
            "model": model,
            "generation_time_ms": elapsed_ms,
            "document_hash": narrative["document_hash"],
        },
    )
    return narrative


def _fallback_narrative(context: dict[str, Any]) -> dict[str, Any]:
    alerts = context.get("alerts", [])
    entities = context.get("entities", [])
    categories = context.get("categories_detected", [])
    score = int(context.get("risk_score", 0) or 0)
    risk_category = "КРИТИЧЕСКИЙ" if score >= 85 else "ВЫСОКИЙ" if score >= 60 else "СРЕДНИЙ" if score >= 40 else "НИЗКИЙ"
    first_alert = alerts[0] if alerts else {}
    entity_rows = [
        {
            "entity": entity.get("value", "не указано"),
            "type": entity.get("type", "unknown"),
            "risk_level": "ВЫСОКИЙ" if "high_risk_entity" in entity.get("risk_tags", []) else "СРЕДНИЙ" if entity.get("risk_tags") else "НИЗКИЙ",
            "risk_reason": "Сущность связана с автоматическими индикаторами риска в материалах кейса.",
            "connection_to_case": "Обнаружена в алертах или графе связей данного кейса.",
        }
        for entity in entities[:12]
    ] or [{"entity": "Недостаточно данных", "type": "unknown", "risk_level": "НИЗКИЙ", "risk_reason": "Сущности не были приложены к кейсу.", "connection_to_case": "Требуется ручное добавление evidence."}]
    return {
        "executive_summary": f"По кейсу {context.get('case_id')} обнаружены индикаторы категорий: {', '.join(categories) or 'не указаны'}. Общая оценка риска составляет {score}/100, требуется аналитическая верификация источников и связей.",
        "threat_narrative": f"Анализ показал, что материалы кейса формируют последовательность связанных цифровых индикаторов. Первичный сигнал относится к категории {first_alert.get('category', 'unknown')} и сопровождается причиной: {first_alert.get('reason', 'данных недостаточно')}. В графе связей присутствуют сущности и evidence, которые указывают на возможную координацию через открытые источники. Система не утверждает факт правонарушения, но выделяет связи между источниками, сущностями и категориями риска как основание для ручной проверки. Временная последовательность определяется по timestamps алертов и evidence; при отсутствии дополнительных подтверждений выводы следует рассматривать как предварительную аналитическую записку.",
        "entity_risk_table": entity_rows,
        "connection_analysis": "Граф связей показывает отношения между источниками, сообщениями и извлечёнными сущностями. Часть связей сформирована автоматически через совпадение сущностей в evidence, поэтому каждая связь должна быть подтверждена аналитиком перед передачей в ведомственный контур.",
        "risk_assessment": {"overall_score": score, "confidence": max([alert.get("confidence", 0) for alert in alerts] + [60]), "risk_category": risk_category, "risk_factors": categories[:5] or ["недостаточно данных", "требуется ручная верификация"]},
        "recommended_actions": [
            {"priority": "В ТЕЧЕНИЕ 24Ч", "action": "Проверить provenance источников и evidence hashes", "responsible_body": "МЦРИАП"},
            {"priority": "ПЛАНОВОЕ", "action": "Сопоставить сущности с другими открытыми источниками", "responsible_body": "МВД"},
            {"priority": "ПЛАНОВОЕ", "action": "Передать подтверждённые материалы профильному подразделению", "responsible_body": "КНБ"},
        ],
        "legal_note": "Материалы сформированы на основе открытых или законно доступных источников и требуют ручной проверки. Возможные меры должны определяться профильным органом с учётом применимых норм законодательства Республики Казахстан и категории выявленной угрозы.",
        "limitations": "Модель работала только с данными кейса. Не проверялись закрытые источники, личность субъектов и фактическая принадлежность аккаунтов или кошельков. Источники требуют ручной верификации.",
    }


def _elapsed(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)
