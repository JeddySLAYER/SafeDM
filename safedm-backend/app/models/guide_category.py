from typing import TYPE_CHECKING, Optional

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.guide_article import GuideArticle


class GuideCategory(Base):
    __tablename__ = "guide_categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    articles: Mapped[list["GuideArticle"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="GuideArticle.display_order",
    )

    def __repr__(self) -> str:
        return f"<GuideCategory id={self.id} title={self.title!r}>"
