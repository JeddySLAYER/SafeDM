# SafeDM Dashboard

Interface d'administration React (**JavaScript**) — Sprint 8.

## Setup

```bash
cd safedm-dashboard
npm install
copy .env.example .env
npm run dev
```

Ouvrir http://localhost:5173 — compte avec `is_admin=true`.

## Fonctionnalités

- Login admin JWT (refus si non admin)
- Stats (`GET /admin/stats`)
- Menaces (liste + changement de statut)
- Utilisateurs (`GET /admin/users`)
- Guide CMS (catégories / articles, publiés + brouillons)

## Stack

- React + Vite + react-router-dom
- Tokens `#2F8AF2`
- API : `VITE_API_BASE_URL` (défaut `http://localhost:8000/api/v1`)
