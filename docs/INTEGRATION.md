# Intégration API — SafeDM

Comment brancher **mobile** et **dashboard** sur le backend FastAPI.

## 1. Backend

```bash
cd safedm-backend
.\.venv\Scripts\Activate.ps1
copy .env.example .env   # si besoin
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health : http://127.0.0.1:8000/api/v1/health  
- Docs : http://127.0.0.1:8000/docs  

CORS autorise `localhost` / `127.0.0.1` ports **5173** et **3000**.

Smoke intégration :

```bash
python scripts/smoke_integration.py
```

Admin dashboard : promouvoir un user existant

```bash
python -m scripts.promote_admin mon_username
```

## 2. Dashboard → API

Fichier `.env` :

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

```bash
cd safedm-dashboard
npm install
npm run dev
```

La page login affiche **API : joignable / injoignable**.

## 3. Mobile → API

Fichier `.env` (lu via `react-native-dotenv`) :

```env
# Émulateur Android
API_BASE_URL=http://10.0.2.2:8000/api/v1

# Device physique (exemple)
# API_BASE_URL=http://192.168.1.20:8000/api/v1
```

Le backend doit écouter `0.0.0.0:8000`. Cleartext HTTP autorisé en dev (config plugin NLS + network security).

```bash
cd safedm-mobile
npm install
npx expo start
# Build natif (dev client, requis pour NLS) :
npx expo run:android
```

## 4. Endpoints utilisés

| Front | Endpoints |
|-------|-----------|
| Mobile | `/auth/*`, `/users/me*`, `/applications`, `/analysis`, `/reports`, `/threats/community`, `/guide/*` |
| Dashboard | `/auth/login`, `/admin/stats`, `/admin/users`, `/admin/threats`, `/admin/guide/*` |

## 5. Production

- Remplacer HTTP par **HTTPS**
- Restreindre `CORS_ORIGINS`
- `ANALYSIS_DEMO_MODE=false` + vraies clés Gemini/VT
- `SECRET_KEY` fort
- Voir `docs/SECURITY.md`
