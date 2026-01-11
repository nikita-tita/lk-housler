"""Base class for all database models"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, declared_attr

Base = declarative_base()


class SoftDeleteMixin:
    """Mixin for soft delete functionality.

    Models using this mixin will have a deleted_at column.
    When "deleted", records are marked with a timestamp instead of being removed.

    Note: Queries must explicitly filter by deleted_at IS NULL to exclude deleted records.
    """

    deleted_at = Column(DateTime, nullable=True, default=None, index=True)

    @property
    def is_deleted(self) -> bool:
        """Check if record is soft-deleted"""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """Mark record as deleted"""
        self.deleted_at = datetime.utcnow()

    def restore(self) -> None:
        """Restore soft-deleted record"""
        self.deleted_at = None


class BaseModel(Base):
    """Abstract base model with common fields"""

    __abstract__ = True

    @declared_attr
    def __tablename__(cls) -> str:
        """Generate table name from class name"""
        return cls.__name__.lower()

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        """Convert model to dictionary"""
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}
