# SafeDM Backend

API FastAPI pour SafeDM — analyse de messages suspects (Gemini + VirusTotal), authentification, signalements communautaires et guide CMS.

## Prérequis

- Python 3.11+
- PostgreSQL installé **en local** (pas de Docker)

## Installation PostgreSQL (Windows)

1. Installer PostgreSQL depuis https://www.postgresql.org/download/windows/
2. Créer un utilisateur et une base :

```sql
CREATE USER safedm WITH PASSWORD 'safedm';
CREATE DATABASE safedm OWNER safedm;
```

## Setup

```bash
cd safedm-backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
copy .env.example .env
# Éditer .env (DATABASE_URL, SECRET_KEY, clés API)
```

## Lancer l’API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Docs : http://localhost:8000/docs
- Health : http://localhost:8000/api/v1/health

## Migrations (Sprint 1+)

```bash
alembic upgrade head
```

## Tests

```bash
pytest
```

## Structure

```text
app/
├── api/           # Endpoints HTTP
├── core/          # Config, DB, sécurité
├── models/        # SQLAlchemy (Sprint 1)
├── schemas/       # Pydantic
├── repositories/  # Accès BDD
├── services/      # Logique métier
└── main.py
```

## Sécurité

- Les clés `GEMINI_API_KEY` et `VIRUSTOTAL_API_KEY` restent **uniquement** dans `.env` backend.
- Ne jamais logger le contenu des messages analysés.
