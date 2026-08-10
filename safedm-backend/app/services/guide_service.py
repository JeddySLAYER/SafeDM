from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.guide_repository import GuideRepository
from app.schemas.guide import (
    GuideArticleCreateRequest,
    GuideArticleResponse,
    GuideArticleSummary,
    GuideArticleUpdateRequest,
    GuideCategoryCreateRequest,
    GuideCategoryResponse,
    GuideCategoryUpdateRequest,
)


class GuideService:
    def __init__(self, db: Session):
        self.guide = GuideRepository(db)

    def list_categories(self, *, published_only: bool = True) -> list[GuideCategoryResponse]:
        categories = self.guide.list_categories(published_only=published_only)
        result: list[GuideCategoryResponse] = []
        for category in categories:
            articles = sorted(category.articles, key=lambda a: (a.display_order, a.id))
            result.append(
                GuideCategoryResponse(
                    id=category.id,
                    title=category.title,
                    description=category.description,
                    display_order=category.display_order,
                    articles=[GuideArticleSummary.model_validate(a) for a in articles],
                )
            )
        return result

    def get_article(self, article_id: int, *, published_only: bool = True) -> GuideArticleResponse:
        article = self.guide.get_article(article_id, published_only=published_only)
        if article is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable")
        return GuideArticleResponse.model_validate(article)

    def create_category(self, payload: GuideCategoryCreateRequest) -> GuideCategoryResponse:
        category = self.guide.create_category(
            title=payload.title,
            description=payload.description,
            display_order=payload.display_order,
        )
        return GuideCategoryResponse(
            id=category.id,
            title=category.title,
            description=category.description,
            display_order=category.display_order,
            articles=[],
        )

    def update_category(
        self,
        category_id: int,
        payload: GuideCategoryUpdateRequest,
    ) -> GuideCategoryResponse:
        category = self.guide.get_category(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable")
        updated = self.guide.update_category(
            category,
            title=payload.title,
            description=payload.description,
            display_order=payload.display_order,
        )
        articles = sorted(updated.articles, key=lambda a: (a.display_order, a.id))
        return GuideCategoryResponse(
            id=updated.id,
            title=updated.title,
            description=updated.description,
            display_order=updated.display_order,
            articles=[GuideArticleSummary.model_validate(a) for a in articles],
        )

    def delete_category(self, category_id: int) -> None:
        category = self.guide.get_category(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable")
        self.guide.delete_category(category)

    def create_article(self, payload: GuideArticleCreateRequest) -> GuideArticleResponse:
        if self.guide.get_category(payload.category_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Catégorie invalide")
        article = self.guide.create_article(
            category_id=payload.category_id,
            title=payload.title,
            content=payload.content,
            display_order=payload.display_order,
            is_published=payload.is_published,
        )
        return GuideArticleResponse.model_validate(article)

    def update_article(
        self,
        article_id: int,
        payload: GuideArticleUpdateRequest,
    ) -> GuideArticleResponse:
        article = self.guide.get_article(article_id, published_only=False)
        if article is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable")
        if payload.category_id is not None and self.guide.get_category(payload.category_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Catégorie invalide")
        updated = self.guide.update_article(
            article,
            title=payload.title,
            content=payload.content,
            display_order=payload.display_order,
            is_published=payload.is_published,
            category_id=payload.category_id,
        )
        return GuideArticleResponse.model_validate(updated)

    def delete_article(self, article_id: int) -> None:
        article = self.guide.get_article(article_id, published_only=False)
        if article is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable")
        self.guide.delete_article(article)
