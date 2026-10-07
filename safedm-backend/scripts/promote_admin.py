"""Promote an existing user to admin (no password change).

Usage:
  python -m scripts.promote_admin <username>
"""

from __future__ import annotations

import sys

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import User


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.promote_admin <username>")
        sys.exit(1)
    username = sys.argv[1].strip()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            print(f"User not found: {username}")
            sys.exit(1)
        user.is_admin = True
        db.commit()
        print(f"OK: {username} is now admin (id={user.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
