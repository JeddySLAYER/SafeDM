from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.threat import Threat
    from app.models.virustotal_scan import VirusTotalScan


class ThreatUrl(Base):
    __tablename__ = "threat_urls"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    threat_id: Mapped[int] = mapped_column(
        ForeignKey("threats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_url: Mapped[str] = mapped_column(Text, nullable=False)
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    threat: Mapped["Threat"] = relationship(back_populates="urls")
    scans: Mapped[list["VirusTotalScan"]] = relationship(
        back_populates="threat_url",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ThreatUrl id={self.id} domain={self.domain!r}>"
