#!/usr/bin/env python3
"""Cloud Scheduler / Cloud Run Job entrypoint for Sprint 3 retention."""

from app.core.database import SessionLocal
from app.services.retention_service import purge_inactive_fingerprints


def main() -> int:
    with SessionLocal() as db:
        print(f"purged_fingerprints={purge_inactive_fingerprints(db)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
