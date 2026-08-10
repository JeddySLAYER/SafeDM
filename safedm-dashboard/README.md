# SafeDM Dashboard

Interface d'administration React (JavaScript) pour SafeDM.

## Prérequis

- Node.js 18+
- Backend FastAPI démarré (port 8000 par défaut)

## Setup

```bash
cd safedm-dashboard
npm install
copy .env.example .env
npm run dev
```

Ouvrir http://localhost:5173

## Stack

- React + Vite
- **JavaScript uniquement** (pas de TypeScript)
- Tokens couleurs : `src/styles/tokens.css` et `src/theme/tokens.js`

## Structure (cible)

```text
src/
├── components/
├── pages/          # Sprint 8
├── services/       # client API
├── styles/
├── theme/
└── App.jsx
```
