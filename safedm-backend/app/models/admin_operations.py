from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PatchDeployment(Base):
    __tablename__ = "patch_deployments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="CANARY", nullable=False)
    rollout_percentage: Mapped[float] = mapped_column(Float, default=1, nullable=False)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AggregationRun(Base):
    __tablename__ = "aggregation_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(32), default="REQUESTED", nullable=False)
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TenantPolicy(Base):
    __tablename__ = "tenant_policies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(64), default="global", nullable=False)
    safe_score: Mapped[int] = mapped_column(Integer, nullable=False)
    suspicious_score: Mapped[int] = mapped_column(Integer, nullable=False)
    critical_score: Mapped[int] = mapped_column(Integer, nullable=False)
    escalation_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    updated_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
