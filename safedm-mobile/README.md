# SafeDM Mobile (Expo)

Application Android SafeDM — **Expo SDK 52** + NotificationListenerService.

> NLS = **development build** (`expo run:android` / EAS). Expo Go ne suffit pas.

## Setup

```bash
cd safedm-mobile
npm install
cp .env.example .env
npx expo start
```

Natif :

```bash
npx expo prebuild --platform android
npx expo run:android
```

## APK versionné (CI)

Voir [`docs/MOBILE_CI.md`](../docs/MOBILE_CI.md).

```bash
git tag mobile-v1.0.1 && git push origin mobile-v1.0.1
# → GitHub Release + SafeDM-1.0.1.apk (secret EXPO_TOKEN requis)
```

Local EAS :

```bash
APP_ENV=production npx eas build -p android --profile preview
```

## Onboarding (Sprint 15)

1. Apps surveillées (sync native même si API down)  
2. Accès notifications  
3. Batterie / OEM  
4. Protection des liens (ou collage / Partager)

## Structure

```text
src/
  screens/     # UI (Welcome, Home, Alerts, Permissions, Battery, Diagnostics…)
  services/    # NLS bridge, TFLite, alerts
  api/ theme/ utils/ components/ navigation/ context/
plugins/safedm-nls/   # Kotlin (sans FastText / *Check.kt dans l’APK)
```

## Confidentialité

- JWT : SecureStore  
- Alertes : stockage local 7 j (masquable / effaçable)  
- Cloud : opt-in Paramètres  

## Runtime ML

**Un seul chemin :** features natives → TFLite bundle (`assets/models/safedm_v3.tflite`).
