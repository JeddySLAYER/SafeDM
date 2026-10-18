---
target: SafeDM Mobile App
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:/home/joan/Projects/SafeDM/safedm-mobile/src/App.jsx"
timestamp: 2026-10-18T16-10-18Z
slug: safedm-mobile-src-app-jsx
---
# Critique Impeccable — App Mobile (SafeDM)

## Aperçu
Application mobile Expo/React Native (RN 0.76, Expo 52). Architecture modulaire (screens, components, services, api). Tests 17/17 passés, lint OK.

## Design Health Score (10 heuristiques × 4 = 40)

| # | Heuristique | Score | Notes |
|---|-------------|-------|-------|
| 1 | Visibilité de l'état du système | 3 | SplashScreen gérée, StatusBar, OfflineBanner présent. Manque d'indicateurs d'état de chargement globaux, toasts peu visibles. |
| 2 | Adéquation système / monde réel | 3 | Terminologie cohérente (menace, signalement). Navigation tab+stack. Quelques libellés techniques. |
| 3 | Contrôle et liberté de l'utilisateur | 3 | Navigation retour possible. Pas d'annulation claire sur actions longues. |
| 4 | Cohérence et standards | 3 | Tokens dans src/theme/tokens.js, composants réutilisables. Style non entièrement unifié. |
| 5 | Prévention des erreurs | 2 | Validation basique, try/catch présent. Messages d'erreur souvent techniques. |
| 6 | Reconnaissance plutôt que rappel | 3 | UI guidée, icônes. Peut réduire charge cognitive. |
| 7 | Flexibilité et efficacité | 2 | UX mobile basique, pas de raccourcis. |
| 8 | Esthétique et design minimaliste | 3 | Thème sobre, composants propres. Espacements irréguliers possibles. |
| 9 | Récupération après erreur | 2 | Gestion erreurs API présente mais messages peu conviviaux. Pas de retry systématique. |
| 10 | Aide et documentation | 3 | Guide intégré (GuideScreen). Peu d'aide contextuelle inline. |
| **Total** | | **27/40** | |

## Problèmes identifiés

### P0/P1
- Messages d'erreur API bruts → non conviviaux (UX)
- Pas de retry systématique sur erreurs réseau (resilience)

### P2
- Accessibilité (touch targets, contraste) non systématique
- Espacements/paddings variables entre écrans
- Gestion offline limitée

## Recommandations
- Uniformiser erreurs avec messages humains
- Ajouter retry sur requêtes critiques
- Auditer accessibilité (axe) et cohérence spacing
