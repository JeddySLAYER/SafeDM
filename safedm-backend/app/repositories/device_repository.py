from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Device


class DeviceRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_user(self, user_id: int) -> list[Device]:
        return list(
            self.db.scalars(select(Device).where(Device.user_id == user_id)).all()
        )

    def get_by_user_and_identifier(self, user_id: int, device_identifier: str) -> Device | None:
        return self.db.scalar(
            select(Device).where(
                Device.user_id == user_id,
                Device.device_identifier == device_identifier,
            )
        )

    def upsert(self, *, user_id: int, device_identifier: str) -> Device:
        device = self.get_by_user_and_identifier(user_id, device_identifier)
        now = datetime.now(timezone.utc)
        if device:
            device.last_seen_at = now
        else:
            device = Device(
                user_id=user_id,
                device_identifier=device_identifier,
                last_seen_at=now,
            )
            self.db.add(device)
        self.db.commit()
        self.db.refresh(device)
        return device
