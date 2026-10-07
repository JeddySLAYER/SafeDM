# SafeDM Mobile — CI & APK versionnés

## Secrets GitHub

Dans le dépôt → **Settings → Secrets and variables → Actions** :

| Secret | Rôle |
|--------|------|
| `EXPO_TOKEN` | Token Expo (account → Access tokens) pour EAS Build |

Sans `EXPO_TOKEN`, le workflow `mobile-apk.yml` échoue ; le workflow `ci.yml` (lint/tests) reste indépendant.

## Workflows

| Fichier | Quand | Effet |
|---------|-------|--------|
| `.github/workflows/ci.yml` | PR / push | Tests backend + lint/tests mobile |
| `.github/workflows/mobile-apk.yml` | tag `mobile-v*` ou manuel | Build EAS APK + **GitHub Release** avec l’APK |

## Publier un APK versionné

```bash
# 1. Bump version dans safedm-mobile/package.json (et éventuellement app.config)
# 2. Commit
git tag mobile-v1.0.1
git push origin mobile-v1.0.1
```

Ou **Actions → Mobile APK (EAS) → Run workflow** et saisir la version.

L’APK apparaît dans **Releases** : `SafeDM-1.0.1.apk`.

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
