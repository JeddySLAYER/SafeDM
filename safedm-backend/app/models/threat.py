from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ThreatSeverity, ThreatStatus

if TYPE_CHECKING:
    from app.models.community_report import CommunityReport
    from app.models.threat_url import ThreatUrl


class Threat(Base):
    __tablename__ = "threats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    raw_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    normalized_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    report_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    community_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        server_default="0",
        nullable=False,
    )
    severity: Mapped[ThreatSeverity] = mapped_column(
        Enum(ThreatSeverity, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=ThreatSeverity.LOW,
        nullable=False,
    )
    status: Mapped[ThreatStatus] = mapped_column(
        Enum(ThreatStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=ThreatStatus.ACTIVE,
        nullable=False,
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    reports: Mapped[list["CommunityReport"]] = relationship(
        back_populates="threat",
        cascade="all, delete-orphan",
    )
    urls: Mapped[list["ThreatUrl"]] = relationship(
        back_populates="threat",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Threat id={self.id} severity={self.severity} status={self.status}>"
