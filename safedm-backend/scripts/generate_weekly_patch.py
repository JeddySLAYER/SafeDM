"""Cloud Run Job entrypoint for the weekly policy patch."""

import os

from app.core.database import SessionLocal
from app.services.weekly_patch_service import build_weekly_patch


def main() -> int:
    with SessionLocal() as db:
        manifest = build_weekly_patch(
            db,
            output_dir=os.getenv("PATCH_OUTPUT_DIR", "artifacts/weekly"),
        )
    print(
        "weekly_patch_generated "
        f"version={manifest['version']} reports={manifest['source']['active_reports']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
