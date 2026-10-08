# SafeDM — entraînement, canary, Firebase (plan opérationnel)

## Objectif

Boucle cohérente :

```text
Datasets (admin) → Job train → Métriques / logs → Patch signé → Canary → Approve
```

Sans Play Store pour l’instant : le **canary = % d’appareils** via `rollout_percentage`
côté API (déjà dans Opérations), pas via staged rollout Play.

## Ce qui existe / ce qu’on ajoute

| Pièce | Avant | Maintenant |
|-------|--------|------------|
| Train CLI | `make train` | + API admin + dataset custom |
| Dashboard | Approve / rollback patch | + page **Entraînement** (upload, runs, métriques) |
| Job | Cloud Scheduler / Cloud Run (doc GCP) | **GitHub Actions** `train-model.yml` + bouton admin (synchrone) |
| Canary | `patch_deployments.rollout_percentage` | inchangé (OK hors Play) |
| Firebase | — | migration **progressive** (ci-dessous) |

## Formats dataset

JSON liste d’objets (même contrat que `labeled_messages.json`) :

```json
[
  { "message": "…", "expected": "phishing" },
  { "message": "…", "expected": "legitimate" }
]
```

Labels bénins : `legitimate`, `benign_marketing`. Tout le reste → classe malveillante.

CSV accepté à l’upload : colonnes `message,expected`.

## Canary sans Play Store

1. Train → artefact + copie vers `MODEL_PATCH_MANIFEST_PATH`
2. Admin **Approuver** → `rollout_percentage` (ex. 5 %)
3. Mobile : OTA / manifest (quand clés publiques configurées) ; sinon modèle bundlé

Pas besoin de Play « staged rollout » tant que la distribution est APK / EAS.

## Job train sans Cloud Scheduler

- **Manuel** : dashboard → « Lancer l’entraînement » (API sync, datasets modestes)
- **CI** : `.github/workflows/train-model.yml` (`workflow_dispatch`) — idéal pour gros runs
- Plus tard : Cloud Run Job / Firebase Functions si vous migrez l’infra

## Firebase — migration progressive (recommandée)

Ne pas tout casser d’un coup. Ordre :

1. **Auth** — Firebase Auth (email) pour mobile + dashboard ; backend vérifie ID tokens  
2. **Storage** — datasets / artefacts TFLite dans Cloud Storage (remplace FS éphémère FastAPI Cloud)  
3. **FCM** — push alertes (optionnel)  
4. **Garder Postgres** pour menaces, reports, audit, patch_deployments (ou Cloud SQL)

Déjà branché (Auth d’abord, sans casser le JWT existant) :

```text
FIREBASE_PROJECT_ID=safedm-xxxxx
FIREBASE_ADMIN_EMAILS=toi@exemple.com
```

Mobile (`.env`, préfixe Expo) :

```text
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

`POST /api/v1/auth/firebase` `{ "id_token": "..." }` vérifie le jeton Google
(certificats publics, pas de JSON de compte de service) et renvoie le JWT SafeDM.
Le bouton « Connexion Firebase » n’apparaît que si ces variables sont définies.
Storage / FCM restent une étape suivante.

## Seuils « deployable »

Issue de `ml/models/training.py` : FPR ≤ 10 % et recall ≥ 60 % avec seuil opérationnel
mesuré hors-pli. Sinon statut `research` — canary possible seulement si vous forcez
(admin) ; le verdict reste affiché dans les métriques du run.
