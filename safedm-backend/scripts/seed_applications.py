"""Seed supported Android applications (WhatsApp, SMS, Email).

Usage:
    python -m scripts.seed_applications
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running as `python -m scripts.seed_applications` from backend root
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select

from app.core.brand import MONITORED_APPS
from app.core.database import SessionLocal
from app.models import SupportedApplication


def seed_applications() -> None:
    db = SessionLocal()
    try:
        created = 0
        for app_data in MONITORED_APPS:
            existing = db.scalar(
                select(SupportedApplication).where(
                    SupportedApplication.package_name == app_data["package_name"]
                )
            )
            if existing:
                existing.name = app_data["name"]
                existing.is_enabled = True
                print(f"  update: {app_data['name']} ({app_data['package_name']})")
            else:
                db.add(
                    SupportedApplication(
                        name=app_data["name"],
                        package_name=app_data["package_name"],
                        is_enabled=True,
                    )
                )
                created += 1
                print(f"  create: {app_data['name']} ({app_data['package_name']})")

        db.commit()
        print(f"Seed terminé — {created} nouvelle(s) application(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_applications()
