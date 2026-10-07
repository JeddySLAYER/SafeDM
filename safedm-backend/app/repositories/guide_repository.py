from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import GuideArticle, GuideCategory


class GuideRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_categories(self, *, published_only: bool = True) -> list[GuideCategory]:
        categories = list(
            self.db.scalars(
                select(GuideCategory)
                .options(joinedload(GuideCategory.articles))
                .order_by(GuideCategory.display_order, GuideCategory.id)
            )
            .unique()
            .all()
        )
        if published_only:
            for category in categories:
                category.articles = [a for a in category.articles if a.is_published]
        return categories

    def get_article(self, article_id: int, *, published_only: bool = True) -> GuideArticle | None:
        article = self.db.get(GuideArticle, article_id)
        if article is None:
            return None
        if published_only and not article.is_published:
            return None
        return article

    def get_category(self, category_id: int) -> GuideCategory | None:
        return self.db.get(GuideCategory, category_id)

    def create_category(self, **kwargs) -> GuideCategory:
        category = GuideCategory(**kwargs)
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def update_category(self, category: GuideCategory, **kwargs) -> GuideCategory:
        for key, value in kwargs.items():
            if value is not None:
                setattr(category, key, value)
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def delete_category(self, category: GuideCategory) -> None:
        self.db.delete(category)
        self.db.commit()

    def create_article(self, **kwargs) -> GuideArticle:
        article = GuideArticle(**kwargs)
        self.db.add(article)
        self.db.commit()
        self.db.refresh(article)
        return article

    def update_article(self, article: GuideArticle, **kwargs) -> GuideArticle:
        for key, value in kwargs.items():
            if value is not None:
                setattr(article, key, value)
        self.db.add(article)
        self.db.commit()
        self.db.refresh(article)
        return article

    def delete_article(self, article: GuideArticle) -> None:
        self.db.delete(article)
        self.db.commit()

    def count_published_articles(self) -> int:
        return int(
            self.db.scalar(
                select(func.count(GuideArticle.id)).where(GuideArticle.is_published.is_(True))
            )
            or 0
        )
