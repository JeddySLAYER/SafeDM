"""Create PostgreSQL role/database for SafeDM.

Tries common local superuser URLs, then creates safedm/safedm.
"""

from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

CANDIDATE_URLS = [
    "postgresql+psycopg2://postgres:postgres@localhost:5432/postgres",
    "postgresql+psycopg2://postgres:admin@localhost:5432/postgres",
    "postgresql+psycopg2://postgres:root@localhost:5432/postgres",
    "postgresql+psycopg2://postgres@localhost:5432/postgres",
]

APP_URL = "postgresql+psycopg2://safedm:safedm@localhost:5432/safedm"


def _connect(url: str):
    engine = create_engine(url)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return engine


def main() -> None:
    admin = None
    for url in CANDIDATE_URLS:
        try:
            admin = _connect(url)
            print(f"Admin OK: {url.split('@')[0]}@...")
            break
        except OperationalError as exc:
            print(f"Skip: {url.split('@')[0]} — {exc.__class__.__name__}")

    if admin is None:
        raise SystemExit(
            "Impossible de se connecter à PostgreSQL en superuser. "
            "Démarre le service PostgreSQL et vérifie le mot de passe postgres."
        )

    with admin.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        exists_user = conn.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = 'safedm'")
        ).scalar()
        if not exists_user:
            conn.execute(text("CREATE USER safedm WITH PASSWORD 'safedm'"))
            print("Created role safedm")
        else:
            print("Role safedm already exists")

        exists_db = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'safedm'")
        ).scalar()
        if not exists_db:
            conn.execute(text("CREATE DATABASE safedm OWNER safedm"))
            print("Created database safedm")
        else:
            print("Database safedm already exists")

        try:
            conn.execute(text("GRANT ALL PRIVILEGES ON DATABASE safedm TO safedm"))
        except ProgrammingError:
            pass

    app = create_engine(APP_URL)
    with app.connect() as conn:
        db = conn.execute(text("SELECT current_database()")).scalar()
        print(f"App login OK — database={db}")


if __name__ == "__main__":
    main()
