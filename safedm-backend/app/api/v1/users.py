from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.auth import UserResponse, UserUpdateRequest
from app.schemas.device import DeviceCreateRequest, DeviceResponse
from app.schemas.monitoring import MonitoringPreferenceResponse, MonitoringUpdateRequest
from app.services.device_service import DeviceService
from app.services.monitoring_service import MonitoringService
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).update_me(current_user, payload)


@router.get("/me/devices", response_model=list[DeviceResponse])
def list_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DeviceService(db).list_mine(current_user)


@router.post("/me/devices", response_model=DeviceResponse, status_code=201)
def register_device(
    payload: DeviceCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DeviceService(db).register(current_user, payload)


@router.get("/me/monitoring", response_model=list[MonitoringPreferenceResponse])
def get_monitoring(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return MonitoringService(db).get_preferences(current_user)


@router.put("/me/monitoring", response_model=list[MonitoringPreferenceResponse])
def update_monitoring(
    payload: MonitoringUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return MonitoringService(db).update_preferences(current_user, payload)
