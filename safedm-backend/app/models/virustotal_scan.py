from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import VirusTotalResult, VirusTotalScanStatus

if TYPE_CHECKING:
    from app.models.threat_url import ThreatUrl


class VirusTotalScan(Base):
    __tablename__ = "virustotal_scans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    threat_url_id: Mapped[int] = mapped_column(
        ForeignKey("threat_urls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[VirusTotalScanStatus] = mapped_column(
        Enum(
            VirusTotalScanStatus,
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=VirusTotalScanStatus.PENDING,
        nullable=False,
    )
    result: Mapped[VirusTotalResult] = mapped_column(
        Enum(
            VirusTotalResult,
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=VirusTotalResult.UNKNOWN,
        nullable=False,
    )
    raw_result: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    threat_url: Mapped["ThreatUrl"] = relationship(back_populates="scans")

    def __repr__(self) -> str:
        return f"<VirusTotalScan id={self.id} result={self.result} status={self.status}>"
