# SafeDM — Agent Implementation Plan

## Sprint 0 — Verrouiller l'architecture avant de coder plus loin

**Objectif :** trancher les 3 incohérences identifiées avant que du code supplémentaire ne soit écrit dessus.

**Décisions à prendre et documenter :**
1. **Séparer deux mécanismes distincts :**
   - (a) Hachage préservant la similarité (type SimHash/MinHash) pour l'agrégation hebdomadaire de motifs
   - (b) Chiffrement de transport standard (TLS) pour le chemin d'analyse temps réel vers le modèle distant
   - Ne plus appeler ce second chemin "chiffrement de bout en bout."

2. **Stockage côté serveur du vecteur transmis en temps réel :**
   - Confirmer qu'il reste non persisté (traité en mémoire, jamais écrit en base)
   - Vérifier que aucun log ne contient le contenu du message ou le vecteur brut

3. **Réécrire la section confidentialité du doc d'archi avec la formulation corrigée :**
   - Texte jamais transmis
   - Vecteur non textuel transmis seulement en cas d'incertitude et avec consentement

**Livrable :** document d'architecture corrigé et versionné, servant de référence pour tous les sprints suivants.

**Critère d'acceptation :** aucune affirmation du document ne peut être contredite par un autre passage du même document.

---

## Sprint 1 — Extraction de caractéristiques on-device

**Objectif :** finaliser le pipeline d'extraction des ~50 dimensions (textuelles, lien, contextuelles) côté React Native/Android, indépendamment du modèle de classification.

**Livrables :**
- Module d'extraction textuelle (mots-clés d'urgence, score de grammaire approximatif, ratio de majuscules, détection de langue)
- Module d'extraction de lien (raccourcisseurs connus, cohérence protocolaire, profondeur de sous-domaine) — avec fallback hors-ligne si appel VirusTotal échoue
- Module d'extraction contextuelle (horodatage, longueur du message)
- Vecteur normalisé assemblé en sortie, documentation du schéma de chaque dimension

**Critère d'acceptation :** le pipeline produit un vecteur complet pour un échantillon de messages de test en moins de 100ms, sans dépendance réseau pour les caractéristiques textuelles et contextuelles.

**Dépendance à utiliser :** `react-native-quick-crypto` pour toute opération
cryptographique. SimHash n'est pas une primitive cryptographique et reste une
implémentation native seulement si le contrat final le requiert. Le contrat
actuel utilise toutefois SHA-256 pour l'identifiant du vecteur : ne pas le
remplacer silencieusement par SimHash.

**Code à porter de `safedm-backend/app/utils/feature_extraction.py` vers JavaScript/TypeScript :**
- `extract_features(text, urls, known_bad_url, post_time_ms, package_name)` → `list<int>` de 50 éléments uint8
- Toutes les 50 features dans l'ordre `FEATURE_NAMES`
- Bornes : `LINK_RANGE` (0-15), `TEXT_RANGE` (16-36), `TYPO_RANGE` (37-41), `CONTEXT_RANGE` (41-45), `AGGREGATE_RANGE` (45-49)
- Unités uint8, pas de flottants — utiliser arithmétique entière `(count * 255) // cap`
- Normalisation NFKD + suppression diacritiques reproduite en JS

---

## Sprint 2 — Classification locale

**Objectif :** intégrer le modèle de classification embarqué (TFLite/LiteRT) dans l'app React Native via le pont natif, avec le seuil de décision défini dans le doc (85% / 40-85% / <40%).

**Livrables :**
- Intégration du runtime d'inférence dans l'app (pont natif Android via `react-native-fast-tflite`)
- Chargement du modèle initial (~5 Mo) depuis le bundle de l'app
- Logique de décision par seuil : ≥85% → décision finale, 40-85% → consultation distante optionnelle avec consentement, <40% → SAFE
- Benchmark de latence d'inférence sur device réel

**Critère d'acceptation :** inférence mesurée sous 100ms sur un device Android de milieu de gamme, les 3 branches de décision déclenchent le bon comportement UI.

**Dépendance :** `react-native-fast-tflite` (package Margelo, construit sur Nitro Modules) + `react-native-nitro-modules` (dépendance requise).

**Modèle à utiliser :** exporter le modèle TensorFlow/Keras entraîné en `.tflite`, attendre ~5 Mo. Le modèle attend un tenseur d'entrée 50-dimensions (le vecteur extrait par le pipeline Sprint 1).

---

## Sprint 3 — Signalement utilisateur et pipeline de hachage corrigé

**Objectif :** implémenter le flux de signalement avec le schéma corrigé du Sprint 0 (hachage préservant la similarité + enveloppe chiffrée pour transport, pas de confusion des deux).

**Livrables :**
- Génération du hash de similarité côté device (implémenter SimHash de base ou SHA-256 du vecteur)
- Enveloppe chiffrée (hash + métadonnées + étiquette + horodatage) pour la transmission avec `react-native-quick-crypto` (AES-256-GCM ou ChaCha20-Poly1305)
- Endpoint FastAPI de réception et stockage dans Firestore
- Base de signatures de menaces : `hash`, `type`, `date première observation`, `nombre rapports`, `score confiance agrégé`
- Politique de rétention (suppression après 6 mois d'inactivité) implémentée comme tâche planifiée (Cloud Scheduler → Cloud Run job), pas manuelle

**Critère d'acceptation :** un signalement de test traverse tout le flux (device → Firestore) et apparaît dans la base de signatures sans que le contenu du message ou le vecteur brut ne soit jamais loggé côté serveur.

**Algorithme SimHash à implémenter en Kotlin (module natif) ou JS :**
- Shingles de N octets (recommandé N=3)
- Hashage chaque shingle en entier 64-bit
- Vector bit-vote : pour chaque bit de chaque hash, si bit=1 incrémente, si bit=0 décrémente
- Résultat : vecteur 64-bit où bits majoritaires définissent la "direction" du hash
- Pour similarité : comparer deux vecteurs par distance Hamming sur les 64 bits

---

## Sprint 4 — Consultation distante temps réel (chemin incertitude 40-85%)

**Objectif :** implémenter le chemin optionnel vers l'analyse distante, avec le consentement explicite utilisateur et la terminologie corrigée (transport chiffré, pas E2E).

**Livrables :**
- Écran de consentement utilisateur clair avant toute transmission (opt-in explicite, pas case pré-cochée)
- Endpoint FastAPI qui reçoit le vecteur chiffré en transport, le traite en mémoire uniquement, l'envoie au modèle d'analyse distant (Jev/TypeSafe), retourne la classification, ne persiste rien
- Gestion du cas hors-ligne : si pas de connexion, le système retombe sur la demande de signalement manuel (pas de blocage de l'UI)

**Critère d'acceptation :** test de bout en bout avec consentement refusé (le système ne transmet rien et bascule sur signalement manuel) et consentement accepté (réponse reçue, rien de stocké côté serveur après traitement).

---

## Sprint 5 — Cycle hebdomadaire de correctifs

**Objectif :** automatiser l'agrégation, la génération de correctif, et le déploiement canari décrits dans le doc.

**Livrables :**
- Job planifié d'agrégation des signaux de la semaine (Cloud Scheduler déclenchant un Cloud Run job)
- Génération du fichier de correctif (poids ajustés, seuils, métriques d'amélioration) stocké dans Firebase Storage avec numéro de version
- Mécanisme de déploiement canari (1-5% des devices en premier, métriques comparées avant déploiement complet)
- Canal de mise à jour de l'app pour récupérer et appliquer les correctifs sans mise à jour complète du store

**Critère d'acceptation :** un correctif de test se propage au sous-ensemble canari, les métriques de comparaison (rappel, faux positifs) sont visibles avant la décision de déploiement complet.

---

## Sprint 6 — Durcissement et préparation scale

**Objectif :** combler les points de robustesse avant une présentation/démo à enjeu (jury, pilote entreprise).

**Livrables :**
- Tests de fonctionnement 100% hors-ligne (modèle en cache, aucune dépendance réseau bloquante)
- Journal d'audit des accès à la base de signatures de menaces (qui, quand, pourquoi)
- Relecture finale du document d'architecture avec les formulations de confidentialité corrigées, prêtes à être présentées sans contradiction interne
- Tableau de bord minimal de métriques (rappel, faux positifs, volume de signalements) pour la démo

**Critère d'acceptation :** le système fonctionne en mode avion de bout en bout, et la présentation du projet ne contient plus aucune affirmation de confidentialité contredite ailleurs dans la documentation.

---

## Coder charter — Inventaire du code existant (réutiliser / modifier / supprimer)

| Fichier/Module | Statut | Recommandation |
|----------------|--------|----------------|
| `safedm-backend/app/utils/feature_extraction.py` | Existe, 50 features uint8 | **Source de vérité** : réutiliser et porter fidèlement dans le mobile ; réaligner les fixtures/docs V2 historiques |
| `safedm-backend/app/utils/hashing.py` | Existe, SHA-256 raw+normalisé | **Réutiliser** : fonctions pures, non cryptographiques, porter en JS |
| `safedm-backend/app/services/analysis_service.py` | Pipeline complet actuel | **Modifier** : retirer dépendance VT complet pour analyse native, ajouter pipeline local + consentement opt-in |
| `safedm-backend/app/services/jev_service.py` | Intégration TypeSafe Jev | **Réutiliser sous réserve** : confirmer le fournisseur réel de « Jev » avant toute nouvelle intégration |
| `safedm-backend/app/services/fusion_service.py` | Seuils de décision | **Garder** : seuils déjà config via env vars, structure fine |
| `safedm-backend/app/api/v1/analysis.py` | Endpoints analyse | **Modifier** : ajouter branche locale, gestion consentement, 3 branches décision |
| `safedm-mobile/src/screens/ManualAnalysisScreen.jsx` | Interface analyse manuelle | **Réutiliser** : UI, mais modifier le flux d'analyse pour les 3 branches |
| `safedm-mobile/src/api/analysis.js` | Appel API analyse | **Modifier** : ajouter paramètre consentExternal, gérer les 3 branches UI |
| `safedm-mobile/src/api/client.js` | Client HTTP | **Réutiliser** : tel quel |
| `safedm-backend/.env` | Clés API dont VirusTotal | **Garder hors Git** : VirusTotal reste limité à la réputation d'URL avec fallback hors-ligne |
| `safedm-backend/app/models/` | Modèles SQLAlchemy | **Évaluer** : base signatures Firestore vs SQL (Sprint 3) |

---

## Phase 1 — Démarrage immédiat (Sprint 1)

## Audit produit — 2026-10-04

- Le dashboard admin reste servi sous `/api/v1`; il n'existe pas de `/api/v2`.
- Le fournisseur sémantique actif est Jev/TypeSafe; VirusTotal reste limité
  aux URLs. Les anciens libellés Gemini ont été retirés des interfaces.
- La page Opérations distingue maintenant résumé, actions rapides et détails
  dans des sheets; les actions de patch affichent un état de chargement.
- Le warning Fast Refresh du dashboard a été supprimé en séparant le contexte
  et le hook `useAuth`.
- L'entraînement local produit un patch JSON à poids entiers; l'export TFLite
  est une étape séparée pour Android. Le job hebdomadaire actuel agrège des
  métadonnées anonymes et ne réentraîne pas les poids.
- Le manifeste `/api/v1/models/latest` tient compte de l'état de déploiement :
  un patch rollbacké n'est plus servi et le rollout persistant est renvoyé.
- Reste à faire avant une production de patches : brancher le job Cloud
  Scheduler/Cloud Run, publier l'artefact TFLite signé, ajouter une promotion
  canary explicite et appliquer les politiques tenant au contexte d'analyse.

### Tâches à effectuer :

1. **Créer le répertoire** `safedm-mobile/src/features/` pour extraire le code de extraction
2. **Portager `extract_features`** de `feature_extraction.py` vers `safedm-mobile/src/features/featureExtractor.ts` (TypeScript)
   - Convertir toutes les opérations en arithmétique entière (pas de flottants)
   - Reproduire la normalisation NFKD + suppression diacritiques
   - Garder l'ordre exact `FEATURE_NAMES` et les bornes `LINK_RANGE`, `TEXT_RANGE`, etc.
   - Exporter `extract_features(text, urls?, known_bad_url?, post_time_ms?, package_name?)` → `number[]` de 50 éléments (0-255)
3. **Créer `safedm-mobile/src/features/index.ts`** exportant la fonction
4. **Tests unitaires** : valider contre un échantillon de messages known (comparer avec les fixtures Python ou les valeurs attendues)
5. **Intégrer dans** `ManualAnalysisScreen.jsx` : appeler le nouveau module d'extraction avant d'envoyer au backend

### Commandes à exécuter (après création des fichiers) :

```bash
# Vérifier la structure
ls safedm-mobile/src/features/

# Linter
npm run lint

# Tests unitaires
npm test
```

### Exemple de featureExtractor.ts structure :

```typescript
export const FEATURE_COUNT = 50;
export const FEATURE_NAMES: readonly string[] = [
  "has_url", "url_count", "shortened_url", "ip_url", "punycode", "suspicious_tld",
  "non_https_url", "url_atypical_port", "deep_subdomain", "brand_in_subdomain",
  "url_host_digit_ratio", "url_userinfo", "url_query_count", "url_executable_extension",
  "url_hyphen_count", "known_bad_url",
  "urgency", "credentials", "sensitive", "payment", "threat", "imperative_cta",
  "crypto", "otp_code", "account_word", "bank_word", "delivery_word", "prize_word",
  "refund_word", "money_amount", "phone_number", "authority_claim", "urgency_count",
  "question_count", "first_person_pressure", "personal_salutation", "message_length",
  "exclamation_ratio", "all_caps_ratio", "digit_ratio", "obfuscation", "hour_off_hours",
  "is_weekend", "is_social_app", "notification_kind",
  "agg_urgency_index", "agg_link_risk", "agg_credential_pressure", "agg_social_engineering",
  "agg_total_risk"
];

// Borne pour catégorisation
export const LINK_RANGE = range(0, 16);
export const TEXT_RANGE = range(16, 37);
export const TYPO_RANGE = range(37, 41);
export const CONTEXT_RANGE = range(41, 45);
export const AGGREGATE_RANGE = range(45, 50);

// Valeur neutre known_bad_url
export const UNKNOWN_KNOWN_BAD_URL = 128;

// Helper arithmétique entière
const MAX_UINT8 = 255;
const scale = (count: number, cap: number): number => {
  if (cap <= 0) return 0;
  const clamped = Math.max(0, Math.min(count, cap));
  return Math.floor((clamped * MAX_UINT8) / cap);
};

// _contains_word équivalent en JS avec frontiere de mot
const containsWord = (text: string, needle: string): boolean => {
  const internalSeparator = r"[-'*_.]*";
  const chars = [...needle].map(ch => escapeRegExp(ch));
  const spaced = internalSeparator.join(chars);
  const spacedRegex = spaced.replace(r"\\ ", r"[\\s-'_]+");
  const pattern = `(?<![a-z0-9])${spaced}(?![a-z0-9])`;
  return RegExp(pattern, "i").test(text);
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ... implémenter toutes les features dans l'ordre FEATURE_NAMES
function extract_features(text: string, urls?: string[], known_bad_url?: number, post_time_ms?: number, package_name?: string): number[] {
  // ... corps complet porté depuis feature_extraction.py
  const result: number[] = [];
  // ... 50 features
  return result;
}

export { extract_features, FEATURE_COUNT, FEATURE_NAMES };
```

*Note: Le dépôt mobile utilise JavaScript et non TypeScript. Le portage doit
rester en `.js` tant qu'aucune configuration TypeScript n'est ajoutée. Avant
d'ajouter une dépendance, vérifier son existence, sa maintenance et sa
compatibilité avec Expo SDK 52.*

---

## État de travail — 2026-10-04

### Inventaire confirmé avant Sprint 1

- **Réutiliser tel quel :** `client.js`, les écrans d'analyse/paramètres, les
  repositories de menaces et les helpers de hash existants.
- **Réutiliser en modifiant :** `feature_extraction.py`, le service d'analyse,
  `analysis.js` et le module Kotlin de notification. Le consentement externe
  est déjà refusé par défaut et aucun corps de message n'est écrit dans les
  logs.
- **Conserver mais isoler :** `virustotal_service.py`, uniquement pour la
  réputation d'URL ; il ne doit pas recevoir le message complet.
- **Ne pas réutiliser pour la classification locale :** une classification
  complète fondée sur VirusTotal. Le modèle local doit décider hors-ligne.
- **Architecture constatée :** le backend et Kotlin implémentent le contrat
  V3 de 50 features uint8. `docs/FEATURE_SCHEMA.md` et la fixture historique
  V2 de 20 features doivent être réalignés avant de déclarer la parité.

### Recherche de pratiques externes

- `react-native-fast-tflite` est maintenu et compatible Nitro Modules ; les
  points de vigilance sont la forme exacte du tenseur, les opérateurs supportés,
  le passage `ArrayBuffer` et l'inférence hors thread UI.
- Les retours FastAPI sur les flux IA sensibles convergent sur : pas de body
  dans les logs, consentement explicite contrôlé avant forwarding, et erreurs
  visibles plutôt qu'un fallback `SAFE`.
- Ces éléments justifient la séquence retenue : corriger le contrat et les
  tests, puis vérifier la shape `.tflite`, puis seulement ajouter le runtime
  mobile.

### Décisions Sprint 0

1. Le hash de similarité/déduplication et le chiffrement de transport sont
   deux mécanismes distincts. TLS protège le transport ; il ne sera pas appelé
   « chiffrement de bout en bout ».
2. Le vecteur envoyé pour une consultation distante n'est jamais persisté côté
   serveur et ne doit apparaître dans aucun log.
3. Le texte reste local par défaut ; un vecteur non textuel ne sort qu'après
   consentement explicite, et l'absence de réseau revient à une décision
   `UNKNOWN`/signalement manuel.
4. Le nom « Jev » est conservé uniquement pour le service TypeSafe déjà présent.
   Toute nouvelle intégration attend la confirmation explicite du fournisseur
   réel.

### Prochaine tranche exécutable

1. Réaligner `FEATURE_SCHEMA.md`, la fixture et les tests sur les 50 features
   déjà implémentées.
2. Ajouter le portage JavaScript sans modifier le contrat Kotlin existant.
3. Vérifier la parité Python/Kotlin/JavaScript et la latence sous 100 ms sur un
   appareil réel avant de commencer Sprint 2.

### Checkpoint — 2026-10-04

- Contrat V3 de 50 features répercuté dans `docs/FEATURE_SCHEMA.md`,
  `docs/ARCHITECTURE.md`, la fixture et `tests/test_feature_extraction.py`.
- Tests ciblés backend : **86 passed**.
- Suite backend complète : **127 passed, 3 failed, 18 errors, 2 skipped** ;
  les échecs restants sont des tests d'intégration dépendant de PostgreSQL
  local indisponible sur cette machine (`localhost:5432`).
- Tests mobiles non exécutés : `node_modules` absent (`jest: command not found`).
- Aucun package mobile ajouté sans validation ; l'intégration
  `react-native-fast-tflite` reste planifiée après vérification de la shape du
  modèle et de la compatibilité Expo.
- Le module Kotlin `FeatureExtraction.kt` existe déjà et couvre l'extraction
  on-device V3 ; il est réutilisé plutôt que dupliquer une seconde
  implémentation JavaScript. Le portage JS ne sera ajouté que si un appel
  depuis l'UI devient réellement nécessaire.
- Le Sprint 2 est intégré côté code et tests ; sa clôture opérationnelle
  reste conditionnée par un benchmark sur appareil Android réel. Le runtime
  officiel
  `react-native-fast-tflite@3.0.1` et `react-native-nitro-modules@0.37.1` sont
  ajoutés, Metro accepte `.tflite`, le pont natif expose l'extraction V3 et la
  décision 85/40 est testée.
- La revue a réaligné `LocalThreatModel.kt` comme fallback historique V3 de
  50 features ; il ne doit pas être présenté comme le runtime TFLite officiel.
- Validation mobile : les 9 tests Jest passent et les fichiers Sprint 2
  passent ESLint. Le warning React de `__tests__/App.test.js` reste sans échec
  de test.
- Un modèle réel `safedm_v3.tflite` est maintenant embarqué dans
  `safedm-mobile/assets/models/`. Il a été exporté depuis le classifieur
  entraîné sur les fixtures existantes et validé par LiteRT avec entrée
  `[1,50] float32` et sortie `[1,1] float32`. Le dataset ne contient que
  28 exemples : le modèle est utilisable pour l'intégration et les tests,
  mais ne constitue pas encore une base de déploiement production.
- Les notifications Android transmettent maintenant les 50 features au bundle
  JS, qui applique le même modèle TFLite que l'analyse manuelle. Le chemin
  fastText qui classait le texte brut a été retiré du flux officiel.
- Reproduction de l'export : environnement Python 3.11 isolé avec TensorFlow
  CPU 2.20, puis `PYTHONPATH=safedm-backend python
  safedm-backend/scripts/export_tflite_model.py --out
  safedm-mobile/assets/models/safedm_v3.tflite`. La suite Jest mobile complète
  passe : **9 tests**, et les fichiers Sprint 2 ciblés passent ESLint.
- `benchmarkLocalModel()` fournit maintenant une mesure p50/p95/p99 dans le
  dev client ou une build release. Aucun appareil Android/ADB n'est disponible
  dans cet environnement : le seuil de 100 ms reste donc à mesurer sur le
  device cible.
- Le chargement mobile du modèle reste bundlé par défaut (`require` de
  `assets/models/safedm_v3.tflite`) ; `LOCAL_MODEL_URI` ne sert que de
  surcharge contrôlée. `react-native-quick-crypto@1.x` est maintenant installé
  et initialisé dans `index.js` pour l'enveloppe fingerprint.
- Sprint 4 implémenté : le chemin d'incertitude affiche un consentement
  explicite avant tout appel distant. Après acceptation, l'app chiffre
  uniquement le vecteur V3 de 50 features et appelle `POST /analysis/features`;
  le texte n'est pas inclus dans la requête. Le backend déchiffre en mémoire,
  appelle `JevService.analyze_features`, ne persiste rien et renvoie une
  réponse fusionnée. Refus, absence de clé ou hors-ligne restent des chemins
  non bloquants vers la décision locale/signalement manuel.
- Review Sprint 4 : tests backend ciblés `13 passed`, tests mobiles `9 passed`,
  compilation Python et `git diff --check` réussis. Le benchmark Android réel
  reste à faire sur un appareil/ADB disponible. La recherche communautaire
  confirme la minimisation des données, le consentement comme garde réseau et
  le traitement des vecteurs comme données potentiellement sensibles ; le
  vecteur reste donc chiffré en enveloppe et non persisté.
- Sprint 5 démarré : `weekly_patch_service.py` agrège uniquement les
  métadonnées anonymes des rapports actifs des 7 derniers jours et génère un
  manifeste déterministe `policy-<timestamp>.json` avec checksum, seuils,
  métriques explicitement `unlabeled_data` et rollout canary à 1%. Le job
  `scripts/generate_weekly_patch.py` est prévu pour Cloud Run Job + Cloud
  Scheduler et supporte les retries par sortie déterministe.
- Le mobile peut récupérer `/models/latest`, sélectionner les appareils canary
  par identifiant stable, télécharger un modèle TFLite, vérifier son SHA-256 et
  l'activer via AsyncStorage sans mise à jour du store. Une URL de modèle doit
  être fournie par `MODEL_PATCH_URL`; sans manifeste ou URL valide, le modèle
  bundlé reste utilisé.
- Revue Sprint 5 corrigée : le checksum du fichier `.tflite` est maintenant
  séparé du checksum du manifeste (`artifact_sha256` vs `manifest_sha256`).
  L'ancien contrat envoyait le hash du manifeste comme si c'était le hash du
  modèle, ce qui pouvait rejeter tous les téléchargements valides.
  L'activation mobile vérifie aussi l'existence locale, impose une URL HTTPS et
  retombe sur le modèle bundlé si le modèle distant échoue au chargement.
- Sprint 6 implémenté : ajout de `access_audit_logs` (migration Alembic 0003)
  avec acteur, action, ressource, finalité et horodatage pour les lectures de
  la base de signatures. Le contrat hors-ligne conserve le modèle bundlé et
  les métriques de correctif refusent de déclarer rappel/faux positifs sans
  labels (`unlabeled_data`).
- Le dashboard admin expose maintenant les métriques du manifeste (rappel et
  faux positifs) en affichant `N/D` tant que le manifeste n'a pas de labels ;
  le volume des signalements existait déjà dans les statistiques 7 jours.
- Le rafraîchissement du manifeste est maintenant lancé au démarrage de
  l'application mobile. Toute indisponibilité réseau est absorbée et conserve
  le modèle bundlé ; aucune mise à jour distante ne bloque l'inférence.
- Revue générale : `/models/latest` exige maintenant l'authentification
  utilisateur et renvoie `Cache-Control: no-store`; un manifeste sans version
  est rejeté. Le modèle reste donc distribué par le chemin authentifié et
  vérifié par checksum côté appareil.
- Signature des manifestes ajoutée : le job signe le manifeste avec RSA
  PKCS#1 v1.5/SHA-256 et le mobile vérifie la signature avec une clé publique
  distincte avant téléchargement. Générer les clés avec
  `scripts/generate_model_signing_key.py`; la clé privée doit rester dans
  Secret Manager et seule la clé publique doit entrer dans la configuration
  mobile.
- Des fichiers de déploiement de référence sont présents sous `deploy/` pour
  Cloud Run Job et les variables Cloud Run. Ils restent volontairement
  paramétrés : le projet GCP, la région, le registre, les secrets et le bucket
  doivent être fournis avant exécution.
- État d'atteinte des objectifs : les Sprints 0-6 sont couverts par le code
  et les tests ciblés, mais la cible d'infrastructure n'est pas encore
  entièrement atteinte. Les signatures restent dans PostgreSQL (pas Firestore),
  les artefacts restent dans le répertoire local (pas Firebase Storage/GCS),
  et aucun Cloud Scheduler/Cloud Run Job n'est déployé depuis ce dépôt.
  Le benchmark Android réel et la mesure de rappel/faux positifs sur un jeu
  labellisé restent également ouverts.
- Inventaire final : réutiliser `feature_extraction.py`, les repositories,
  `AnalysisService`, `JevService` et les écrans existants; modifier les routes
  d'analyse, le consentement, la classification TFLite et les mises à jour de
  modèle; conserver VirusTotal uniquement pour les URLs; ne pas utiliser le
  chemin fastText pour la décision officielle.
- Correction de la migration d'audit : elle fusionne explicitement les deux
  branches Alembic historiques `0002_link_gate_events` et
  `0002_similarity_fingerprint_reports`, évitant un head multiple au déploiement.
- Revue de transition Sprint 3 : les tables SQL `threats` et
  `community_reports`, les endpoints `/reports` et les hachages SHA-256
  existent déjà et sont réutilisables. En revanche, le hachage de similarité
  SimHash et l'enveloppe de signalement sans contenu persistent restent à
  implémenter ; le chemin actuel conserve encore le contenu et n'est pas
  conforme au livrable Sprint 3.
- Sprint 3 implémenté en réutilisant ces tables : `POST /reports/fingerprint`
  reçoit uniquement un SimHash 64-bit, la sévérité, la source et des
  métadonnées ; les signalements fingerprint créent une menace sans contenu.
  Le SimHash est calculé côté Kotlin et sa référence Python est testée. Les
  notifications transmettent `similarityHash` au JS, et l'écran de détail
  utilise le nouvel endpoint sans envoyer le texte.
- La migration `0002_similarity_fingerprint_reports` rend `threats.content`
  nullable et ajoute `similarity_hash`. La purge des fingerprints inactifs
  après 183 jours est disponible via
  `scripts/purge_inactive_fingerprints.py`, prévue pour un Cloud Run Job
  déclenché par Cloud Scheduler.
- Correction migration : l'identifiant Alembic historique
  `0002_similarity_fingerprint_reports` dépassait la limite `VARCHAR(32)` de
  la table `alembic_version`. Il est maintenant enregistré sous
  `0002_similarity_reports`; la chaîne complète atteint bien
  `0004_admin_operations`.
- Validation Sprint 3 : **8 tests backend passent** dans `safedm-backend/.venv`
  (hash de similarité et schéma SQL), **9 tests mobile passent**, et
  `git diff --check` passe. Le lint ciblé des fichiers Sprint 3 est bloqué par
  des erreurs préexistantes dans `AlertDetailScreen.jsx`; aucune correction
  hors périmètre n'a été appliquée.
- Revue de chaîne : notification Android → `SimilarityHash` → payload JS →
  `createFingerprintReport` → `/reports/fingerprint` → SQL → purge est
  raccordée. La consultation par hash inclut désormais aussi le fingerprint.
  La suite backend complète a encore des erreurs d'intégration liées à
  PostgreSQL local indisponible, comme dans les validations précédentes.
- Écart restant de conformité Sprint 3 : l'« enveloppe chiffrée » applicative
- est maintenant implémentée : AES-256-GCM côté mobile, clé AES enveloppée
  avec RSA-OAEP/SHA-256, et déchiffrement côté FastAPI via `cryptography`.
  La clé privée backend est fournie uniquement par
  `FINGERPRINT_PRIVATE_KEY_PEM_B64`; la clé publique mobile est injectée par
  `FINGERPRINT_PUBLIC_KEY`. Le script
  `scripts/generate_fingerprint_keys.py` génère les deux valeurs sans écrire
  de secret dans le dépôt.
- Un fichier `.env` local contient une valeur de clé API ; il reste hors Git,
  mais cette clé doit être révoquée/rotée si elle a été partagée ou exposée.

## Phase de démarrage — À exécuter maintenant

Je commence par :
1. Créer la structure de fichiers pour Sprint 1
2. Portager la première partie des features (bloc LIENS 0-15)
3. Valider avec un test rapide

Passons à l'action.

## Sprint 7 — Administration production et exploitation

**Décision :** le dashboard reste React/Vite. Une migration SvelteKit a été
écartée pour éviter deux runtimes et une réécriture sans bénéfice opérationnel
immédiat.

**Livré :**
- appels API et états de chargement de `StatsPage` déplacés dans des hooks
  réutilisables (`useAsyncResource`, `useAdminStats`) ;
- nouvelle page Opérations (`/operations`) couvrant le manifest/canary, le
  dernier cycle d'agrégation, le journal d'audit récent, les seuils actuels et
  la rétention ;
- endpoint backend authentifié `/api/v1/admin/operations/overview` ;
- surfaces admin aplaties : couleurs pleines, hiérarchie par espacement,
  bordures et rayons réduits, sans gradients ni décoration superflue ;
- guide de déploiement production dans
  `docs/PRODUCTION_DEPLOYMENT.md`.

**Limites explicites à traiter avant un pilote entreprise :**
- Firebase Auth et custom claims ne sont pas encore la source d'identité de
  l'API ; l'autorisation backend JWT `is_admin` reste active ;
- la configuration par entreprise/région n'est pas encore persistée ;
- l'agrégation est encore signalée depuis le manifest local tant que Cloud Run
  Job, Scheduler et stockage objet ne sont pas déployés ;
- l'endpoint d'opérations expose uniquement les données déjà vérifiables et ne
  simule aucune métrique manquante.

### ML ops MVP (datasets → train → canary, hors Play Store)

- Doc : `docs/ML_OPS_FIREBASE.md` (jobs sans Cloud Scheduler, canary `%`
  appareils, migration Firebase progressive Auth → Storage → FCM).
- API admin : `/admin/ml/datasets`, `/admin/ml/runs`, promote canary
  (`ml_ops_service` + migration `0005`).
- Dashboard : page **Entraînement** (`/training`) — upload JSON/CSV, logs,
  métriques, promote.
- Job alternatif : `.github/workflows/train-model.yml` (`workflow_dispatch` +
  cron hebdo optionnel).

### Passe UX/UI — chargement, cache et hiérarchie

- `useAsyncResource` fournit maintenant cache `sessionStorage` à TTL, cache
  stale-while-refresh, annulation des requêtes précédentes avec
  `AbortController`, erreurs explicites et distinction `loading`/`refreshing`.
- `StatsPage` et `OperationsPage` affichent un skeleton initial, un indicateur
  de fraîcheur et une actualisation sans effacer les données déjà visibles.
- La déconnexion invalide les caches admin ; une réponse 401 déclenche le même
  nettoyage via `clearSession`.
- Les surfaces ont été aplaties : statistiques sous forme de repères visuels,
  panneaux sans ombres ni bordures décoratives, espacements et contrastes
  utilisés pour la hiérarchie, et états vides/erreurs conservés.
- Les appels acceptent désormais un `AbortSignal`, afin d'éviter qu'une
  réponse obsolète ne remplace une donnée plus récente.

## Sprint 8 — Workflows admin haute et moyenne priorité

**Livré :**
- migration `0004_admin_operations` pour persister les déploiements de patch,
  les demandes d'agrégation et les politiques par entreprise/région ;
- approbation et rollback de patchs avec état `APPROVED`/`ROLLED_BACK`,
  pourcentage de rollout et acteur d'approbation ;
- demande manuelle d'agrégation avec état `REQUESTED`, sans prétendre exécuter
  Cloud Run tant que le job n'est pas déployé ;
- configuration persistée des seuils `safe`, `suspicious`, `critical` et de
  confiance d'escalade par tenant/région ;
- flag serveur de faux positif sur une menace, avec passage en `DISMISSED` et
  entrée d'audit ;
- journalisation des actions sensibles d'administration ;
- visibilité accrue de la rétention avec le nombre de signatures candidates ;
- contrôles UI pour approuver/rollback, demander l'agrégation, enregistrer une
  politique et marquer un faux positif.

**À finaliser avant production complète :**
- fédérer l'identité avec Firebase Auth et valider les custom claims côté API ;
- connecter le statut `REQUESTED` au déclenchement OIDC Cloud Scheduler/Cloud
  Run Job et faire remonter les logs d'exécution ;
- ajouter pagination/filtres dédiés à l'écran d'audit et alimenter les
  métriques régionales depuis des événements portant une région fiable ;
- verrouiller les transitions de patch avec une approbation multi-admin si la
  politique de déploiement l'exige.

### Revue finale — cohérence, avertissements et commandes locales

- `scripts/generate_weekly_patch.py` ajoute désormais le backend au chemin
  d'import, donc `python scripts/generate_weekly_patch.py --help` et son
  exécution fonctionnent depuis `safedm-backend`.
- Le warning Fast Refresh du dashboard a été supprimé en séparant le contexte
  d'authentification et son hook.
- Le test mobile utilise un faux `NavigationContainer` compatible avec les
  refs React et n'émet plus le warning de ref ; les erreurs attendues de mise à
  jour du modèle ne sont pas journalisées pendant Jest.
- Dashboard : build et lint validés. Backend : 38 tests ciblés validés.
  Mobile : lint et 9 tests validés.
- La page Operations indique explicitement que les seuils affichés sont les
  seuils globaux de secours ; les politiques tenant/région enregistrées restent
  auditées mais attendent le contexte tenant de `/analysis`.

## Sprint 9 — Mobile démo-bloquant (P0 / P1 privacy)

**Livré (2026-10-07) :**
- Bridge natif corrigé : `NativeModules.SafeDMNotifications` (aligné sur
  `SafeDMNotificationsModule.NAME`) + mocks Jest.
- Plugin `withSafeDMNotifications` : copie Kotlin par package déclaré
  (`features` / `notifications` / `safedm.nls`) ; exclus `*Check.kt` de l’APK ;
  imports `FeatureExtraction` ajoutés côté NLS/module.
- Consentement contenu : Home / Manuel / détail alerte passent par
  `ensureContentUploadConsent` ou opt-in Paramètres avant `consent_external`.
- Confidentialité : masquer aperçus, « Tout effacer », note honnête sur
  stockage local plaintext ; rétention 7 j / 200 alertes.
- JWT migré vers `expo-secure-store` (migration AsyncStorage one-shot).
- README mobile : setup démo, prebuild, EAS preview.

**Validation :**
- `cd safedm-mobile && npm test` → 9 passed
- `npm run lint` → OK

**Écarts restants :** APK non généré ici ; modèle TFLite toy ; chiffrement
AsyncStorage des textes d’alertes non implémenté (effacement + masquage
seulement).

## Sprint 10 — Restructure backend (layout + Makefile + Docker)

**Livré :**
- Package offline `ml/` (`data`, `features`, `models`, `evaluation`) ; API
  FastAPI reste sous `app/` (contrat `/api/v1` intact).
- Dossiers `config/`, `data/`, `models/artifacts|metadata`, `notebooks/`,
  `outputs/`, `deployment/docker/Dockerfile.api`.
- Tests migrés vers `tests/unit/` et `tests/integration/` (fixtures inchangées).
- `Makefile` (`help`, `install`, `test`, `lint`, `train`, `evaluate`, `serve`,
  `migrate`, `docker-up`).
- `docker-compose.yml` : postgres + service `api`.

**Validation :** `uv run pytest -q` (suite verte après migration chemins fixtures).

## Sprint 11 — Cycle ML (train / evaluate / registry)

**Livré :**
- `ml.models.training.train_and_export` + wrapper `scripts/train_local_model.py`.
- `make train` → patch JSON signé + `models/metadata/model_registry.json`.
- `make evaluate` → métriques CV + smoke parity 50-dim.
- Dataset stable : `data/processed/labeled_messages.json` (préféré) /
  `data/raw/…`.
- Artefact officiel = logistic JSON signé ; TFLite = export optionnel
  (`scripts/export_tflite_model.py`).
- `docs/model_card.md`, `docs/model_training.md`.

**Note :** avec ~28 samples le verdict reste souvent « research / non
deployable » — attendu.

## Sprint 12 — Qualité backend légère

**Livré :**
- Rate limiting in-memory auth + `/analysis` (`RATE_LIMIT_ENABLED`, désactivé
  en pytest).
- `GET /api/v1/health/ready` (ping DB, 503 si down).
- Gardes `analyze_features` alignées sur `analyze` (demo mode / clé manquante).
- Logging JSON optionnel (`JSON_LOGS`).
- Docs backend `docs/architecture.md` + README Makefile.

**Bilan programme mobile + backend :** Sprints 9–12 livrés. Hors scope
volontaire : Streamlit, MLflow, k8s, GE, dashboard/extension.

## Sprint 13 — Restructure & ménage mobile

**Livré :**
- Suppression `scripts/`, `src/features/`, `localThreatBenchmark.js`, logos
  inutilisés, `safedm_v3.json` orphelin.
- Plugin : exclus FastText + LocalTextClassifier + `*Check.kt`.
- Config hors theme (`API_BASE_URL` / `APP_VERSION` via `config.js`).
- `.env.example` complet (APP_ENV, fingerprint, OTA).

## Sprint 14 — Full fonctionnel

**Livré :**
- Cleartext limité (prod/EAS apk|production off ; network_security localhost).
- Soft-fail fingerprint crypto (`FINGERPRINT_KEY_MISSING`).
- Apps : sync native local-first si API down.
- Écran Diagnostic.
- CI GitHub : `ci.yml` + `mobile-apk.yml` (EAS → Release APK versionné).
- Doc `docs/MOBILE_CI.md`.

## Sprint 15 — Autorisations / OEM

**Livré :**
- Onboarding : Apps → NLS → Batterie → Link protection → MainTabs.
- Banner Accueil si NLS inactif + liens réglages.
- Plus de « setup done » immédiat après NLS seul.

## Sprint 16 — UX native

**Livré :**
- Tokens canvas/surface, Welcome honnête (local-first + rétention 7 j).
- Alertes en liste (pas cartes web), tab bar safe-area, Screen canvas.
- CTA bas d’écran sur permissions / batterie / welcome.

## Sprint 17 — Polish CI

**Livré avec 14–16 :** workflows CI + release APK, README mobile, diagnostic.

**Suite branding + offline :**
- Kit `src/assets/brand/` (simplify / full / text / icon) + `icon.png` /
  `adaptive-icon.png` (1024²) + `splash.png`.
- `SafeDMLogo` / `BrandMark` (icon | full | text) ; `app.config` icon/splash ;
  `expo-splash-screen` hide après bootstrap.
- Bannière `OfflineBanner` (NetInfo) — analyse locale OK, cloud indispo.
Filtres alertes avancés restent améliorations futures.