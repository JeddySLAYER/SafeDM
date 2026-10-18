---
target: TrainingPage + detail pages (menace/signalement) + shell
total_score: 38
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/joan/Projects/SafeDM/safedm-dashboard/src/pages/TrainingPage.jsx"
target_fingerprint: "sha256:3d95e1f9c0024a7f236d4dea54c3536198c41bdcb6f8bf0539a07be73efe62f3"
target_path: /home/joan/Projects/SafeDM/safedm-dashboard/src/pages/TrainingPage.jsx
timestamp: 2026-10-18T15-49-27Z
slug: safedm-dashboard-src-pages-trainingpage-jsx
---
# Critique Impeccable — Pages détail (menace, signalement) + récupération d'erreurs

> 4ᵉ passe. Référence : `2026-10-18T15-05-56Z` (35/40), `2026-10-18T15-25-38Z` (37/40). Cible : ThreatDetailPage (fiche menace) + ReportsPage (fiche signalement) + shell.

## Design Health Score (Nielsen, Operate mode — 10/10 applicables)

| # | Heuristique | Avant | Après | Problème clé restant |
|---|-------------|-------|-------|----------------------|
| 1 | Visibilité de l'état | 4 | 4 | Bandeau « Prochaine étape » **cliquable**, badge d'état par onglet, marqueur « Tests » **persisté** (survit au reload). Reste : pas de progression live d'un entraînement. |
| 2 | Adéquation au monde réel | 4 | 4 | Glossaire, seuils rappel ≥ 60 % / FP ≤ 10 %, canary/publiable. |
| 3 | Contrôle et liberté | 4 | 4 | URL state ; **Réessayer** sur échec de chargement des fiches. Pas d'annulation de run. |
| 4 | Cohérence et standards | 4 | 4 | Une seule grammaire de surfaces ; boîtes « libellé/valeur » unifiées (`--bg`, radius-md) ; messages unifiés ; rythme identique dans toutes les fiches ; alertes sémantiques (info / warn / error) ; états désactivés homogènes. |
| 5 | Prévention des erreurs | 3 | 3 | ConfirmDialogs ; `datasetId` par défaut toujours silencieux. |
| 6 | Reconnaissance plutôt que rappel | 4 | 4 | Stepper supprimé, onglets porteurs d'état, étape suivante actionnable. |
| 7 | Flexibilité et efficacité | 4 | 4 | Nav regroupée + scrollable ; palette Ctrl+K navigation seule. |
| 8 | Esthétique et minimalisme | 4 | 4 | Fiches détail au rythme régulier (16 px), plus de pavé gris, plus de double bordure. |
| 9 | Récupération après erreur | 2 | 3 | Messages API traduits (réseau / 5xx / 401 / 403 / 404), `role="alert"`, bouton Réessayer. Reste : pas de guidage inline dans l'import ni de validation par champ. |
| 10 | Aide et documentation | 4 | 4 | Aide par route, définitions inline. |
| **Total** | | **37/40** | **38/40** | **Excellent — quelques finitions ciblées** |

## Verdict de spécificité design

**Fortement ancré SafeDM.** Le parcours encodé (rappel ≥ 60 %, FP ≤ 10 %), la sémantique canary et la distinction revue/promotion restent partout. Poche résiduelle : les 6 cartes métriques (vocabulaire classifieur binaire standard).

## Scan déterministe (Assessment B)

- `impeccable detect --json safedm-dashboard/src` → **[] (0 finding)**
- Build OK, lint = 3 avertissements préexistants.
- Tous les transforms Vite des pages touchées = 200.

## Ce qui a changé dans cette passe

### Pages détail — layout / paddings / positionnement
1. **Fiche menace** : `.threat-detail-page` devient une grille `gap:16`. Avant, aucun rythme : le panneau « URLs associées » **touchait** la grille de modération (0 px). Marges propres des enfants neutralisées pour éviter le double espacement header/alerte.
2. **Rythme des fiches (sheet)** : `.detail-sheet-body` devient une grille `gap:16` avec marges enfants neutralisées → le panneau Signalement, le panneau Annotation, la fiche utilisateur, les fiches app/run et les fiches menace partagent **une seule cadence**.
3. **En-tête de fiche collant** : le `DetailSheet` passe en colonne flex ; l'en-tête (titre + bouton Fermer) **reste visible** pendant que le corps défile.
4. **Onglets de la fiche signalement** : `Annotation` était une carte bordée, `Signalement` non → unifié (les deux à plat). Même style que les onglets principaux.
5. **Boîtes libellé/valeur** unifiées : `threat-hashes` (bordure) et `report-detail-meta` (fond) → même fond `--bg`, même rayon `md`.
6. **Contenu de message** unifié : `threat-message` et `report-content` → même fond, même bordure, même rayon.
7. **Titres de panneau** : suppression du `padding-bottom:8px` parasite ; `.section-title h2` à marge 0 → espacement constant (fini le 20 px vs 8 px selon la page).

### Récupération d'erreurs (P1)
8. `apiRequest` traduit les échecs réseau et 5xx en messages clairs, mappe 401/403/404, et conserve le détail brut dans `ApiError.detail` pour le débogage.
9. `Alert` utilise `role="alert"` pour error/danger/warn (annonce immédiate au lecteur d'écran) et `role="status"` pour info/ok.
10. **Réessayer** ajouté sur l'échec de chargement des fiches menace et utilisateur.

### P2 / micro
11. **État « Tests » persisté** par run (localStorage `safedm.ml.testedRuns`) : l'onglet ne se « décoche » plus après reload.
12. **Bandeau « Prochaine étape » cliquable** (ouvre l'onglet concerné, chevron, focus visible).
13. **États désactivés lisibles** : fini l'`opacity: .5` (< 3:1) → surface grise + texte `--muted` (~5.6:1) ; les boutons « occupés » gardent leur couleur (`is-busy`).
14. **Hiérarchie de texte** : `--muted` éclairci (`#667085`) pour se distinguer nettement de `--text-secondary` ; token dupliqué `--surface-muted` (identique à `--bg`) supprimé.
15. **Alertes sémantiques** : les notes « Contenu non stocké » passent en `info` (bleu), l'avertissement de file en `warn` (ambre) — au lieu du rouge « erreur » par défaut.

## Problèmes restants

### 1 — P2 · optimize · Pas de progression live d'entraînement
**What** : un run en cours ne montre pas d'avancement (pas de polling de `status`).
**Why** : sur un entraînement long, l'opérateur ne sait pas si ça avance.
**Fix** : rafraîchir périodiquement `listMlRuns()` tant qu'un run est `running`.
**Commande** : `/impeccable optimize`

### 2 — P2 · harden · Guidage d'erreur d'import
**What** : une erreur d'import (colonne manquante) s'affiche en bandeau, sans pointer le champ.
**Fix** : associer le message au champ concerné.
**Commande** : `/impeccable harden`

### 3 — P3 · polish · `datasetId` par défaut silencieux
**What** : le premier jeu est présélectionné pour l'entraînement sans indication.
**Why** : risque de lancer un entraînement sur un jeu non voulu.
**Fix** : libellé explicite ou laisser vide.

## Persona Red Flags

### Alex (power user)
1. Palette Ctrl+K navigation seule. 2. `datasetId` par défaut silencieux. 3. Pas d'annulation de run. 4. Contexte préservé (URL). 5. Menu entièrement atteignable.

### Jordan (première fois)
1. Parcours lisible dans les onglets + étape suivante cliquable. 2. Jargon d'import (`message ← colonne`) encore sec. 3. canary/publiable définis. 4. Le « Tester » ne se décoche plus.

### Sam (accessibilité)
1. Focus des dialogues : OK. 2. Onglets clavier partout. 3. Erreurs dures en `role="alert"`. 4. États désactivés contrastés. 5. `prefers-reduced-motion`, graphes doublés de matrices, libellés d'état `.sr-only`.

## Observations mineures
- `--muted` et `--text-secondary` restent deux niveaux proches mais désormais distincts et accessibles.
- GuidePage garde quelques `style={{ padding }}` structurels (one-offs sans impact de cohérence).
- L'ordre des sections de nav est un choix produit à valider.
