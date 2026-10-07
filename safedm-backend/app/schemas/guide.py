from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GuideArticleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    display_order: int
    is_published: bool


class GuideArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    title: str
    content: str
    display_order: int
    is_published: bool
    created_at: datetime
    updated_at: datetime


class GuideCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    display_order: int
    articles: list[GuideArticleSummary] = []


class GuideArticleCreateRequest(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    display_order: int = 0
    is_published: bool = False


class GuideArticleUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content: Optional[str] = None
    display_order: Optional[int] = None
    is_published: Optional[bool] = None
    category_id: Optional[int] = None


class GuideCategoryCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    display_order: int = 0


class GuideCategoryUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    display_order: Optional[int] = None
