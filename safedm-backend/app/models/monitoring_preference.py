from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.supported_application import SupportedApplication
    from app.models.user import User


class MonitoringPreference(Base):
    __tablename__ = "monitoring_preferences"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "application_id",
            name="uq_monitoring_user_application",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("supported_applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="monitoring_preferences")
    application: Mapped["SupportedApplication"] = relationship(
        back_populates="monitoring_preferences"
    )

    def __repr__(self) -> str:
        return (
            f"<MonitoringPreference id={self.id} "
            f"user_id={self.user_id} application_id={self.application_id}>"
        )
