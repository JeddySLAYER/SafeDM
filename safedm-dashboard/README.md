# SafeDM Dashboard

Interface d'administration React (**JavaScript**) — Sprint 8.

## Setup

```bash
cd safedm-dashboard
npm install
copy .env.example .env
npm run dev
```

Ouvrir http://127.0.0.1:5173 — compte avec `is_admin=true`.

En dev, Vite proxy `/api` → `http://127.0.0.1:8000` (évite les soucis CORS `localhost` vs `127.0.0.1`).

## Fonctionnalités

- Login admin JWT (refus si non admin)
- Stats (`GET /admin/stats`)
- Menaces (liste + changement de statut)
- Utilisateurs (`GET /admin/users`)
- Guide CMS plein écran (rédaction, aperçu, organisation et publication)
- Operations (état du pipeline, seuils globaux, demandes d'agrégation, déploiements et audit)
- Sheets d'aide contextuelle pour expliquer chaque page et chaque action
- Formulaires avec états de chargement, validation et présentation mobile

## Stack

- React + Vite + react-router-dom
- Tokens `#2F8AF2`
- API : `VITE_API_BASE_URL` (défaut `/api/v1` via proxy Vite)
