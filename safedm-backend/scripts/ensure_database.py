"""Create a local PostgreSQL role/database, or verify a remote one (Neon).

DATABASE_URL is read from the environment (.env, via app.core.config) —
never hardcoded.

- If the host is localhost/127.0.0.1: tries common local superuser URLs
  (override with PGADMIN_URLS) and creates the role + database derived
  from DATABASE_URL.
- Otherwise (e.g. Neon): nothing to create — the database is managed
  server-side, so the script only verifies the connection.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Allow running as `python -m scripts.ensure_database` from backend root
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError, ProgrammingError

DEFAULT_ADMIN_URLS = [
    "postgresql+psycopg2://postgres:postgres@localhost:5432/postgres",
    "postgresql+psycopg2://postgres:admin@localhost:5432/postgres",
    "postgresql+psycopg2://postgres:root@localhost:5432/postgres",
    "postgresql+psycopg2://postgres@localhost:5432/postgres",
]

LOCAL_HOSTS = {"", "localhost", "127.0.0.1", "::1"}


def _admin_urls() -> list[str]:
    raw = os.getenv("PGADMIN_URLS", "").strip()
    if raw:
        return [u.strip() for u in raw.split(",") if u.strip()]
    return DEFAULT_ADMIN_URLS


def _quote_ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _quote_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _connect(url: str):
    engine = create_engine(url)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return engine


def _verify_connection(database_url: str) -> None:
    engine = create_engine(database_url)
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version()")).scalar()
        db = conn.execute(text("SELECT current_database()")).scalar()
        print("Connexion OK.")
        print(f"Version: {version.split(',')[0].strip()}")
        print(f"Database: {db}")


def _create_local(database_url: str) -> None:
    url = make_url(database_url)
    username = url.username or "safedm"
    password = url.password or ""
    dbname = url.database or "safedm"

    admin = None
    for admin_url in _admin_urls():
        try:
            admin = _connect(admin_url)
            print(f"Admin OK: {admin_url.split('@')[0]}@...")
            break
        except OperationalError as exc:
            print(f"Skip: {admin_url.split('@')[0]} — {exc.__class__.__name__}")

    if admin is None:
        raise SystemExit(
            "Impossible de se connecter à PostgreSQL en superuser. "
            "Démarre le service PostgreSQL et vérifie le mot de passe postgres, "
            "ou passe PGADMIN_URLS=postgresql+psycopg2://... en variable d'environnement."
        )

    with admin.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        exists_user = conn.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = :name"), {"name": username}
        ).scalar()
        if not exists_user:
            conn.execute(
                text(
                    "CREATE USER {ident} WITH PASSWORD {pw}".format(
                        ident=_quote_ident(username), pw=_quote_literal(password)
                    )
                )
            )
            print(f"Created role {username}")
        else:
            print(f"Role {username} already exists")

        exists_db = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": dbname}
        ).scalar()
        if not exists_db:
            conn.execute(
                text(
                    "CREATE DATABASE {ident} OWNER {owner}".format(
                        ident=_quote_ident(dbname), owner=_quote_ident(username)
                    )
                )
            )
            print(f"Created database {dbname}")
        else:
            print(f"Database {dbname} already exists")

        try:
            conn.execute(
                text(
                    "GRANT ALL PRIVILEGES ON DATABASE {ident} TO {owner}".format(
                        ident=_quote_ident(dbname), owner=_quote_ident(username)
                    )
                )
            )
        except ProgrammingError:
            pass

    app = create_engine(database_url)
    with app.connect() as conn:
        db = conn.execute(text("SELECT current_database()")).scalar()
        print(f"App login OK — database={db}")


def main() -> None:
    from app.core.config import get_settings

    database_url = get_settings().database_url
    host = make_url(database_url).host or ""
    print(f"Target: {database_url.split('@')[-1].split('/')[0]}")

    if host in LOCAL_HOSTS:
        _create_local(database_url)
    else:
        print(f"Base distante ({host}) — création gérée côté serveur (Neon).")
        _verify_connection(database_url)


if __name__ == "__main__":
    main()
