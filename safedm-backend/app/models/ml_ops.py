from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MlDataset(Base):
    __tablename__ = "ml_datasets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(64), default="upload", nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    benign_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    malicious_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MlTrainRun(Base):
    __tablename__ = "ml_train_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("ml_datasets.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    publishable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metrics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    log_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    artifact_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    triggered_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
