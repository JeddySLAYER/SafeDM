from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_user
from app.models.user import User
from app.schemas.legal import (
    LegalAcceptRequest,
    LegalDocumentResponse,
    LegalStatusResponse,
    LegalUpdateRequest,
)
from app.services.audit_service import record_access
from app.services.legal_service import LegalService

router = APIRouter(prefix="/legal", tags=["legal"])


def _dump(doc) -> LegalDocumentResponse:
    return LegalDocumentResponse(
        slug=doc.slug,
        title=doc.title,
        body=doc.body,
        version=doc.version,
    )


@router.get("/documents", response_model=list[LegalDocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    service = LegalService(db)
    docs = service.public_documents()
    db.commit()
    return [_dump(doc) for doc in docs]


@router.get("/status", response_model=LegalStatusResponse)
def legal_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs, pending = LegalService(db).status_for(current_user)
    db.commit()
    return LegalStatusResponse(
        documents=[_dump(doc) for doc in docs],
        pending_slugs=pending,
    )


@router.post("/accept", response_model=LegalStatusResponse)
def accept_documents(
    payload: LegalAcceptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = LegalService(db)
    service.accept(current_user, [(item.slug, item.version) for item in payload.documents])
    docs, pending = service.status_for(current_user)
    return LegalStatusResponse(
        documents=[_dump(doc) for doc in docs],
        pending_slugs=pending,
    )


@router.put("/documents/{slug}", response_model=LegalDocumentResponse)
def admin_update_document(
    slug: str,
    payload: LegalUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    doc = LegalService(db).update(slug, payload.title.strip(), payload.body.strip())
    record_access(
        db,
        user_id=current_admin.id,
        action="update_legal_document",
        resource=slug,
        purpose="Admin legal document update",
    )
    db.commit()
    return _dump(doc)
