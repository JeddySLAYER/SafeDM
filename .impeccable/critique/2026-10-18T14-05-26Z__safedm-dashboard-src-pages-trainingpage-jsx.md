---
target: TrainingPage + dashboard shell
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/joan/Projects/SafeDM/safedm-dashboard/src/pages/TrainingPage.jsx"
target_fingerprint: "sha256:0bd575a8a74eba8246a858675f1568c5e7b084ba02960d8dfe288ae9fff8752b"
target_path: /home/joan/Projects/SafeDM/safedm-dashboard/src/pages/TrainingPage.jsx
timestamp: 2026-10-18T14-05-26Z
slug: safedm-dashboard-src-pages-trainingpage-jsx
---
# Critique Impeccable — Page Entraînement + shell dashboard

## Design Health Score (Nielsen, Operate mode — 10/10 applicables)

| # | Heuristique | Score | Problème clé |
|---|-------------|-------|--------------|
| 1 | Visibilité de l'état du système | 3 | Lifecycle "Tests" dépend d'un état mémoire (reload = ment) ; pas d'horodatage de fraîcheur sur Entraînement ; pas de progression d'entraînement |
| 2 | adéquation système / monde réel | 2 | Enums backend bruts affichés (`succeeded`, `pending`, `BENIN`) ; « Run », « Dataset », « publiable » non traduits ; 3 noms pour un objet (Jeu / Dataset / jeu de données) |
| 3 | Contrôle et liberté de l'utilisateur | 3 | Pas d'annulation d'un run ; état onglet/sélection perdu à chaque navigation ; sortie de la page détruit le contexte |
| 4 | Cohérence et standards | 2 | ReportsPage invente un 2e style d'onglets ; statuts traduits dans Threats mais bruts dans Entraînement ; « Jeux » vs « dataset » sur la même page |
| 5 | Prévention des erreurs | 3 | ConfirmDialogs solides, promote verrouillé jusqu'à revue ; mais `datasetId` default silencieux au 1er dataset sans confirmation visible |
| 6 | Reconnaissance plutôt que rappel | 3 | Aides contextuelles excellentes ; mais « canary »/« publiable » non définis à la 1re utilisation ; étapes du lifecycle non cliquables alors qu'elles ressemblent à des boutons |
| 7 | Flexibilité et efficacité | 2 | Palette Ctrl+K ne fait que naviguer (aucune action d'entraînement) ; onglet/run non dans l'URL ; sidebar non rétractable ; aucune recherche/pagination dans les listes |
| 8 | Esthétique et design minimaliste | 2 | Onglet TFLite = ~8 contrôles + bandeau + 8 cartes + graphe + tableau 7 colonnes en un seul flux ; panel-notes expliquent l'architecture avant l'objectif opérateur |
| 9 | Aide à la reconnaissance/diagnostic/récupération des erreurs | 2 | `err.message` brut répliqué en Alert ET toast (`Unexpected token…`) ; erreur page-level sans bouton retry |
| 10 | Aide et documentation | 3 | Couverture top (help par route, feuille process, hints) mais contenus dev exposés (`cd safedm-backend && make evaluate`, note sprint Kotlin) |
| **Total** | | **25/40** | **Acceptable — améliorations significatives nécessaires** |

## Verdict de spécificité design

**Fortement ancré dans SafeDM — pas interchangeable**, avec une poche générique : le strip lifecycle encode la politique de release réelle (rappel ≥ 60 %, FP ≤ 10 %), la sémantique canary est partout (« aucun impact appareil », callout 0 %, dialogues de suppression qui préviennent qu'un patch promote survit), le TFLite est pur SafeDM (parité patch-JSON vs bundlé, rapport Android, SHA-256, divergences de features Python↔Android). Là où ça dérive générique : les 6 cartes métriques sont du vocabulaire classifieur binaire standard, et le shell d'onglets (Jeux/Ajouter/Entraîner) est de la verrue ML-tooling.

## Scan déterministe (Assessment B)

- `impeccable detect --json safedm-dashboard/src` → **[] (0 finding)**
- Idem scopé TrainingPage.jsx et components/ → **[]**
- Pas de faux positifs à signaler (aucun finding).
- **Browser : automatisation indisponible** — pas d'outil de navigation exposé, pas de sous-commande `live-server` dans le CLI ; aucun overlay revendiqué. Revue source uniquement.
- Secondaires : 7 hex hardcodés résiduels (6× `#fff` + 1 chart `#1769d4` dans JSX), ~4 styles inline statiques, 0 TODO/console.log, câblage a11y onglets complet.

## Impression globale

Le fond produit est solide : la communication de risque canary est au-dessus de la moyenne, les hints de métriques ancrent les objectifs de publication, et le process sheet de 5 étapes est le meilleur bloc de copy de la page. Mais l'exécution souffre de deux maladies : **une taxonomie fracturee** (3 noms pour un jeu de données, enums backend bruts dans une UI française) et **une densité non maîtrisée** (onglet TFLite = formulaire + diagnostic + revue en un seul scroll). Le plus ironique : les tabs débordent en 5+1 à *toutes* largeurs desktop — la rangée ne tient jamais.

## Ce qui fonctionne

1. **Hints de métriques accrochés à la décision opérateur** — `Objectif ≥ 60 % pour publier`, `Objectif ≤ 10 % pour publier` : les nombres disent pas seulement ce qu'ils sont mais si on a le droit de shipper. Rare, et exactement ce qu'il faut en Operate.
2. **Communication de risque canary exceptionnellement soignée** — checkbox « aucun impact appareil », callout `Impact canary : 0 %` avec next-step concret + lien Opérations, dialogs de suppression qui préviennent qu'un patch promu survit.
3. **Ingénierie a11y et onboarding que la plupart des admin UI sautent** — tabs roving-tabindex avec Arrow/Home/End, aide contextuelle par route, feuille process 5 étapes, import avec suggestion de colonnes + validation par ligne + pagination 50.

## Problèmes prioritaires

### 1 — P0 · clarify · Terminologie fracturee + enums bruts
**What** : `Jeux`/`Nom du jeu` vs `Envoyer le dataset`/`Field label="Dataset"` (L361 vs L414/L434) ; `succeeded`/`pending` (L721-723) ; `BENIN`/`DANGEREUX` vs `Bénin` (L865-866 vs L836) ; `Run`, `publiable`, `CV folds`, `source patch` non traduits ; `canary` employé 20+ fois avant toute définition.
**Why** : L'opérateur ne peut pas construire un modèle mental fiable de l'état — la chose qu'Operate doit communiquer. `Statut : succeeded · revue pending` est illisible pour un opérateur francophone, et `Bénin` vs `BENIN` ressemble à deux labels différents dans un même flux.
**Fix** : Un seul nom par objet partout (**Jeu** côté UI) ; un map `STATUS_LABELS` à la ThreatsPage pour `succeeded/pending/approved/BENIN/…` ; définir `publiable` et `canary` à la 1re utilisation (gloss inline ou tooltip).
**Commande** : `/impeccable clarify`

### 2 — P1 · layout · Rangée d'onglets qui déborde + lifecycle non branché
**What** : 6 onglets × 180px + gaps = 1110px > 1072px disponibles sous le cap contenu 1120px → « Diagnostic TFLite » toujours seul en 2e ligne pleine largeur, y compris à 1440px. Le strip lifecycle (5 étapes) au-dessus n'a ni la même vocabulaire ni des liens vers les onglets ; son état `is-next` porte un anneau de focus permanent mais n'est pas cliquable.
**Why** : Navigation et chrome de statut se contredisent : deux steppers empilés, taxonomies divergentes, un élément d'orientation (« Prochaine étape : Tests ») qu'on ne peut pas actionner, un onglet orphelin qui lit comme un footer.
**Fix** : Raccourcir les hints (ou n'afficher le hint que sur l'actif) pour que les 6 tiennent ; renommer les onglets avec le vocabulaire du lifecycle ; rendre les étapes du lifecycle cliquables (`setTab(...)`) ; indicateur d'actif au-delà du fond teinté.
**Commande** : `/impeccable layout`

### 3 — P1 · distill · Onglet TFLite = multi-tâche
**What** : 8 contrôles d'entrée + bandeau décision + 8 cartes métriques + graphe + texte seuils + alerte roadmap + tableau 7 colonnes + revue artefact, tout dans un `.form-grid` plat (L504-621, L877-980). Deux entrées pour le même artefact (coller L533 / fichier L557) empilées sans choix de mode.
**Why** : Violation de demande multi-tâches : l'opérateur doit tenir « quels entrées ont produit ceci » sur un long scroll ; la décision « comment donner la même donnée » précède la compréhension du but.
**Fix** : Découper Sources (modèle + dataset + un seul contrôle rapport avec bascule coller/fichier) → Évaluer → Résultats (heading dédié + « Modifier les sources ») ; sortir l'alerte roadmap du produit ; réduire le tableau à `Étiquette · Verdict TFLite · Catégorie · Message` avec le reste en `<details>`.
**Commande** : `/impeccable distill`

### 4 — P1 · harden · Focus trap absent sur les dialogs
**What** : `DetailSheet` et `ConfirmDialog` déclarent `role="dialog" aria-modal="true"` mais ne déplacent jamais le focus, ne piègent pas Tab, ne restaurent pas au close (`ui.jsx:35-101`) — alors que `CommandPalette` fait tout correctement (`CommandPalette.jsx:63-73,117-122`). `Alert` utilise `role="status"` pour des erreurs dures ; `.table-wrap` scrollable non focusable au clavier.
**Why** : Un utilisateur clavier/SR qui ouvre une feuille de run garde le focus sur l'arrière-plan assombri, peut Tab à travers des contrôles inaccessibles, et appuie Entrée sur un « Supprimer » qu'il ne voit pas.
**Fix** : Extraire le focus-trap de la palette en hook `useDialogFocus` et l'appliquer à DetailSheet/ConfirmDialog/HelpSheet ; `role="alert"` pour les erreurs ; `tabIndex={0}` sur `.table-wrap`.
**Commande** : `/impeccable harden`

### 5 — P2 · optimize · Contexte détruit à la navigation
**What** : Tab, run sélectionné, dataset et résultats sont du pur état composant (L57-87) ; naviguer vers Opérations (que l'UI elle-même recommande après promote, L247) remonte la page à l'onglet `data` sans sélection. Zéro `useSearchParams` dans src/. `Freshness` existe mais n'est utilisé que sur 2 pages sur 12.
**Why** : Le flow promote *requiert* de quitter la page, donc le happy path conçu détruit le contexte opérateur ; pas d'URL partageable pour « run #12 » — manque notable pour un outil orienté audit.
**Fix** : Persister `tab`/`datasetId`/`selectedRun` en search params (`?tab=runs&run=12`) ; ajouter `Freshness` au header Entraînement ; entrées palette pour `Résultats`, `dernier run`.
**Commande** : `/impeccable optimize`

## Persona Red Flags

### Alex (power user)
1. Import réussit → `setTab("data")` (L141) : il revient à la liste, doit re-cliquer Ajouter pour le fichier suivant. Pas d'affordance « importer un autre ».
2. Default silencieux du dataset (L96) : s'il ne voit pas le select, « Lancer l'entraînement » entraîne le 1er sans confirmation de `#id name (count)`.
3. Auto-modal après train (L192-193 + L713) : la feuille couvre la liste Résultats sur laquelle il vient d'être envoyé. Escape obligatoire.
4. Promote = bouton désactivé expliqué par un `<small className="muted">` (L755-757), puis 2 toasts empilés (L245-247) sans bouton vers Opérations.
5. Amnésie de contexte : retour d'Opérations → onglet `data`, run null, lifecycle « Tests » se décoche (L1022).
6. Palette Ctrl+K : zéro action d'entraînement, navigation seule (CommandPalette.jsx:8-19).
7. Aucune échelle de liste : pas de recherche/filtre/pagination (L1057-1079).
8. `Actualiser` sans horodatage de fraîcheur (L342-351).

### Jordan (première fois)
1. Deux cartes, aucun pont : voit `Prochaine étape : Données` (L1031) mais 6 onglets `Jeux / Ajouter / …` — elle ne sait pas que `Jeux` = `Données`, que `Revue` n'a pas d'onglet (dans une feuille), que `Diagnostic TFLite` n'est pas dans le lifecycle. Les étapes ne sont pas cliquables.
2. Premier import = jargon schéma : `message ← colonne` / `expected ← colonne` (L390-391), hint `JSON: liste {message, expected}` (L382).
3. Entraîner s'ouvre sur l'architecture, pas l'intention : `un patch JSON à poids entiers — c'est ce que le téléphone utilise en OTA` (L431) — 4 termes non définis avant de savoir ce que fait le bouton pour elle.
4. `Si publiable, préparer le canary à 0 %…` (L444) : elle ne connaît ni « publiable » ni « canary ».
5. Succès ambigu : toast `Entraînement terminé (canary si publiable)` (L189) — impossible de savoir si une poussée a eu lieu. Pire string de la page.
6. Pop-up surprise : la feuille de run s'ouvre spontanément (L713) avec 6 cartes dont `CV folds`, un `<pre>` Journal, 3 boutons.
7. `Pousser vers le canary` (L753) sans définition inline ; les enjeux (« les téléphones vont changer ») ne sont dits qu'après l'action ou dans l'Aide.
8. Le lifecycle ment après reload : `Tests` dépend de `tryResult` en mémoire (L359, L1022) → son test terminé paraît annulé ; `Promotion` se coche à `promoted_at` (L1023) alors que le rollout est encore à 0 %.

### Sam (accessibilité)
1. Trou noir de focus : ouvre le détail d'un run → `DetailSheet` `aria-modal="true"` (ui.jsx:51) mais le focus ne bouge pas ; Tab marche dans la liste d'arrière-plan derrière un scrim 24 % ; au close, pas de restauration.
2. A11y onglets incohérente : Entraînement est exemplaire (roving tabindex, `aria-controls`) mais `aria-controls` pointe vers des ids inexistants quand le panel est démonté ; Operations' Tab n'a *aucun* handler clavier (OperationsPage.jsx:128).
3. Erreurs annoncées poliment, si tant est : `Alert role="status"` (ui.jsx:106) pour des erreurs dures.
4. Scroll horizontal inaccessible : tableau 7 colonnes dans `.table-wrap { overflow: auto }` sans `tabIndex` — WCAG 2.1.1.
5. Statut par couleur + glyphe caché : lifecycle `✓` est `aria-hidden` (L1038), l'état done/next n'est porté que par des classes couleur ; `is-next` porte un anneau de focus permanent (App.css:1670-1674) — un indicateur de focus veut dire « vous êtes ici » sur un élément et « prochaine étape » sur un autre.
6. Selects sans label dans le tableau d'import (L394).
7. Positifs : `prefers-reduced-motion` géré, delete buttons avec `aria-label`, graphes doublés de matrices texte, palette = bon modèle de focus dialog.

## Observations mineures

- **String de seuil qui bug visuellement** : `sûr < {safe_below} · incertain jusqu'à {dangerous_from} · dangereux à partir de {dangerous_from}` (L929) réutilise `dangerous_from` deux fois et ne dit jamais où commence l'incertain.
- Rappel de confidentialité dupliqué : panel-note (L507-509) et field hint (L511) disent la même chose.
- Deux chemins d'entrée pour un même artefact empilés sans bascule (coller L533 / fichier L556).
- Valeurs d'espacement non authored : 16/24/28/12/4px dans une même pile (App.css:408,1337,1621,1333,1614).
- Deux langages de bordure sur une page : panel flat sans bordure (App.css:1111-1119) enveloppant lifecycle/tabs/table-wrap/catalog-list borderés.
- `Freshness` utilisé sur 2 pages sur 12.
- aria-labels dupliqués : tablist `aria-label="Cycle de vie ML"` (L360) vs section `aria-label="Étapes du cycle de vie ML"` (L1027).
- Disabled buttons à `opacity: 0.5` passent sous 3:1 — seul cue pour « choisissez d'abord un dataset ».
- 7 hex résiduels (dont le chart `#1769d4` en JSX L917 qui duplique `--blue`).

## Questions à considérer

- Et si le lifecycle *était* la navigation — les 5 étapes cliquables remplaçaient les 6 onglets ?
- Est-ce que « Diagnostic TFLite » mérite d'être un onglet au même rang qu'un flow, ou un outil de second niveau accessible depuis un run ?
- Que faudrait-il pour que le flow promote (entraîner → approuver → tester → pousser → Opérations) soit parcourable sans jamais perdre le contexte ?
