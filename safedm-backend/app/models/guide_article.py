from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.guide_category import GuideCategory


class GuideArticle(Base, TimestampMixin):
    __tablename__ = "guide_articles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("guide_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
    )

    category: Mapped["GuideCategory"] = relationship(back_populates="articles")

    def __repr__(self) -> str:
        return f"<GuideArticle id={self.id} title={self.title!r}>"
