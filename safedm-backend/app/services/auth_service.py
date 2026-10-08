import secrets

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse, UserLoginRequest, UserRegisterRequest, UserResponse
from app.services.firebase_auth import (
    is_firebase_admin,
    username_from_identity,
    verify_firebase_id_token,
)


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

    def login_firebase(self, id_token: str) -> AuthResponse:
        claims = verify_firebase_id_token(id_token)
        uid = str(claims["sub"])
        email = claims.get("email")
        user = self.users.get_by_firebase_uid(uid)
        if user is None:
            username = self._unique_username(username_from_identity(email, uid))
            user = self.users.create(
                username=username,
                password_hash=hash_password(secrets.token_urlsafe(48)),
                is_admin=is_firebase_admin(email, claims),
            )
            user.firebase_uid = uid
            self.users.update(user)
        elif email and is_firebase_admin(email, claims) and not user.is_admin:
            user.is_admin = True
            self.users.update(user)
        return self._auth_response(user)

    def _unique_username(self, base: str) -> str:
        candidate = base
        suffix = 2
        while self.users.get_by_username(candidate):
            extra = f"_{suffix}"
            candidate = f"{base[: 64 - len(extra)]}{extra}"
            suffix += 1
        return candidate

    def _auth_response(self, user: User) -> AuthResponse:
        token = create_access_token(
            user.id,
            extra_claims={"username": user.username, "is_admin": user.is_admin},
        )
        return AuthResponse(
            access_token=token,
            user=UserResponse.model_validate(user),
        )
