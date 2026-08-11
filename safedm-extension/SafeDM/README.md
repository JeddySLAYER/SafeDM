# SafeDM — extension navigateur (MVP)

Extension Chrome MV3 pour analyser des **liens** et **textes** via l’API SafeDM.

## Fonctionnalités

- Popup : connexion (JWT) + analyse URL/texte
- Menu contextuel : **Vérifier avec SafeDM** (lien ou sélection) → bannière ALLOW / WARN / BLOCK
- Branding SafeDM (bleu `#1769d4`)

## Développement

```shell
cd safedm-extension/SafeDM
npm install
npm run dev
```

1. Ouvrir `chrome://extensions/`
2. Activer le mode développeur
3. **Charger l’extension non empaquetée** → dossier `dev/`

> Ne pas modifier le code entre `HMR-START` et `HMR-END` (rechargé auto en dev, retiré en build prod).

## Production

```shell
npm run build
```

Charger le dossier `build/` dans Chrome.

## API

Par défaut : `https://safedm-backend.onrender.com/api/v1`

Endpoints utilisés :

- `POST /auth/login`
- `POST /analysis`
- `POST /analysis/link` (puis `/analysis/url`, puis fallback message)

Pour un backend local : dans le popup → **API avancée** →  
`http://127.0.0.1:8000/api/v1`  
(ou stocker la clé `safedm_api_base` dans `chrome.storage.local`).

## Test rapide

1. Se connecter avec un compte SafeDM
2. Coller une URL → **Analyser**
3. Sur une page web : clic droit sur un lien → **Vérifier avec SafeDM**
4. Vérifier la bannière (vert / ambre / rouge)
