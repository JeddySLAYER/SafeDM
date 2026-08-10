from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import MonitoringPreference, SupportedApplication


class ApplicationRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_enabled(self) -> list[SupportedApplication]:
        return list(
            self.db.scalars(
                select(SupportedApplication)
                .where(SupportedApplication.is_enabled.is_(True))
                .order_by(SupportedApplication.id)
            ).all()
        )

    def get_by_id(self, application_id: int) -> SupportedApplication | None:
        return self.db.get(SupportedApplication, application_id)


class MonitoringRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_user(self, user_id: int) -> list[MonitoringPreference]:
        return list(
            self.db.scalars(
                select(MonitoringPreference)
                .options(joinedload(MonitoringPreference.application))
                .where(MonitoringPreference.user_id == user_id)
                .order_by(MonitoringPreference.application_id)
            ).unique().all()
        )

    def upsert(
        self,
        *,
        user_id: int,
        application_id: int,
        enabled: bool,
    ) -> MonitoringPreference:
        pref = self.db.scalar(
            select(MonitoringPreference).where(
                MonitoringPreference.user_id == user_id,
                MonitoringPreference.application_id == application_id,
            )
        )
        if pref:
            pref.enabled = enabled
        else:
            pref = MonitoringPreference(
                user_id=user_id,
                application_id=application_id,
                enabled=enabled,
            )
            self.db.add(pref)
        self.db.commit()
        self.db.refresh(pref)
        return pref
