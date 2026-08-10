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

Ou via script :

```bash
python scripts/ensure_database.py
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

## Migrations

```bash
# Créer la base PostgreSQL au préalable
alembic upgrade head
python -m scripts.seed_applications
python -m scripts.seed_guide
```

### Tables

| Table | Rôle |
|-------|------|
| `users` | Comptes (username unique, password_hash, is_admin) |
| `devices` | Appareils Android liés |
| `supported_applications` | WhatsApp / SMS / Email |
| `monitoring_preferences` | Choix de surveillance par user |
| `threats` | Menaces communautaires (contenu signalé) |
| `community_reports` | Signalements ACTIVE/WITHDRAWN |
| `threat_urls` | URLs extraites des menaces |
| `virustotal_scans` | Résultats VirusTotal |
| `guide_categories` | Catégories du guide |
| `guide_articles` | Articles du guide |

Aucune table d'historique d'analyses : les messages non signalés ne sont pas stockés.

## Pipeline d'analyse (Sprint 3)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/analysis` | Analyse un message (JWT). Contenu **non stocké**. |

Pipeline : hash → lookup communauté → Gemini → extraction URLs → VirusTotal → fusion.

Statuts : `SAFE` | `SUSPICIOUS` | `DANGEROUS` | `UNKNOWN` | `PARTIAL` | `INSUFFICIENT_CONTENT`.

Si Gemini ou VirusTotal est indisponible, le résultat est `UNKNOWN`/`PARTIAL` — **jamais** `SAFE` par défaut.

### Mode démo local

Sans clés API, activer dans `.env` :

```env
ANALYSIS_DEMO_MODE=true
```

Cela simule Gemini/VirusTotal pour valider le pipeline en local. Mettre `false` dès que les vraies clés sont configurées.

### Smoke test

```bash
uvicorn app.main:app --reload --port 8000
python scripts/smoke_analysis.py
```

## Auth & profil (Sprint 2)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/auth/register` | Inscription |
| POST | `/api/v1/auth/login` | Connexion JWT |
| GET | `/api/v1/users/me` | Profil |
| PUT | `/api/v1/users/me` | Changer le mot de passe |
| GET/POST | `/api/v1/users/me/devices` | Appareils Android |
| GET/PUT | `/api/v1/users/me/monitoring` | Préférences de surveillance |
| GET | `/api/v1/applications` | Apps supportées (WhatsApp/SMS/Email) |

## Communauté, guide & admin (Sprint 4)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/reports` | Signaler un message (contenu alors conservé) |
| DELETE | `/api/v1/reports/{id}` | Retirer son signalement |
| GET | `/api/v1/threats/community` | Menaces communautaires actives |
| GET | `/api/v1/threats/{hash}` | Menace par hash |
| GET | `/api/v1/guide/categories` | Catégories + articles publiés |
| GET | `/api/v1/guide/articles/{id}` | Article publié |
| GET | `/api/v1/admin/stats` | Stats admin (JWT admin) |
| GET | `/api/v1/admin/threats` | Liste menaces admin |
| PUT | `/api/v1/admin/threats/{id}/status` | Modérer une menace |
| PUT/DELETE | `/api/v1/admin/guide/...` | CMS guide (catégories + articles) |


## Sécurité

- Les clés `GEMINI_API_KEY` et `VIRUSTOTAL_API_KEY` restent **uniquement** dans `.env` backend.
- Ne jamais logger le contenu des messages analysés.
