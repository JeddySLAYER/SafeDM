# SafeDM

Application Android de cybersécurité qui détecte préventivement les messages suspects (WhatsApp, SMS, e-mails).

## Organisation — 3 projets distincts

| Projet | Techno | Langage |
|--------|--------|---------|
| [`safedm-backend`](./safedm-backend) | FastAPI + PostgreSQL + Alembic | Python |
| [`safedm-mobile`](./safedm-mobile) | Expo (SDK 52) + Kotlin NLS | **JavaScript** |
| [`safedm-dashboard`](./safedm-dashboard) | React + Vite | **JavaScript** |

**Pas de Docker.** PostgreSQL local. Fronts en JavaScript.

## Docs

- [Intégration API](./docs/INTEGRATION.md)
- [Sécurité](./docs/SECURITY.md)
- [QA Sprint 9](./docs/QA.md)

## Avancement sprints

| Sprint | Statut | Contenu |
|--------|--------|---------|
| S0–S3 | FAIT | Fondations, DB, auth, pipeline analyse |
| S4 | FAIT | Reports, threats, guide, admin API |
| S5–S6 | FAIT | Mobile auth/UI + NotificationListener |
| S7 | FAIT | Analyse, résultat, communauté, guide, signalements |
| S8 | FAIT | Dashboard admin |
| S9 | FAIT* | QA + docs + hardening (**APK non généré**) |

## Démarrage rapide

### Backend

```bash
cd safedm-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Dashboard

```bash
cd safedm-dashboard
npm install
copy .env.example .env
npm run dev
```

### Mobile

```bash
cd safedm-mobile
npm install
copy .env.example .env
npx expo start
# Dev client requis pour le NotificationListener :
npx expo run:android
```

Admin dashboard : `python -m scripts.promote_admin <username>` depuis `safedm-backend`.

## Design

- Bleu primaire : `#2F8AF2`
- Badges risque : Élevé = noir, Moyen = bleu

## Confidentialité

- Messages analysés **non stockés** sauf signalement explicite
- Clés Gemini / VirusTotal **uniquement** backend
- API indisponible → `UNKNOWN` / `PARTIAL`, jamais `SAFE` par défaut
