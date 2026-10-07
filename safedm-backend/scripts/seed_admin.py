"""Create an admin user from scratch (or promote an existing user to admin).

Reads credentials from arguments, falling back to ADMIN_USERNAME / ADMIN_PASSWORD
environment variables.

Usage:
    python -m scripts.seed_admin <username> <password>
    python -m scripts.seed_admin                # via ADMIN_USERNAME / ADMIN_PASSWORD
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 2:
        username, password = args[0].strip(), args[1]
    else:
        username = os.getenv("ADMIN_USERNAME", "").strip()
        password = os.getenv("ADMIN_PASSWORD", "")
        if not username or not password:
            print("Usage: python -m scripts.seed_admin <username> <password>")
            print("  ou définir ADMIN_USERNAME / ADMIN_PASSWORD dans l'environnement")
            sys.exit(1)

    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            db.add(
                User(
                    username=username,
                    password_hash=hash_password(password),
                    is_admin=True,
                )
            )
            print(f"Created admin: {username}")
        else:
            user.is_admin = True
            user.password_hash = hash_password(password)
            print(f"Promoted to admin (password reset): {username}")
        db.commit()
        print(f"OK: {username} est admin (id={user.id if user else 'new'})")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
