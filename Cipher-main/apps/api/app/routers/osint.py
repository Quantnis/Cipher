from pydantic import BaseModel
from fastapi import APIRouter

from app.services.osint import crypto_tracker, domain_intel, leak_scanner, social_scanner

router = APIRouter(prefix="/osint", tags=["osint"])


class CryptoIn(BaseModel):
    address: str
    chain: str = "auto"


class IndicatorIn(BaseModel):
    indicator: str


class DomainIn(BaseModel):
    target: str


class SocialIn(BaseModel):
    query: str


@router.post("/crypto")
def crypto(payload: CryptoIn):
    return crypto_tracker(payload.address, payload.chain)


@router.post("/leaks")
def leaks(payload: IndicatorIn):
    return leak_scanner(payload.indicator)


@router.post("/domain")
def domain(payload: DomainIn):
    return domain_intel(payload.target)


@router.post("/social")
def social(payload: SocialIn):
    return social_scanner(payload.query)
