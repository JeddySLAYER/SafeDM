from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User
from app.repositories.monitoring_repository import ApplicationRepository, MonitoringRepository
from app.schemas.monitoring import (
    ApplicationResponse,
    MonitoringPreferenceResponse,
    MonitoringUpdateRequest,
)


class MonitoringService:
    def __init__(self, db: Session):
        self.applications = ApplicationRepository(db)
        self.monitoring = MonitoringRepository(db)
        self.db = db

    def list_applications(self) -> list[ApplicationResponse]:
        return [
            ApplicationResponse.model_validate(app)
            for app in self.applications.list_enabled()
        ]

    def get_preferences(self, user: User) -> list[MonitoringPreferenceResponse]:
        prefs = self.monitoring.list_for_user(user.id)
        if prefs:
            return [MonitoringPreferenceResponse.model_validate(p) for p in prefs]

        # Première visite : préférences par défaut (toutes activées)
        for app in self.applications.list_enabled():
            self.monitoring.upsert(
                user_id=user.id,
                application_id=app.id,
                enabled=True,
            )
        prefs = self.monitoring.list_for_user(user.id)
        return [MonitoringPreferenceResponse.model_validate(p) for p in prefs]

    def update_preferences(
        self,
        user: User,
        payload: MonitoringUpdateRequest,
    ) -> list[MonitoringPreferenceResponse]:
        for item in payload.preferences:
            app = self.applications.get_by_id(item.application_id)
            if app is None or not app.is_enabled:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Application invalide: {item.application_id}",
                )
            self.monitoring.upsert(
                user_id=user.id,
                application_id=item.application_id,
                enabled=item.enabled,
            )
        return self.get_preferences(user)
