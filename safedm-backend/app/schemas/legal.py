from pydantic import BaseModel, Field


class LegalDocumentResponse(BaseModel):
    slug: str
    title: str
    body: str
    version: int


class LegalStatusResponse(BaseModel):
    documents: list[LegalDocumentResponse]
    pending_slugs: list[str]


class LegalAcceptItem(BaseModel):
    slug: str = Field(min_length=1, max_length=32)
    version: int = Field(ge=1)


class LegalAcceptRequest(BaseModel):
    documents: list[LegalAcceptItem] = Field(min_length=1)


class LegalUpdateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=20, max_length=20000)
