---
target: Extension SafeDM — popup
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/joan/Projects/SafeDM/safedm-extension/SafeDM/src/App.jsx"
target_fingerprint: "sha256:af9b99c8fd142a8ba501a8ede6c428ecae5383720c22b1c77bd5119c51c355e6"
target_path: /home/joan/Projects/SafeDM/safedm-extension/SafeDM/src/App.jsx
timestamp: 2026-10-19T14-58-50Z
slug: safedm-extension-safedm-src-app-jsx
---
# Critique Impeccable — Extension SafeDM (popup)

## Design Health Score

| # | Heuristique | Score | Notes |
|---|-------------|-------|-------|
| 1 | Visibilité de l'état | 3 | « Chargement… », « Connexion… », « Analyse… » et carte de résultat ; pas de squelette pour la liste. |
| 2 | Adéquation monde réel | 4 | Libellés clairs, plus d'anglicismes ni de tirets cadratins dans les verdicts. |
| 3 | Contrôle et liberté | 3 | Déconnexion et masquage de l'API, mais aucune annulation d'une analyse en cours. |
| 4 | Cohérence et standards | 4 | Tokens de couleur, boutons et champs homogènes. |
| 5 | Prévention des erreurs | 3 | Champs requis, URL API validée dans les paramètres. |
| 6 | Reconnaissance | 3 | Section « API avancée » repliable, champs étiquetés. |
| 7 | Flexibilité | 3 | Raccourci « URL de l'onglet » et point d'entrée API personnalisé. |
| 8 | Esthétique et minimalisme | 3 | Panneau court et lisible. |
| 9 | Récupération des erreurs | 4 | Messages d'échec humanisés, repli sur l'appel direct si la messagerie échoue. |
| 10 | Aide et documentation | 2 | Une seule astuce en pied ; pas d'aide sur les verdicts. |
| **Total** | | **32/40** | |

## Points forts
- Verdict affiché en carte colorée (Autorisé / Attention / Danger) au-dessus du formulaire.
- Repli automatique sur l'API depuis le popup si le service worker ne répond pas.
- Options API repliées par défaut, sans encombrer le parcours de connexion.

## Axes
- Annulation d'une analyse en cours (bouton « Stop » pendant « Analyse… »).
- Aide courte sur ce que signifient les verdicts et le score de risque.
