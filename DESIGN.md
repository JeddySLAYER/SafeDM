---
name: SafeDM
description: Un garde-fou calme qui aide à repérer arnaques et liens suspects sans alarme inutile
colors:
  blue-signal: "#2F8AF2"
  blue-soft: "#F0F7FF"
  blue-200: "#B8D7FA"
  blue-600: "#1D6FD1"
  blue-800: "#14549E"
  gris-ardoise: "#F2F4F7"
  surface: "#FFFFFF"
  surface-muted: "#EEF2F6"
  border: "#E4E7EC"
  border-subtle: "#F2F4F7"
  text-primary: "#101828"
  text-secondary: "#667085"
  text-muted: "#98A2B3"
  danger-text: "#B42318"
  danger-soft: "#FEF3F2"
  danger: "#F04438"
  success-text: "#027A48"
  success-soft: "#ECFDF3"
  success: "#12B76A"
  risk-low-bg: "#12B76A"
  risk-medium-bg: "#2F8AF2"
  risk-high-bg: "#344054"
  risk-unknown-bg: "#F2F4F7"
typography:
  brand:
    fontSize: "26px"
    fontWeight: 700
    letterSpacing: "-0.3px"
  title:
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 34
    letterSpacing: "-0.4px"
  section:
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.4px"
    textTransform: "uppercase"
  body:
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 22
  label:
    fontSize: "15px"
    fontWeight: 600
  caption:
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 18
rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.blue-signal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "16px 20px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.blue-signal}"
    rounded: "{rounded.pill}"
    padding: "16px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.blue-signal}"
    rounded: "{rounded.pill}"
    padding: "16px 20px"
  risk-badge:
    backgroundColor: "{colors.risk-low-bg}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  screen-header:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 0"
---

# Design System: SafeDM

## Overview

**Creative North Star: "Le Gardien Calme"**

SafeDM est un garde-fou discret. Plutôt que de crier, il éclaire la décision : sur l'écran de résultat, **la décision en héros** prime sur le score. Le design privilégie une hiérarchie calme, un vocabulaire factuel et des actions sûres clairement identifiées. L'objectif est l'accompagnement, pas l'alarmisme.

**Key Characteristics:**
- **Décision en héros :** Le verdict guide l'utilisateur, avec le score relégué en métadonnée.
- **Calme par défaut :** Fond clair (`Gris Ardoise`), surfaces blanches, pas de fond noir.
- **Rouge à l'usage :** Le rouge est réservé aux états de décision/danger, jamais utilisé comme toile.
- **Surface-tonale :** La profondeur vient des aplats, bordures 1px et pastilles teintées, sans ombres décoratives.

## Colors

### Primary
- **Bleu Signal** (`#2F8AF2`): Voix de l'application (boutons primaires, liens cliquables). L'unique accent fort, utilisé avec parcimonie.

### Neutral
- **Gris Ardoise** (`#F2F4F7`): Toile de fond de l'application.
- **Surface** (`#FFFFFF`): Cartes, formulaires, en-têtes.
- **Surface Muted** (`#EEF2F6`): Zones secondaires discrètes.
- **Border / Border Subtle** (`#E4E7EC` / `#F2F4F7`): Séparations subtiles.
- **Text Primary** (`#101828`): Texte principal.
- **Text Secondary** (`#667085`): Métadonnées, sections.
- **Text Muted** (`#98A2B3`): Indications tertiaires.

### Semantic
- **Danger Text / Soft / Base** (`#B42318` / `#FEF3F2` / `#F04438`): Risque confirmé. `Danger Text` est privilégié sur fond pastel pour un contraste suffisant.
- **Success Text / Soft / Base** (`#027A48` / `#ECFDF3` / `#12B76A`): État sûr / confirmé.
- **Bleu Soft / 600 / 800** (`#F0F7FF` / `#1D6FD1` / `#14549E`): Zones d'information/suspicion, icônes et actions discrètes.

### Risk Badges
- **Faible** (`#12B76A`): Indicateur neutre positif.
- **Moyen** (`#2F8AF2`): Indicateur informationnel.
- **Élevé** (`#344054`): Indicateur de niveau sans hurler en rouge.

## Typography

**Police :** Police système (sans famille déclarée dans les tokens). Poids typiques 400/600/700.

### Hierarchy
- **Brand** (700, 26px, -0.3px): Logo/marque dans certains contextes.
- **Title** (700, 26px, -0.4px, line-height 34): Titres d'écran.
- **Section** (700, 13px, 0.4px, uppercase): En-têtes de section (« Ce qui a été repéré », « Ce qu'il faut faire »).
- **Body** (400, 15px, line-height 22): Corps de texte.
- **Label** (600, 15px): Labels de boutons/formulaires.
- **Caption** (400, 13px, line-height 18): Métadonnées, labels de lien.

## Layout

- **Toile :** `canvas: #F2F4F7`, contenu dans `Screen` avec padding horizontal 24px, padding vertical 12–32px.
- **Sections :** Listes de lignes (`reasonRow`, `recRow`) plutôt que cartes web imbriquées.
- **Bannières URL :** Séparées du corps, actionnables, avec actions natives (`Copier`/`Partager`).
- **Grille :** Empilement vertical fluide, espacement via `spacing` (xs/sm/md/lg/xl/xxl).

## Elevation & Depth

**Règle :** Plat + surfaces tonales. Pas d'ombres décoratives. La profondeur est créée par :
- Couche de fond (`canvas`) vs surface (`white`)
- Bordures 1px (`border`/`borderSubtle`)
- Pastilles teintées (`levelTint`, bannières URL colorées)
- Cercles/icônes à fond pastel

## Shapes

- **Bords arrondis :** `sm:10px` (champs), `md:14px` (cartes/bannières), `lg:18px` (héros), `xl:24px`, `pill:999px` (boutons, pastilles).
- **Langage formel sobre :** Coins adoucis cohérents, pas de coins très anguleux ni de formes organiques.

## Components

### Buttons
- **Primary** (pill, `Bleu Signal`, texte blanc) : Action principale.
- **Outline** (pill, fond blanc, bordure `Bleu Signal`, texte `Bleu Signal`) : Action secondaire.
- **Ghost** (transparent, texte `Bleu Signal`) : Action discrète/tertaire.
- **Dark** (pill, fond noir) : Usage restreint.

### RiskBadge
Pastille pill avec `colors.risk` par niveau. Le niveau « Élevé » utilise un fond gris foncé (`#344054`) pour éviter un effet « alerte » permanent.

### Screen / ScreenHeader
- **Screen** : `SafeAreaView` + `KeyboardAvoidingView`, fond `canvas`, scroll optionnel.
- **ScreenHeader** : Flèche retour centrée avec titre centré (gras). Réutilisé sur les écrans de vérification de lien.

### Bannières URL
Cartes teintées selon le verdict (`dangerSoft` pour malicieux, `blueSoft` pour suspect, fond blanc + bordure pour neutre). La bande entière est cliquable vers `LinkGate` ; les actions `Copier`/`Partager` sont placées sous la bande (alignées, discrètes).

### Verdict Card (AnalysisResultScreen)
Carte héros centrée : pastille/icône teintée par niveau, **décision en phrases calmes** (`riskDecision`), description, `RiskBadge` + score en métadonnée secondaire. Pas d'anneau de score proéminent.

### LinkGateScreen
État BLOCK : héros centré sobre, carte avec `RiskBadge` + raisons + VT, `Ne pas ouvrir` en primaire, `Signaler` en outline, « J'ai compris le risque. Ouvrir quand même. » en lien discret hors zone pouce (confirmé par dialogue avant ouverture/signalement). Actions `Copier`/`Partager` disponibles.

## Do's and Don'ts

### Do:
- **Do** Mettre la décision en héros ; reléguer le score en métadonnée.
- **Do** Utiliser des bannières teintées + actions discrètes pour les URLs.
- **Do** Confirmer avant d'ouvrir malgré un risque ou de signaler.
- **Do** Préférer `dangerText` sur fond `dangerSoft` plutôt qu'un fond rouge plein.
- **Do** Garder la toile claire (`canvas` #F2F4F7), surfaces blanches.

### Don't:
- **Don't** Utiliser un fond noir ou des dégradés alarmistes.
- **Don't** Afficher « DANGEROUS » en majuscules brut comme titre principal.
- **Don't** Placer l'échappatoire « Ouvrir quand même » dans la zone pouce en priorité sur « Ne pas ouvrir ».
- **Don't** Créer des cartes web empilées sans hiérarchie.
- **Don't** Utiliser le rouge comme couleur de toile ou comme accent permanent.
