from sqlalchemy.orm import Session

from app.models import User
from app.repositories.device_repository import DeviceRepository
from app.schemas.device import DeviceCreateRequest, DeviceResponse


class DeviceService:
    def __init__(self, db: Session):
        self.devices = DeviceRepository(db)

    def list_mine(self, user: User) -> list[DeviceResponse]:
        return [
            DeviceResponse.model_validate(device)
            for device in self.devices.list_for_user(user.id)
        ]

    def register(self, user: User, payload: DeviceCreateRequest) -> DeviceResponse:
        device = self.devices.upsert(
            user_id=user.id,
            device_identifier=payload.device_identifier,
        )
        return DeviceResponse.model_validate(device)
