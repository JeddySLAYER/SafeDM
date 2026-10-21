---
target: Mobile — Résultat d'analyse + flux LinkGate
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/joan/Projects/SafeDM/safedm-mobile/src/screens/AnalysisResultScreen.jsx"
target_fingerprint: "sha256:56e4f22eba2f7dd230df740eb0ff3f2d4fd633badafea6cfaf67df451c1e9969"
target_path: /home/joan/Projects/SafeDM/safedm-mobile/src/screens/AnalysisResultScreen.jsx
timestamp: 2026-10-21T06-21-00Z
slug: safedm-mobile-src-screens-analysisresultscreen-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Reporting spinner OK, mais aucune indication d'heure/validité du score affiché |
| 2 | Match System / Real World | 2 | `Verdict : {verdict}` imprime l'enum brut anglais (`DANGEROUS`) dans une UI française |
| 3 | User Control and Freedom | 3 | Retour partout, échappatoire présente — signalement irréversible sans confirmation |
| 4 | Consistency and Standards | 2 | LinkGate (#0B0B0B) et résultat (tokens clairs) sont deux produits différents dans le même flux |
| 5 | Error Prevention | 2 | Rapport communautaire en 1 tap ; scores sans notion d'incertitude |
| 6 | Recognition Rather Than Recall | 3 | Raisons listées, libellés visibles ; « Vérification distante » reste opaque |
| 7 | Flexibility and Efficiency | 2 | Aucun copier/partager sur l'URL détectée |
| 8 | Aesthetic and Minimalist Design | 2 | Mur de méta dans la carte score + bandes noires qui rivalisent |
| 9 | Error Recovery | 3 | Messages en français, retry sur LinkGate ; pas de retry sur échec de signalement |
| 10 | Help and Documentation | 2 | Parenthèse « (plus le score est élevé…) » = seule aide contextuelle |
| **Total** | | **23/40** | **Acceptable (57.5%)** |

## Design Specificity Verdict

**LLM assessment**: non spécifique. Anneau-score + rangées d'icônes + sections = gabarit « scanner result » interchangeable. Rien ne rattache l'écran à SafeDM au-delà du bleu `#2F8AF2`. Le monde noir de LinkGate renforce l'impression de default inversé plutôt que d'identité.

**Deterministic scan**: non applicable (plateforme native).

## Overall Impression

Structure saine mais ton à contre-courant : SafeDM doit rassurer un utilisateur qui vient de recevoir un SMS suspect, et l'écran répond par du noir, des capitales et un anneau noir. Plus grosse opportunité : transformer le verdict alarmiste en guidage actionable.

## What's Working

- Accessibilité des liens : `accessibilityLabel` complet sur chaque bandeau URL + `ScoreRing` avec label vocal.
- Progressive disclosure partielle : lien suspect différé derrier un tap (`LinkGate`) au lieu d'ouvert d'emblée.
- Vocabulaire déjà adouci (« Vérification distante », textes LinkGate) : la direction textuelle est bonne, le problème est visuel.

## Priority Issues

**[P1] Le monde noir de LinkGate est hors système de design**
What: `blockScreen: #0B0B0B`, `blockHero: colors.black`, carte `#1A1A1A`, cercle `#F04438`, typo 22/800 — aucune n'existe dans `theme/tokens.js`.
Why: deux écrans successifs du même parcours se contredisent ; l'utilisateur croit avoir quitté l'app.
Fix: rebâtir sur `colors.canvas` / `colors.surface`, une seule couleur sémantique, échelle typo standard.
Command: /impeccable quieter

**[P1] Registre émotionnel du verdict = alarme, pas guidage**
What: `riskHeadline()` → « RISQUE ÉLEVÉ » capitales, anneau `colors.black` pour high, `urlMalicious: colors.black` en aplat.
Why: le pic du parcours (peak-end) est le moment où l'utilisateur a besoin de calme.
Fix: titres en phrase, couleur sémantique en accent unique, jamais en aplat pleine largeur.
Command: /impeccable quieter

**[P1] Mur de méta + enum brut dans la carte score**
What: headline + desc + `Verdict : DANGEROUS` + phrase 2 lignes avec parenthèse + `Source` = 5 niveaux empilés.
Why: charge cognitive élevée (4/8 items du checklist échoués) ; enum anglais casse la crédibilité.
Fix: ≤3 lignes en liste de définition, verdict traduit, parenthèse devient lien « Comment lire ce score ? ».
Command: /impeccable distill

**[P2] Aucune action primaire utile : ni copier, ni partager l'URL**
What: aucune copie/partage de l'URL détectée ; CTA final « Signaler ce message » en outline.
Why: le vrai réflexe mobile après un lien douteux n'existe pas ; Casey abandonne sans rien faire.
Fix: bouton copier/partager sur chaque bandeau URL, CTA primaire repositionné.
Command: /impeccable adapt

**[P2] Échappatoire la plus risquée est la plus accessible au pouce**
What: ordre BLOCK = `Ne pas ouvrir` → `Signaler` → `J'ai compris le risque` (dernier, donc en bas de scroll).
Why: l'action la plus dangereuse est la plus facile à atteindre ; signalement sans confirmation.
Fix: remonter l'échappatoire, la rendre secondaire, confirmer le signalement.
Command: /impeccable harden

## Persona Red Flags

**Jordan (premier contact)**: `Verdict : DANGEROUS` lu comme un bug ; phrase de score à clause mal parsée en diagonale ; fond noir interprété comme écran d'erreur système.

**Casey (mobile, un pouce)**: sur BLOCK l'action la plus risquée est la plus proche du pouce ; CTA primaire noyé dans le scroll ; aucune action de copie → abandon.

**Sam (accessibilité)**: risque largement porté par la couleur (anneau/bandeau noirs) ; pas d'annonce « analyse terminée » à la fin du loading ; `reasonRow`/`recRow` sans rôle d'accessibilité.

## Minor Observations

- `recommendations` non tronqué (contrairement à `reasons.slice(0,4)`) → liste potentiellement infinie.
- `styles.empty` sans size ni margin : rendu brut.
- Variante `dark` du composant `Button` plus utilisée après le redesign.
- `ModelUpdateBridge` affiche un bandeau `#1769d4` en dur, hors tokens.

## Questions to Consider

- Que verrait une version confiante : une décision, une raison, une prochaine étape — et rien d'autre ?
- Le score chiffré mérite-t-il d'être le héros, ou la décision (ouvrir / ne pas ouvrir) ?
- Faut-il deux écrans (résultat + gate) pour un même lien, ou le gate suffit-il ?
