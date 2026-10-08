from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.legal import LegalAcceptance, LegalDocument
from app.models.user import User
from app.services.legal_defaults import DEFAULT_DOCUMENTS


class LegalService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_documents(self) -> list[LegalDocument]:
        docs = list(self.db.scalars(select(LegalDocument).order_by(LegalDocument.id)).all())
        known = {doc.slug for doc in docs}
        created = False
        for item in DEFAULT_DOCUMENTS:
            if item["slug"] in known:
                continue
            self.db.add(
                LegalDocument(
                    slug=item["slug"],
                    title=item["title"],
                    body=item["body"],
                    version=1,
                )
            )
            created = True
        if created:
            self.db.flush()
            docs = list(self.db.scalars(select(LegalDocument).order_by(LegalDocument.id)).all())
        return docs

    def public_documents(self) -> list[LegalDocument]:
        return self.ensure_documents()

    def status_for(self, user: User) -> tuple[list[LegalDocument], list[str]]:
        docs = self.ensure_documents()
        acceptances = {
            row.document_id: row.version
            for row in self.db.scalars(
                select(LegalAcceptance).where(LegalAcceptance.user_id == user.id)
            ).all()
        }
        pending = [
            doc.slug
            for doc in docs
            if acceptances.get(doc.id, 0) < doc.version
        ]
        return docs, pending

    def accept(self, user: User, items: list[tuple[str, int]]) -> None:
        docs = {doc.slug: doc for doc in self.ensure_documents()}
        for slug, version in items:
            doc = docs.get(slug)
            if doc is None or doc.version != version:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cette politique a été mise à jour. Relisez-la avant d'accepter.",
                )
            row = self.db.scalar(
                select(LegalAcceptance).where(
                    LegalAcceptance.user_id == user.id,
                    LegalAcceptance.document_id == doc.id,
                )
            )
            if row is None:
                self.db.add(
                    LegalAcceptance(user_id=user.id, document_id=doc.id, version=version)
                )
            else:
                row.version = version
        self.db.commit()

    def update(self, slug: str, title: str, body: str) -> LegalDocument:
        docs = {doc.slug: doc for doc in self.ensure_documents()}
        doc = docs.get(slug)
        if doc is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable")
        changed = doc.title != title or doc.body != body
        doc.title = title
        doc.body = body
        if changed:
            doc.version += 1
        self.db.commit()
        self.db.refresh(doc)
        return doc
