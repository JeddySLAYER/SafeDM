# SafeDM Mobile — CI & APK versionnés

## Secrets GitHub

Dans le dépôt → **Settings → Secrets and variables → Actions** :

| Secret | Rôle |
|--------|------|
| `EXPO_TOKEN` | Token Expo (https://expo.dev/settings/access-tokens) pour EAS Build — **déjà requis pour l’APK** |
| `FASTAPI_CLOUD_TOKEN` | Deploy backend (optionnel tant que le deploy GitHub est manuel) |
| `FASTAPI_CLOUD_APP_ID` | UUID app FastAPI Cloud (idem) |

Clés mobile **optionnelles** (soft-fail si absentes) — pas des secrets GitHub :
`FINGERPRINT_PUBLIC_KEY`, `MODEL_MANIFEST_PUBLIC_KEY` dans `.env` / EAS env.

Runtime mobile : **TFLite** (`react-native-fast-tflite` + `assets/models/safedm_v3.tflite`) = chemin officiel.  
FastText Kotlin reste dans `plugins/` pour parity/tests mais **n’est pas copié dans l’APK**.

Sans `EXPO_TOKEN`, le workflow `mobile-apk.yml` échoue immédiatement.  
`ci.yml` (lint/tests) reste indépendant.

## Workflows

| Fichier | Quand | Effet |
|---------|-------|--------|
| `.github/workflows/ci.yml` | PR / push | Tests backend (Postgres service) + tests mobile |
| `.github/workflows/mobile-apk.yml` | tag `mobile-v*` ou manuel | Build EAS APK + **GitHub Release** |
| `.github/workflows/deploy-fastapi-cloud.yml` | push `main` (backend) ou manuel | Deploy FastAPI Cloud |

## Publier un APK versionné

1. Ajouter le secret `EXPO_TOKEN`
2. Puis :

```bash
git tag mobile-v1.1.0
git push origin mobile-v1.1.0
```

Ou **Actions → Mobile APK (EAS) → Run workflow** et saisir la version.

L’APK apparaît dans **Releases** : `SafeDM-1.1.0.apk`.

## Build local (sans CI)

```bash
cd safedm-mobile
npx eas login
APP_ENV=production npx eas build --platform android --profile preview
```

Dev client (NLS) :

```bash
npx expo prebuild --platform android
npx expo run:android
```

## Profils EAS

- `development` — APK + expo-dev-client
- `preview` / `apk` — APK interne (CI), cleartext désactivé
- `production` — AAB Play Store
