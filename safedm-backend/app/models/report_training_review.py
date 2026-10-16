from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReportTrainingReview(Base):
    __tablename__ = "report_training_reviews"
    __table_args__ = (UniqueConstraint("report_id", name="uq_report_training_reviews_report"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("community_reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expected: Mapped[str] = mapped_column(String(16), nullable=False)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    dataset_id: Mapped[int | None] = mapped_column(
        ForeignKey("ml_datasets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
