"""Antifraud models"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import BaseModel


class CheckType(str, PyEnum):
    """Antifraud check type"""
    VELOCITY = "velocity"
    AMOUNT_LIMIT = "amount_limit"
    NEW_AGENT = "new_agent"
    IP_MATCH = "ip_match"
    DEVICE_MATCH = "device_match"
    PASSPORT_CHECK = "passport_check"
    INN_CHECK = "inn_check"
    BLACKLIST = "blacklist"
    ROSFINMONITORING = "rosfinmonitoring"


class CheckResult(str, PyEnum):
    """Check result"""
    PASS = "pass"
    FLAG = "flag"
    BLOCK = "block"


class BlacklistType(str, PyEnum):
    """Blacklist type"""
    PHONE = "phone"
    PASSPORT = "passport"
    INN = "inn"
    DEVICE_ID = "device_id"
    IP = "ip"


class AntiFraudCheck(BaseModel):
    """Antifraud check log"""

    __tablename__ = "antifraud_checks"

    entity_type = Column(String(50), nullable=False, index=True)  # user, deal, payment
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    check_type = Column(Enum(CheckType), nullable=False)
    result = Column(Enum(CheckResult), nullable=False)

    reason = Column(Text, nullable=True)


class UserLimit(BaseModel):
    """User limits"""

    __tablename__ = "user_limits"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    max_deal_amount = Column(Integer, nullable=True)
    max_monthly_gmv = Column(Integer, nullable=True)
    payout_hold_days = Column(Integer, default=0, nullable=False)

    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class Blacklist(BaseModel):
    """Blacklist"""

    __tablename__ = "blacklist"

    type = Column(Enum(BlacklistType), nullable=False)
    value_hash = Column(String(64), nullable=False, unique=True, index=True)

    reason = Column(Text, nullable=False)
