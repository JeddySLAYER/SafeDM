from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import check_rate_limit
from app.schemas.auth import (
    AuthResponse,
    FirebaseLoginRequest,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _maybe_limit(request: Request, route_key: str) -> None:
    if get_settings().rate_limit_enabled:
        check_rate_limit(request, route_key)


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    payload: UserRegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    _maybe_limit(request, "/auth/register")
    return AuthService(db).register(payload)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: UserLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    _maybe_limit(request, "/auth/login")
    return AuthService(db).login(payload)


@router.post("/login/form", response_model=AuthResponse, include_in_schema=False)
def login_form(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Compat Swagger OAuth2PasswordBearer (username/password form)."""
    _maybe_limit(request, "/auth/login/form")
    payload = UserLoginRequest(username=form_data.username, password=form_data.password)
    return AuthService(db).login(payload)


@router.post("/firebase", response_model=AuthResponse)
def login_firebase(
    payload: FirebaseLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Echange un ID token Firebase contre le JWT SafeDM (API inchangée ensuite)."""
    _maybe_limit(request, "/auth/firebase")
    return AuthService(db).login_firebase(payload.id_token)
