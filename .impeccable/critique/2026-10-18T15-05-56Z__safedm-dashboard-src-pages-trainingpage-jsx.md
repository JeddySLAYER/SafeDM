---
target: TrainingPage + dashboard shell
total_score: 35
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/joan/Projects/SafeDM/safedm-dashboard/src/pages/TrainingPage.jsx"
target_fingerprint: "sha256:107fd06e22db80041964a65cb13ecda02a4c15da65043b6836b5b50385f2a2fb"
target_path: /home/joan/Projects/SafeDM/safedm-dashboard/src/pages/TrainingPage.jsx
timestamp: 2026-10-18T15-05-56Z
slug: safedm-dashboard-src-pages-trainingpage-jsx
---
# Critique Impeccable (Sprint 4 — comparative) — Page Entraînement + shell dashboard

> Run comparatif après les sprints 1–3. Référence : `2026-10-18T14-05-26Z` (25/40).

## Design Health Score (Nielsen, Operate mode — 10/10 applicables)

| # | Heuristique | Avant | Après | Problème clé restant |
|---|-------------|-------|-------|----------------------|
| 1 | Visibilité de l'état du système | 3 | 4 | Lifecycle « Tests » dépend encore de `tryResult` en mémoire (reload = décoche) ; toujours pas de progression d'entraînement. Gagné : horodatage de fraîcheur sur Entraînement + 6 autres pages. |
| 2 | Adéquation système / monde réel | 2 | 4 | Enums traduits via `glossary.js` (`mlStatus`/`reviewStatus`/`binaryLabel`) ; un seul nom par objet (Jeu, Entraînement) ; `canary` et `publiable` désormais définis à la 1re utilisation (panel-note Tester / Entraîner). |
| 3 | Contrôle et liberté de l'utilisateur | 3 | 4 | Contexte restauré via `useSearchParams` (`?tab=runs&run=12`) : reload/partage/Back conservent onglet + run. Toujours pas d'annulation d'un run en cours. |
| 4 | Cohérence et standards | 2 | 4 | Statuts cohérents via glossaire ; onglets Operations désormais clavier + `role=tabpanel` comme Entraînement ; nav FR homogène. Reste : sous-onglets `report-detail-tabs` de ReportsPage = 2e style, sans nav clavier. |
| 5 | Prévention des erreurs | 3 | 3 | Inchangé : ConfirmDialogs solides, promote verrouillé, mais `datasetId` reste par défaut silencieusement sur le 1er jeu. |
| 6 | Reconnaissance plutôt que rappel | 3 | 4 | Lifecycle désormais cliquable (`onGo={selectTab}`) — un élément qui ressemble à un bouton en est un ; canary/publiable définis avant l'action. |
| 7 | Flexibilité et efficacité | 2 | 3 | URL state + sidebar rétractable (rail 56px persisté). Reste : palette Ctrl+K navigation seule, aucune recherche/filtre/pagination dans les listes. |
| 8 | Esthétique et design minimaliste | 2 | 3 | Onglet TFLite découpé en 3 sous-sections `1 · Sources / 2 · Évaluer / 3 · Résultats`. Reste dense ; panel-notes expliquent encore l'architecture avant l'objectif. |
| 9 | Aide à la reconnaissance/diagnostic/récupération des erreurs | 2 | 2 | Inchangé : `err.message` brut répliqué en Alert ET toast ; erreur page-level sans bouton « Réessayer » ; `Alert` en `role="status"` pour des erreurs dures. |
| 10 | Aide et documentation | 3 | 4 | Contenu dev retiré (note sprint Kotlin, `cd safedm-backend && make evaluate` en Aide **et** dans le panneau Tester). |
| **Total** | | **25/40** | **35/40** | **Bon — quelques corrections ciblées** |

## Verdict de spécificité design

**Inchangé : fortement ancré dans SafeDM, pas interchangeable.** Le strip lifecycle encode toujours la politique de release réelle (rappel ≥ 60 %, FP ≤ 10 %), désormais explicitée inline dans le panel-note Entraîner. La sémantique canary reste partout (callout 0 %, dialogs de suppression qui préviennent qu'un patch promu survit), et le TFLite reste pur SafeDM (parité patch-JSON vs bundlé, rapport Android, SHA-256, divergences Python↔Android). Poche générique résiduelle : les 6 cartes métriques (vocabulaire classifieur binaire standard).

## Scan déterministe (Assessment B)

- `impeccable detect --json safedm-dashboard/src` → **[] (0 finding)**
- 7 hex résiduels traités : `--text-inverse` token créé, 6× `#fff` remplacés, chart `#1769d4` → `.chart-bar { fill: var(--blue) }`.
- A11y onglets complète des deux côtés (Entraînement + Operations) : roving tabindex, Arrow/Home/End, `aria-controls`/`aria-labelledby`, panels `role="tabpanel"`.
- **Browser : automatisation toujours indisponible** — revue source + build + Vite transform uniquement.

## Impression globale

Les deux maladies du baseline sont largement traitées : la **taxonomie** est unifiée (un glossaire unique, enums traduits, terme définis à la première rencontre) et la **densité** du TFLite est désormais segmentée en trois sections lisibles. Le gain le plus structurel est invisible au premier coup d'œil : le contexte (onglet + run) vit maintenant dans l'URL, ce qui rend le flow promote parcourable sans amnésie. Il reste une poche d'« ingénierie exposée » côté erreurs : les messages bruts (`Unexpected token…`) sont toujours jetés au visage de l'opérateur, sans action de récupération.

## Ce qui fonctionne

1. **Hints de métriques accrochés à la décision opérateur** — `Objectif ≥ 60 % pour publier` : inchangé, toujours excellent.
2. **Communication de risque canary** — désormais renforcée par une définition inline de `canary` et `publiable` là où l'opérateur les rencontre pour la 1re fois.
3. **Contexte préservé** — `?tab=runs&run=12` rend le happy-path (promote → Opérations → retour) non destructif et l'URL partageable.
4. **Hygiène a11y et onboarding** — focus trap partagé (`useDialogFocus`) appliqué à DetailSheet/ConfirmDialog ; onglets conformes partout ; contenu dev purgé.

## Problèmes prioritaires

### 1 — P1 · harden · Récupération d'erreur absente
**What** : `err.message` brut affiché simultanément en `Alert` page-level (L410) et en toast (L289), sans reformulation ni action. Aucun bouton « Réessayer » sur l'erreur de chargement. `Alert` utilise `role="status"` (`ui.jsx`) pour des erreurs dures ; `.table-wrap` scrollable toujours non focusable.
**Why** : L'opérateur voit `Unexpected token '}'.` sans savoir quoi faire, et doit recharger la page pour retenter un `listMlRuns()` échoué.
**Fix** : Message d'erreur en langage clair + bouton retry sur l'erreur page-level ; `role="alert"` pour les erreurs dures ; `tabIndex={0}` sur `.table-wrap`.
**Commande** : `/impeccable harden`

### 2 — P2 · polish · Restes de cohérence
**What** : `report-detail-tabs` (ReportsPage L262-265) conserve un 2e style d'onglets et **sans** navigation clavier, alors que le reste est unifié. `datasetId` par défaut silencieux. `disabled` à `opacity: 0.5` (< 3:1) reste le seul signal « choisissez d'abord un jeu ».
**Why** : Les fixes structurels sont faits ; il reste des aspérités qui trahissent l'assemblage.
**Fix** : Aligner `report-detail-tabs` sur le pattern onglets commun (ou l'assumer comme sous-nav stylée mais la rendre clavier) ; afficher le jeu par défaut choisi (`#id name (n)`) près du bouton Lancer ; porter un vrai contraste sur les états désactivés.
**Commande** : `/impeccable polish`

### 3 — P2 · optimize · Lifecycle toujours mémoire-only + échelle de listes
**What** : l'étape « Tests » du lifecycle dépend de `tryResult` en état composant — un reload « annule » visuellement un test pourtant fait. Palette Ctrl+K : zéro action d'entraînement. Listes sans recherche/filtre/pagination.
**Why** : Le lifecycle est le chrome d'orientation principal ; s'il ment après reload, la confiance s'effondre. Pour un outil d'audit, l'absence de recherche de run est un manque.
**Fix** : Dériver l'état « Tests » de la donnée serveur (existence d'un résultat persisté) plutôt que de l'état composant ; ajouter des entrées palette (`Résultats`, `dernier entraînement`) ; recherche/filtre des runs.
**Commande** : `/impeccable optimize`

## Persona Red Flags

### Alex (power user)
1. Import réussit → retour à l'onglet `data` : pas d'affordance « importer un autre fichier » (inchangé).
2. Default silencieux du jeu (`datasetId`) au 1er élément — risque d'entraîner le mauvais jeu (inchangé).
3. Auto-modal après train : la feuille couvre la liste Résultats (inchangé).
4. Palette Ctrl+K : toujours navigation seule (inchangé).
5. Amnésie de contexte : **corrigée** — URL + Restauration via `?tab=&run=`.
6. `Actualiser` **a maintenant** un horodatage de fraîcheur.

### Jordan (première fois)
1. Deux steppers : **corrigés** — lifecycle cliquable, vocabulaire aligné sur les onglets.
2. Jargon premier import (`message ← colonne`) : inchangé.
3. `canary`/`publiable` : **définis** à la 1re utilisation.
4. Toast `Entraînement terminé (canary si publiable)` : toujours ambigu sur « une poussée a-t-elle eu lieu ? » — mais le terme est maintenant défini.
5. Lifecycle qui « ment » après reload sur « Tests » : **toujours présent** (P2 ci-dessus).

### Sam (accessibilité)
1. Trou noir de focus des dialogues : **corrigé** — `useDialogFocus` (restaure, piège Tab, Escape).
2. A11y onglets : **corrigée partout** (Entraînement + Operations).
3. `Alert role="status"` pour erreurs dures : **toujours présent**.
4. `.table-wrap` scrollable sans `tabIndex` : **toujours présent**.
5. Statut lifecycle par couleur + glyphe `aria-hidden` : **toujours présent**.
6. Positifs conservés : `prefers-reduced-motion`, `aria-label` sur suppressions, graphes doublés en matrices texte, focus trap type palette.

## Observations mineures

- Lien sidebar « Entraînement » = `/training` sans query : le contexte URL n'est restauré qu'au reload/Back, pas en re-cliquant l'entrée de nav.
- Rappel de confidentialité toujours dupliqué (panel-note + field hint) dans le TFLite.
- Espacements non authored (16/24/28/12/4px) toujours présents.
- `Freshness` : désormais 8 pages (Entraînement, Threats, Reports, Users, Applications, LinkGate, Stats, Operations) ; restent Guide/Politiques (éditeurs texte, fraîcheur non pertinente).

## Questions à considérer

- Le lifecycle (5 étapes cliquables) pourrait-il *remplacer* les 6 onglets, plutôt que coexister avec eux ?
- « Diagnostic TFLite » mérite-t-il le rang d'onglet principal, ou un outil de second niveau accessible depuis un run ?
- Faut-il dériver « Tests » d'un résultat serveur persisté pour éliminer le seul point où le chrome d'état ment ?
