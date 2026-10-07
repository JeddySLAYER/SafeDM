from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserResponse, UserUpdateRequest


class UserService:
    def __init__(self, db: Session):
        self.users = UserRepository(db)

    def get_me(self, user: User) -> UserResponse:
        return UserResponse.model_validate(user)

    def update_me(self, user: User, payload: UserUpdateRequest) -> UserResponse:
        if payload.password is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucun champ à mettre à jour",
            )
        user.password_hash = hash_password(payload.password)
        updated = self.users.update(user)
        return UserResponse.model_validate(updated)
