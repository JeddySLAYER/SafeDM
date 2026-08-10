# SafeDM

Application Android de cybersécurité qui détecte préventivement les messages suspects (WhatsApp, SMS, e-mails).

## Organisation — 3 projets distincts

| Projet | Techno | Langage |
|--------|--------|---------|
| [`safedm-backend`](./safedm-backend) | FastAPI + PostgreSQL + Alembic | Python |
| [`safedm-mobile`](./safedm-mobile) | React Native + Kotlin (NLS) | **JavaScript** |
| [`safedm-dashboard`](./safedm-dashboard) | React + Vite | **JavaScript** |

**Pas de Docker.** PostgreSQL s’installe en local. Fronts en JavaScript (pas TypeScript).

## Prérequis globaux

- Python 3.11+
- Node.js 18+
- PostgreSQL local
- Android Studio (pour le mobile)

## Démarrage rapide

### 1. Base de données

```sql
CREATE USER safedm WITH PASSWORD 'safedm';
CREATE DATABASE safedm OWNER safedm;
```

### 2. Backend

```bash
cd safedm-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. Dashboard admin

```bash
cd safedm-dashboard
npm install
copy .env.example .env
npm run dev
```

### 4. Mobile

```bash
cd safedm-mobile
npm install
npm start
npm run android
```

## Design system

- Bleu primaire : `#2F8AF2`
- Neutres : `#FFFFFF`, `#F7F9FC`, `#101828`
- Risque : Faible / Moyen / Élevé / Inconnu (voir tokens dans chaque front)

## Avancement sprints

| Sprint | Statut | Contenu |
|--------|--------|---------|
| S0–S3 | FAIT | Fondations, DB, auth JWT, pipeline analyse |
| S4 | FAIT | Reports, threats, guide, admin API |
| S5 | FAIT | Mobile : auth, nav, onboarding, monitoring |
| S6 | FAIT | NLS Android + bridge + UI charte maquettes |
| S7–S9 | À faire | Features mobile, dashboard, QA |

## Confidentialité

- Messages analysés **non stockés** sauf signalement explicite
- Clés Gemini / VirusTotal **uniquement** dans le backend
- API indisponible → `UNKNOWN` / `PARTIAL`, jamais `SAFE` par défaut
