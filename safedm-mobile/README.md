# SafeDM Mobile (Expo)

Application Android SafeDM — **Expo SDK 52** + React Navigation (écrans Sprint 5–7) + NotificationListenerService via config plugin.

> Le module NLS nécessite un **development build** (`expo run:android`). Expo Go ne suffit pas.

## Charte graphique

| Token | Valeur |
|-------|--------|
| Fond | `#FFFFFF` |
| Primaire | `#2F8AF2` |
| Badges risque | Élevé = noir, Moyen = bleu |
| Tabs | Accueil · Alertes · Signalements · Paramètres |

## Setup

```bash
cd safedm-mobile
npm install
copy .env.example .env
npx expo start
```

Build natif (émulateur / device) :

```bash
npx expo prebuild --platform android
npx expo run:android
```

Backend : `API_BASE_URL` dans `.env` (lu par `app.config.js`) puis API sur `:8000`.

Émulateur → `http://10.0.2.2:8000/api/v1`  
Device physique → IP LAN du PC.

## NotificationListener

1. Paramètres → **Accès notifications** → autoriser SafeDM  
2. Sources WhatsApp / SMS / Email  
3. Historique local 7 jours (Alertes)

Sources natives (prébuild) : `plugins/safedm-nls/` + `plugins/withSafeDMNotifications.js`.

## Structure

```text
App.jsx / index.js          # entrée Expo
src/screens/                # écrans conservés
src/navigation/
src/api/ src/services/
plugins/safedm-nls/         # Kotlin NLS + network security
plugins/withSafeDMNotifications.js
app.config.js
```

## Notes

- Clés Gemini / VirusTotal : jamais dans l’app  
- NLS ne bloque / ne modifie aucun message  
- Voir [`docs/INTEGRATION.md`](../docs/INTEGRATION.md)
