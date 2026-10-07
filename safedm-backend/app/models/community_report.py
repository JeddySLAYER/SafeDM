from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ReportSource, ReportStatus

if TYPE_CHECKING:
    from app.models.threat import Threat
    from app.models.user import User


class CommunityReport(Base):
    __tablename__ = "community_reports"
    __table_args__ = (
        UniqueConstraint("user_id", "threat_id", name="uq_community_reports_user_threat"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    threat_id: Mapped[int] = mapped_column(
        ForeignKey("threats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source: Mapped[ReportSource] = mapped_column(
        Enum(ReportSource, values_callable=lambda x: [e.value for e in x], native_enum=False),
        nullable=False,
    )
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=ReportStatus.ACTIVE,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    threat: Mapped["Threat"] = relationship(back_populates="reports")
    user: Mapped["User"] = relationship(back_populates="community_reports")

    def __repr__(self) -> str:
        return f"<CommunityReport id={self.id} threat_id={self.threat_id} status={self.status}>"
