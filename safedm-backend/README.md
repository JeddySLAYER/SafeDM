# SafeDM Backend

API FastAPI pour SafeDM — analyse de messages suspects (Jev + VirusTotal), authentification, signalements communautaires et guide CMS.

## Prérequis

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) pour la gestion des dépendances
- Base PostgreSQL : **Neon** (recommandé) ou **Docker** ou PostgreSQL local

## Base de données

### Neon (hébergé, recommandé pour le partage)

1. Créer un projet sur https://neon.tech
2. Copier la connection string **« pooled »** (l'hôte contient `-pooler`).
3. La coller dans `DATABASE_URL` dans `.env` (garder `sslmode=require`).
4. Vérifier la connexion puis appliquer les migrations :

```bash
uv sync
uv run python scripts/ensure_database.py        # vérifie la connexion à Neon
uv run alembic upgrade head
uv run python -m scripts.seed_applications
uv run python -m scripts.seed_guide
```

> Si psycopg2 signale une erreur sur `channel_binding=require`, retirer uniquement ce paramètre de l'URL (garder `sslmode=require`).

### Docker (recommandé en dev)

```bash
docker compose up -d          # démarre sur le port 55432
docker compose ps             # attendre "healthy"
docker compose psql           # shell SQL
docker compose down -v        # arrêter et effacer les données
```

Puis dans `.env`, commenter la ligne Neon et décommenter celle du conteneur :

```env
DATABASE_URL=postgresql+psycopg2://safedm:safedm@localhost:55432/safedm
```

```bash
uv run alembic upgrade head
```

### PostgreSQL local (alternative, dev)

1. Installer PostgreSQL depuis https://www.postgresql.org/download/
2. Créer un utilisateur et une base :

```sql
CREATE USER safedm WITH PASSWORD 'safedm';
CREATE DATABASE safedm OWNER safedm;
```

Ou via script :

```bash
uv run python scripts/ensure_database.py
```

Puis les migrations :

```bash
uv run alembic upgrade head
```

> `scripts/create_database.sql` est réservé au PostgreSQL local (Neon gère la création côté serveur).

## Setup

```bash
cd safedm-backend
uv sync

cp .env.example .env
# Éditer .env (DATABASE_URL, SECRET_KEY, clés API)
```

## Lancer l’API

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Docs : http://localhost:8000/docs
- Health : http://localhost:8000/api/v1/health

## Migrations

```bash
# Base prête (Neon ou local) — voir « Base de données »
uv run alembic upgrade head
uv run python -m scripts.seed_applications
uv run python -m scripts.seed_guide
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

Pipeline : hash → lookup communauté → extraction URLs → Jev → VirusTotal → fusion.

Jev reçoit les URLs déjà extraites dans `state`, ce qui évite un second aller-retour.
Cinq questions en un seul appel : `verdict` (Choice), `urgency` (Score) et
`credential_request` / `sensitive_data_request` / `link_deception` (trois Noul).
Le score de risque est la somme des probabilités de verdicts malveillants, pas un entier inventé.
`confidence` est la dispersion de la distribution du verdict : c'est ce qui permet le
routage V2. En dessous de `0.40`, un verdict SAFE est dégradé en `PARTIAL` — un juge
incertain ne réhabilite jamais un message.

Statuts : `SAFE` | `SUSPICIOUS` | `DANGEROUS` | `UNKNOWN` | `PARTIAL` | `INSUFFICIENT_CONTENT`.

Si Jev ou VirusTotal est indisponible, le résultat est `UNKNOWN`/`PARTIAL` — **jamais** `SAFE` par défaut.

### Mode démo local

Sans clés API, activer dans `.env` :

```env
ANALYSIS_DEMO_MODE=true
```

Cela simule Jev/VirusTotal pour valider le pipeline en local. Mettre `false` dès que les vraies clés sont configurées.

### Smoke test

```bash
uv run uvicorn app.main:app --reload --port 8000
uv run python scripts/smoke_analysis.py
```

### Benchmark qualité Jev (Sprint 10)

Mesure la qualité réelle du juge sur 28 SMS français/togolais étiquetés, avant
de figer les seuils ou le schéma de features.

```bash
python scripts/benchmark_jev.py --out /tmp/jev_benchmark.json
```

Résultat mesuré le 2026-10-02 (`jev-latest`) :

| Métrique | Valeur |
|----------|--------|
| Exactitude du verdict | 16/28 |
| Menaces détectées (recall) | 17/17 — 100% |
| Précision | 17/17 — 100% |
| Faux positifs | 0 |
| Score malveillants | min 83, moyenne 98 |
| Score bénins | max 39, moyenne 9 |
| Latence médiane | ~324 ms (1 appel, 5 questions) |

11 des 12 écarts de verdict sont de la **confusion de taxonomie**
(`phishing` ↔ `scam_financial` ↔ `social_engineering`) : les trois classes
déclenchent la même action utilisateur et toutes les deux produisent un score
~100. Pour SafeDM, ce sont une seule et même classe « menace ».

La réécriture des questions Noul (frontières négatives explicites : *afficher*
un OTP n'est pas *demander* un OTP) a fait passer la précision de 85% à 100% et
la marge de séparation de 30 à 44 points. Voir `scripts/ab_jev_questions.py`.

Les tests de non-régression contre l'API sont marqués `jev_benchmark`, donc
**exclus par défaut** (ils consomment des crédits) :

```bash
python -m pytest tests/test_jev_benchmark.py -q -m jev_benchmark
```

La baseline figée est dans `tests/fixtures/jev_benchmark_baseline.json`.

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
| GET | `/api/v1/reports` | Mes signalements (JWT) |
| POST | `/api/v1/reports` | Signaler un message (contenu alors conservé) |
| DELETE | `/api/v1/reports/{id}` | Retirer son signalement |
| GET | `/api/v1/threats/community` | Menaces communautaires actives |
| GET | `/api/v1/threats/{hash}` | Menace par hash |
| GET | `/api/v1/guide/categories` | Catégories + articles publiés |
| GET | `/api/v1/guide/articles/{id}` | Article publié |
| GET | `/api/v1/admin/stats` | Stats admin (JWT admin) |
| GET | `/api/v1/admin/users` | Liste utilisateurs |
| GET | `/api/v1/admin/threats` | Liste menaces admin |
| PUT | `/api/v1/admin/threats/{id}/status` | Modérer une menace |
| GET | `/api/v1/admin/guide/categories` | Guide admin (incl. brouillons) |
| PUT/DELETE | `/api/v1/admin/guide/...` | CMS guide (catégories + articles) |


## Sécurité

- Les clés `GEMINI_API_KEY` et `VIRUSTOTAL_API_KEY` restent **uniquement** dans `.env` backend.
- Ne jamais logger le contenu des messages analysés.
