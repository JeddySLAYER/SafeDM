# Déployer le backend sur FastAPI Cloud

URL de prod actuelle (mobile) : `https://safedmnew-back.fastapicloud.dev/api/v1`

## 0. Secrets GitHub (checklist)

| Secret | Où le prendre | Obligatoire pour |
|--------|---------------|------------------|
| `FASTAPI_CLOUD_TOKEN` | Dashboard app → **Deploy Tokens** → Create | Deploy backend |
| `FASTAPI_CLOUD_APP_ID` | UUID à côté du nom de l’app (bouton copy) | Deploy backend |
| `DATABASE_URL` | Dashboard app → **Environment Variables** → `DATABASE_URL` | Migrations **et** scripts en prod |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | à choisir | Créer le compte admin en prod |
| `ML_PATCH_SIGNING_PRIVATE_KEY_PEM_B64` | `safedm-backend/.env` (clé privée OTA) | Signature des patchs OTA |
| `MODEL_PATCH_PUBLIC_KEY_HEX` | clé publique dérivée de la précédente | Vérification OTA côté mobile |
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
curl -sS https://safedmnew-back.fastapicloud.dev/api/v1/health
# optionnel ready :
curl -sS https://safedmnew-back.fastapicloud.dev/api/v1/health/ready
```

Mobile : `API_BASE_URL` dans `.env` / profils EAS (`preview`/`apk`/`production`)
pointe déjà vers cette URL `/api/v1`.

## 4. Compte administrateur (dashboard)

Le dashboard n'accepte que les comptes **admin** : `AuthContext` calcule
`isAuthenticated = token && user.is_admin`. Un compte non-admin est
connecté côté API puis renvoyé vers `/login` par `Protected` — ce qui ressemble
à un refus d'identifiants.

La base de production est **distincte** de la base locale
(`localhost:55432/safedm`) : les identifiants qui marchent en local n'existent
pas en prod. Il faut créer le compte dans la base de prod :

```bash
cd safedm-backend
DATABASE_URL='postgresql+psycopg2://…?sslmode=require' \
  uv run python -m scripts.seed_admin <username> <password>
# ou, si le compte existe déjà et n'est pas admin :
DATABASE_URL='postgresql+psycopg2://…?sslmode=require' \
  uv run python -m scripts.promote_admin <username>
```

La même opération est disponible en CI : section 5.

## 5. Exécuter un script en production

### Par la CI (recommandé)

Workflow : `.github/workflows/run-script.yml`
Actions → **Run backend script (production)** → Run workflow.

| Input | Rôle |
|---|---|
| `script` | `prod_bootstrap_admin`, `seed_admin`, `promote_admin`, `seed_applications`, `seed_guide`, `verify_schema`, `purge_inactive_fingerprints` |
| `args` | arguments optionnels (ex. `promote_admin` → nom d'utilisateur) |

`prod_bootstrap_admin` est le point d'entrée recommandé la première fois :
il crée le compte admin dans la base de prod **et** vérifie que l'API de prod
accepte la connexion (`GET /admin/stats` en 200). Si le job passe, le
dashboard en ligne accepte ces identifiants.

Le script est résolu depuis une **allowlist** : aucun module arbitraire ne peut
être exécuté, et les arguments sont validés avant d'être transmis.

Prérequis : le secret `DATABASE_URL` doit contenir l'URL Postgres de prod, et
`ADMIN_USERNAME` / `ADMIN_PASSWORD` pour `prod_bootstrap_admin` et `seed_admin`.

### En local

```bash
cd safedm-backend
export DATABASE_URL='postgresql+psycopg2://…?sslmode=require'
export ADMIN_USERNAME='admin'
export ADMIN_PASSWORD='…'
./scripts/prod_bootstrap_admin.sh   # crée + vérifie
```

Ou, via le Makefile (mêmes scripts, même allowlist que la CI) :

```bash
make scripts                                  # lister les scripts
make run-script SCRIPT=verify_schema
make run-script SCRIPT=seed_admin ARGS="admin <mot-de-passe>"
```

`make run-script` refuse tout nom hors allowlist.

## 6. Logs

```bash
cd safedm-backend
uv run fastapi cloud logs
```

## Voir aussi

- [docs/MOBILE_CI.md](./MOBILE_CI.md) — APK EAS / `EXPO_TOKEN`
- [docs/PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) — variante Cloud Run (GCP)
