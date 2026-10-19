---
target: TrainingPage + dashboard shell
total_score: 37
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/joan/Projects/SafeDM/safedm-dashboard/src/pages/TrainingPage.jsx"
target_fingerprint: "sha256:d101f6064fc67eee72836125f012f1b09999fde1b7af15bb7f7cada413e9f913"
target_path: /home/joan/Projects/SafeDM/safedm-dashboard/src/pages/TrainingPage.jsx
timestamp: 2026-10-18T15-25-38Z
slug: safedm-dashboard-src-pages-trainingpage-jsx
---
# Critique Impeccable (refonte visuelle) — Page Entraînement + shell dashboard

> Run après la refonte layout/composants. Référence : `2026-10-18T15-05-56Z` (35/40), avant : 25/40.

## Design Health Score (Nielsen, Operate mode — 10/10 applicables)

| # | Heuristique | S1-3 | Refonte | Problème clé restant |
|---|-------------|------|---------|----------------------|
| 1 | Visibilité de l'état du système | 4 | 4 | Bandeau « Prochaine étape » + badge d'état par onglet + Freshness. Reste : l'étape « Tests » dépend toujours de `tryResult` en mémoire (reload la décoche) ; pas de progression d'entraînement. |
| 2 | Adéquation système / monde réel | 4 | 4 | Glossaire, un seul nom par objet, canary/publiable définis inline. |
| 3 | Contrôle et liberté de l'utilisateur | 4 | 4 | URL state (`?tab=&run=`). Toujours pas d'annulation de run. |
| 4 | Cohérence et standards | 4 | 4 | Une seule grammaire de surfaces (panel/card/liste/table : même bord, rayon `--radius-lg`, même fond), onglets unifiés (Entraînement, Opérations, sous-onglets Signalements) tous clavier + rôles ARIA, échelle de sévérité monotone et tokenisée. Reste : `--muted`/`--text-secondary` quasi identiques et interchangeables. |
| 5 | Prévention des erreurs | 3 | 3 | ConfirmDialogs solides ; `datasetId` par défaut toujours silencieux. |
| 6 | Reconnaissance plutôt que rappel | 4 | 4 | Le stepper redondant est supprimé ; chaque onglet porte son avancement (done/next/todo). Le bandeau « Prochaine étape » est informatif, non cliquable. |
| 7 | Flexibilité et efficacité | 3 | 4 | Sidebar rétractable + regroupée en 4 sections, nav scrollable indépendamment (footer ancré). Reste : palette Ctrl+K navigation seule, pas de recherche/filtre des listes. |
| 8 | Esthétique et design minimaliste | 3 | 4 | Le pavé gris « Cycle de vie ML » pleine largeur est remplacé par un bandeau d'une ligne + onglets sobres. TFLite toujours dense mais sectionné. |
| 9 | Aide à la reconnaissance/diagnostic/récupération des erreurs | 2 | 2 | Inchangé : `err.message` brut en Alert + toast, pas de retry, `role="status"` sur erreurs dures. |
| 10 | Aide et documentation | 4 | 4 | Contenu dev retiré ; aide par route conservée. |
| **Total** | | **35/40** | **37/40** | **Bon — correction ciblée restante** |

## Verdict de spécificité design

**Inchangé : fortement ancré dans SafeDM.** Le parcours encodé (rappel ≥ 60 %, FP ≤ 10 %) reste, désormais lisible dès le bandeau. La sémantique canary reste partout. Poche générique résiduelle : les 6 cartes métriques (vocabulaire classifieur binaire standard).

## Scan déterministe (Assessment B)

- `impeccable detect --json safedm-dashboard/src` → **[] (0 finding)**
- `color-mix()` ad hoc supprimé au profit des tokens (`--ok-bg`, `--danger-bg`, `--warn-bg`, `--surface-2`).
- Inline styles de contournement supprimés (`.table-flush`, `.stack-top`) — restent seules les valeurs dynamiques (largeurs skeleton, hauteurs de barres, taille logo).
- Tous les onglets (Entraînement, Opérations, sous-onglets de Signalements) : roving tabindex, Arrow/Home/End, `aria-controls`, `role="tabpanel"`.
- Build OK, lint = 3 avertissements préexistants (inchangés).

## Impression globale

La refonte visuelle traite les trois plaintes concrètes : le **« Cycle de vie ML »** qui étalait la page en haut du contenu, le **menu latéral** qu'il fallait faire défiler pour atteindre le bas, et le **surlignage bleu** qui s'arrêtait avant le bouton Supprimer. Au-delà, la refonte a posé une grammaire de surfaces unique et une échelle de sévérité cohérente. Il ne reste qu'une poche technique côté erreurs : les messages bruts.

## Ce qui fonctionne

1. **Une seule grammaire visuelle** — panels, listes, tables, cartes et dialogues partagent bord `--line`, rayon `--radius-lg`, fond `--surface`. Le long commentaire « flat surfaces » contredisant deux blocs CSS a disparu.
2. **Onglets d'étape lisibles** — un bandeau « Prochaine étape : X » d'une ligne remplace le gros bloc gris ; les 6 onglets portent chacun un glyphe d'état (✓ terminé / anneau bleu prochaine / discret à faire).
3. **Navigation qui tient** — 4 sections (Supervision, Catalogue, Modèle, Contenu), seul le nav scrolle, en-tête et pied (utilisateur, Commandes, Déconnexion, Replier) toujours visibles.
4. **Ligne de liste cohérente** — la sélection teinte désormais toute la ligne, bouton Supprimer compris.

## Problèmes prioritaires

### 1 — P1 · harden · Récupération d'erreur absente
**What** : `err.message` brut affiché en `Alert` page-level (`TrainingPage.jsx:410`) **et** en toast (`TrainingPage.jsx:289`), sans reformulation ni action. Pas de bouton « Réessayer ». `Alert` en `role="status"` pour des erreurs dures.
**Why** : `Unexpected token '}'` n'indique pas quoi faire ; l'opérateur doit recharger la page pour retenter.
**Fix** : message en langage clair + retry sur l'erreur page-level ; `role="alert"` pour les erreurs dures.
**Commande** : `/impeccable harden`

### 2 — P2 · optimize · État « Tests » mémoire-only
**What** : l'onglet « Tester » passe `done` via `hasTestResult = Boolean(tryResult || tfliteResult)` en état composant (`TrainingPage.jsx:373`).
**Why** : après reload, un test pourtant effectué paraît annulé — le seul endroit où l'indicateur d'avancement ment.
**Fix** : dériver l'état d'un résultat serveur persisté plutôt que de l'état composant.
**Commande** : `/impeccable optimize`

### 3 — P2 · polish · Micro-asymétries
**What** : `--muted` (#5c6573) et `--text-secondary` (#3d4553) quasi identiques, employés de façon interchangeable ; `disabled` à `opacity: 0.5` (< 3:1) reste le seul signal « choisissez d'abord un jeu » ; le bandeau « Prochaine étape » n'est pas cliquable alors que les onglets le sont.
**Fix** : distinguer clairement les deux niveaux de texte (ou n'en garder qu'un) ; porter le contraste des états désactivés ; rendre l'étape cible du bandeau actionnable.
**Commande** : `/impeccable polish`

## Persona Red Flags

### Alex (power user)
1. Import → retour à l'onglet `data` : pas d'affordance « importer un autre » (inchangé).
2. `datasetId` par défaut silencieux sur le 1er jeu (inchangé).
3. Palette Ctrl+K navigation seule (inchangé).
4. Amnésie de contexte : **corrigée** (URL + restauration).
5. Menu : **corrigé** — plus besoin de scroller pour voir le pied.

### Jordan (première fois)
1. Le double stepper ont disparu ; le parcours se lit dans les onglets avec leur état. **Corrigé.**
2. Jargon premier import (`message ← colonne`) : inchangé.
3. canary/publiable : **définis** inline.
4. Lifecycle « Tester » qui se décoche après reload : **toujours présent**.

### Sam (accessibilité)
1. Focus des dialogues : **corrigé** (`useDialogFocus`).
2. Onglets : **corrigés partout**, y compris les sous-onglets de Signalements (clavier + ARIA).
3. `Alert role="status"` pour erreurs dures : **toujours présent**.
4. Sélection de ligne par couleur seule : atténué (toute la ligne + glyphes d'état), mais la sévérité reste couleur + texte — OK.
5. Positifs : `prefers-reduced-motion`, graphes doublés de matrices texte, `.sr-only` pour les libellés d'état d'onglet.

## Observations mineures

- `.stat-card` et `.panel` partagent la déclaration groupée ; le padding du panel est surchargé plus bas — le regroupement reste un peu dispersé dans le fichier.
- GuidePage conserve quelques `style={{ padding: … }}` structurels (one-offs, sans impact de cohérence).
- L'ordre des sections de nav (Supervision → Catalogue → Modèle → Contenu) est un choix ; à valider avec l'usage réel.

## Questions à considérer

- Le bandeau « Prochaine étape » devrait-il devenir un bouton qui ouvre directement l'onglet concerné ?
- Peut-on supprimer l'onglet « Diagnostic TFLite » du rang principal (outil de second niveau accessible depuis un run) ?
- Faut-il dériver « Tests » d'un résultat serveur persisté pour éliminer le dernier indicateur qui ment ?
