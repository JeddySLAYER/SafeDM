# SafeDM Mobile

Application Android React Native (**JavaScript**, pas TypeScript) pour SafeDM.

## Prérequis

- Node.js 18+
- JDK 17
- Android Studio (SDK + émulateur ou appareil)
- Backend FastAPI démarré

## Setup

```bash
cd safedm-mobile
npm install
copy .env.example .env
npm start
# Autre terminal :
npm run android
```

## Structure (cible)

```text
src/
├── screens/       # Sprint 5–7
├── components/
├── services/      # client API
├── store/
├── navigation/
├── hooks/
├── theme/         # tokens SafeDM
└── utils/
android/           # NotificationListenerService (Sprint 6, Kotlin)
```

## Notes

- iOS hors périmètre MVP (dossier `ios/` généré par le template, non utilisé).
- Clés Gemini / VirusTotal : **jamais** dans cette app.
- Historique alertes : local, 7 jours (Sprint 7).
