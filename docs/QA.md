# QA — Sprint 9 (sans APK)

## Tests automatiques

```bash
# Backend
cd safedm-backend
.\.venv\Scripts\python.exe -m pytest -q
python scripts/smoke_integration.py

# Mobile
cd safedm-mobile
npm test

# Dashboard
cd safedm-dashboard
npm run build
```

## Checklist manuelle

### Backend
- [ ] `/api/v1/health` → 200
- [ ] Register / login JWT
- [ ] Analyse (demo mode) sans stocker le contenu
- [ ] Report create + list + withdraw
- [ ] Admin 403 pour non-admin, 200 pour admin

### Mobile
- [ ] Login / register contre API
- [ ] Analyse manuelle → résultat → signaler
- [ ] Guide + communauté chargés
- [ ] Signalements listables
- [ ] NLS : permission + alerte locale (device/émulateur)

### Dashboard
- [ ] Login admin uniquement
- [ ] Stats / menaces / users / guide CMS
- [ ] Bannière « API joignable »

## Hors scope de ce sprint

- **Génération APK** : reportée (à faire plus tard sur demande)
- Publication Play Store
- CI cloud complète
