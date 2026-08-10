from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse, UserLoginRequest, UserRegisterRequest, UserResponse


class AuthService:
    def __init__(self, db: Session):
        self.users = UserRepository(db)

    def register(self, payload: UserRegisterRequest) -> AuthResponse:
        if self.users.get_by_username(payload.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ce nom d'utilisateur est déjà pris",
            )
        user = self.users.create(
            username=payload.username,
            password_hash=hash_password(payload.password),
        )
        return self._auth_response(user)

    def login(self, payload: UserLoginRequest) -> AuthResponse:
        user = self.users.get_by_username(payload.username)
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nom d'utilisateur ou mot de passe incorrect",
            )
        return self._auth_response(user)

    def _auth_response(self, user: User) -> AuthResponse:
        token = create_access_token(
            user.id,
            extra_claims={"username": user.username, "is_admin": user.is_admin},
        )
        return AuthResponse(
            access_token=token,
            user=UserResponse.model_validate(user),
        )
