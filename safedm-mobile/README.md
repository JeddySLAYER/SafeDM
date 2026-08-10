# SafeDM Mobile

Application Android React Native (**JavaScript**) — charte UI maquettes SafeDM + NotificationListenerService (Sprint 6).

## Charte graphique (maquettes)

| Token | Valeur |
|-------|--------|
| Fond | `#FFFFFF` |
| Primaire | `#2F8AF2` |
| Texte | `#111111` / `#666666` |
| Boutons | pill (`borderRadius: 999`) |
| Badges risque | Élevé = noir, Moyen = bleu |
| Tabs | Accueil · Alertes · Signalements · Paramètres |

## Setup

```bash
cd safedm-mobile
npm install
copy .env.example .env
npm start
npm run android
```

Backend requis : `http://10.0.2.2:8000/api/v1` (émulateur).

## Sprint 6 — NotificationListener

1. Paramètres → **Accès notifications** → Autoriser SafeDM dans les réglages Android
2. Choisir WhatsApp / SMS / Email
3. Les notifications capturées alimentent l’historique local **7 jours** (Alertes)

### Natif Android

- `SafeDMNotificationListenerService` (Kotlin)
- Module RN `SafeDMNotifications` : statut accès, ouverture settings, packages surveillés, events `SafeDMNotification`

## Structure

```text
src/
├── api/
├── components/   # BrandMark, Button pill, TextField icônes, SettingRow…
├── context/
├── navigation/   # Auth + tabs maquette
├── screens/
├── services/     # notificationBridge, alertsStore
└── theme/tokens.js
android/.../notifications/   # NLS + bridge
```

## Notes

- Clés Gemini / VirusTotal : **jamais** dans l’app
- NLS ne bloque / ne modifie aucun message
- Analyse manuelle UI + guide + signalements API : Sprint 7
