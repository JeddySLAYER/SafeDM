# Déployer le backend sur FastAPI Cloud

URL de prod actuelle (mobile) : `https://safedm-backend.fastapicloud.dev/api/v1`

## 0. Secrets GitHub (checklist)

| Secret | Où le prendre | Obligatoire pour |
|--------|---------------|------------------|
| `FASTAPI_CLOUD_TOKEN` | Dashboard app → **Deploy Tokens** → Create | Deploy backend |
| `FASTAPI_CLOUD_APP_ID` | UUID à côté du nom de l’app (bouton copy) | Deploy backend |
| `EXPO_TOKEN` | https://expo.dev/settings/access-tokens | Build APK mobile |

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

Sans ces secrets, les workflows échouent tout de suite avec un message clair.

## 1. Première fois (local, une seule fois)

```bash
cd safedm-backend
uv sync
uv run fastapi login
# Lie / crée l’app (génère .fastapicloud/ — ne pas committer le token)
uv run fastapi deploy
```

Puis dans le dashboard FastAPI Cloud :

1. **Variables d’environnement** de l’app (au minimum) :
   - `SECRET_KEY` — long et aléatoire
   - `DATABASE_URL` — Neon ou Postgres hébergé (`sslmode=require`)
   - `APP_ENV=production`
   - `DEBUG=false`
   - `ANALYSIS_DEMO_MODE=false`
   - `CORS_ORIGINS` — domaines dashboard + éventuel web
   - `TYPESAFE_API_KEY` / `VIRUSTOTAL_API_KEY` si utilisés
2. **Deploy Tokens** → Create → copier la valeur
3. Copier l’**App ID** (UUID)

Ajouter les deux secrets GitHub listés plus haut.

Migrations après le 1er deploy (selon ce que Cloud expose) :

```bash
# Depuis une machine avec DATABASE_URL de prod
cd safedm-backend
DATABASE_URL='postgresql+psycopg2://…?sslmode=require' uv run alembic upgrade head
```

(Ou job one-shot / console Cloud si disponible.)

## 2. Déploiements suivants (GitHub Actions)

Workflow : `.github/workflows/deploy-fastapi-cloud.yml`

**Ordre important :** d’abord un `fastapi deploy` local (section 1) pour créer
l’app + App ID + Deploy Token, **puis** les secrets GitHub, **puis** Actions.

- **Manuel** : Actions → **Deploy FastAPI Cloud** → Run workflow  
  (le trigger auto sur `main` est commenté jusqu’à ce que les secrets existent —
  décommente le bloc `push:` dans le workflow quand tu es prêt)

Équivalent local :

```bash
cd safedm-backend
export FASTAPI_CLOUD_TOKEN=…
export FASTAPI_CLOUD_APP_ID=…
uv run fastapi deploy --app-id "$FASTAPI_CLOUD_APP_ID"
```

Helper CLI (si déjà loggé et app liée) :

```bash
cd safedm-backend
uv run fastapi cloud setup-ci --secrets-only   # pousse les secrets via gh
```

## 3. Vérifier le déploiement

```bash
curl -sS https://safedm-backend.fastapicloud.dev/api/v1/health
# optionnel ready :
curl -sS https://safedm-backend.fastapicloud.dev/api/v1/health/ready
```

Mobile : `API_BASE_URL` dans `.env` / EAS doit pointer vers cette URL `/api/v1`.

## 4. Logs

```bash
cd safedm-backend
uv run fastapi cloud logs
```

## Voir aussi

- [docs/MOBILE_CI.md](./MOBILE_CI.md) — APK EAS / `EXPO_TOKEN`
- [docs/PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) — variante Cloud Run (GCP)
