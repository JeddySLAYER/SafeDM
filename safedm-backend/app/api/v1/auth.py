from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import AuthResponse, UserLoginRequest, UserRegisterRequest
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    return AuthService(db).register(payload)


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLoginRequest, db: Session = Depends(get_db)):
    return AuthService(db).login(payload)


@router.post("/login/form", response_model=AuthResponse, include_in_schema=False)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Compat Swagger OAuth2PasswordBearer (username/password form)."""
    payload = UserLoginRequest(username=form_data.username, password=form_data.password)
    return AuthService(db).login(payload)
