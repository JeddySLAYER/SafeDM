# SafeDM — bilan fonctionnel et revue de session

Date de revue : 4 octobre 2026  
Branche : `review/operations-pipeline-mobile`

## Réponse courte : combien de features mobiles ?

Il faut distinguer deux notions :

- **Le modèle mobile extrait exactement 50 features numériques** par notification.
  Le contrat est `FEATURE_COUNT = 50`, avec des valeurs `uint8` comprises entre
  `0` et `255`. Ce n’est pas “50 fonctionnalités de l’application” : ce sont
  les signaux utilisés par le modèle pour décider si un contenu est sûr,
  incertain ou dangereux.
- **L’application mobile possède actuellement 4 onglets principaux** :
  Accueil, Alertes, Signalements et Paramètres.
- La navigation complète expose **15 écrans/routes fonctionnels** :
  Accueil, Alertes, Signalements, Paramètres, Applications surveillées,
  Permissions notifications, Analyse manuelle, Résultat d’analyse,
  Vérification de lien, Protection des liens, Détail d’alerte, Guide,
  Article du guide et Communauté. Les écrans d’authentification et
  d’onboarding s’ajoutent à cette liste.

## Ce qui a été réalisé

### Backend et API

- API FastAPI versionnée sous `/api/v1`.
- Authentification JWT, rôles utilisateur/admin et comptes de test.
- Migrations Alembic réparées et exécutées jusqu’à la migration admin.
- Analyse locale, analyse sémantique Jev/TypeSafe et réputation URL VirusTotal.
- Consentement explicite avant toute sortie de contenu vers le cloud.
- Gestion des utilisateurs, applications, préférences de surveillance,
  signalements, menaces et guide.
- Statistiques admin robustes face aux réponses nulles et aux erreurs.
- Opérations admin pour audit, politiques, patchs, manifestes, approbation et
  rollback.
- Tests d’intégration stabilisés avec seeds de données de référence :
  `159 passed, 6 deselected` lors de la dernière validation complète.

### Dashboard admin

- Cartes de statistiques sans bordure basse artificielle.
- Skeletons, loaders et états d’erreur plus cohérents.
- Sheets d’aide et de détails au lieu de confirmations ou détails natifs.
- Confirmations applicatives SafeDM à la place de `window.confirm()`.
- Page Guide en plein écran avec rédaction, aperçu et organisation.
- Page Operations revue avec audit élargi, rétention, patchs, agrégation,
  rollback et explication de la politique Sûr/Suspect/Critique.
- Sheet d’audit élargi jusqu’à environ `1040px`, avec scroll horizontal mobile.
- Fiches rapides utilisateurs et menaces avec loaders.
- Parcours déconnexion puis reconnexion corrigé.

### Mobile

- Authentification et onboarding.
- Sélection des applications surveillées, applications installées et logos
  Android.
- Permission Android `NotificationListenerService`.
- Filtrage natif par packages surveillés, avec variantes WhatsApp/SMS/Email.
- File native pour les notifications reçues avant l’initialisation JavaScript.
- Extraction native du vecteur V3 de **50 features**.
- Classification locale TFLite avec décisions `SAFE`, `UNCERTAIN`,
  `DANGEROUS` et `UNAVAILABLE`.
- Historique local limité à 7 jours et 200 alertes maximum.
- Analyse manuelle de texte avec possibilité d’enrichissement cloud.
- Protection de liens avant ouverture dans le navigateur externe.
- Réception de liens via intent Android, deep link Expo et partage.
- Consentement cloud explicite dans les paramètres.
- Guide de bonnes pratiques, communauté et signalement direct.
- Tests Jest et mocks du bridge natif.

### Extension navigateur

- Consentement explicite pour les analyses lancées par l’utilisateur.
- Timeout réseau de 15 secondes.
- HTTPS obligatoire pour les APIs distantes ; localhost autorisé en local.
- Content scripts limités aux pages HTTP/HTTPS.
- Page Options MV3 dédiée pour l’API, le test `/health`, la réinitialisation
  et l’effacement de session sans afficher le JWT.
- README extension mis à jour.
- Lint et build de production validés.

## Fonctionnement actuel de la lecture des notifications

1. Android reçoit une notification.
2. Le service natif ignore les notifications persistantes et les packages non
   sélectionnés.
3. Le titre et le texte sont extraits localement.
4. Les 50 features sont calculées dans le code natif.
5. Le modèle local produit un score et une décision.
6. Une alerte est conservée localement, avec rétention et limite de volume.
7. Si le compte est connecté **et** que le consentement cloud est activé,
   le contenu peut être envoyé à l’API pour enrichissement.
8. Le résultat cloud remplace alors le verdict local ; en cas d’échec réseau,
   le verdict local reste disponible.

Le système ne bloque ni ne modifie la notification d’origine. La lecture est
actuellement Android-first ; le module natif Notification Listener nécessite un
dev client ou un build natif, et ne fonctionne pas dans Expo Go standard.

## Ce qui reste à faire ou mérite une amélioration

### Priorité haute — confidentialité et confiance

- Chiffrer l’historique local : les textes sont aujourd’hui stockés dans
  `AsyncStorage`, qui ne doit pas être considéré comme un coffre sécurisé.
- Ajouter une durée de rétention configurable et un bouton “Tout effacer”.
- Ajouter un mode de confidentialité : masquer le contenu sensible dans les
  aperçus et les captures d’écran.
- Afficher un journal local minimal : traité localement, envoyé au cloud,
  refusé, ou échec réseau.
- Afficher clairement quels packages sont surveillés et quand la capture est
  active.

### Priorité haute — expérience de lecture

- Ajouter des filtres par risque, application et période.
- Ajouter des actions “Ignorer”, “Marquer comme traité”, “Signaler” et
  “Faux positif”.
- Regrouper les notifications similaires pour éviter les doublons.
- Afficher les raisons compréhensibles du verdict sans exposer le vecteur brut.
- Ajouter un résumé local court pour les notifications longues, sans envoyer le
  texte au cloud par défaut.
- Ajouter une notification SafeDM optionnelle pour les risques élevés, avec
  contenu masqué sur l’écran verrouillé.

### Priorité moyenne — robustesse Android

- Gérer explicitement les restrictions batterie et les constructeurs qui
  arrêtent les services.
- Ajouter un écran de diagnostic : accès actif, dernière notification reçue,
  dernière extraction, dernier enrichissement cloud.
- Dédupliquer avec un identifiant Android de notification et non seulement un
  identifiant aléatoire local.
- Tester les notifications groupées, réponses directes, gros textes,
  conversations et médias.
- Ajouter une stratégie de reprise si la file native atteint sa limite.

### Priorité moyenne — produit et backend

- Appliquer réellement les politiques tenant/région au runtime `/analysis`.
- Formaliser la promotion canary vers 100 %.
- Déclencher l’agrégation hebdomadaire via Cloud Run ou un scheduler réel.
- Ajouter une vérification automatique de compatibilité manifest/TFLite.
- Finaliser l’application mobile des patches et le rollback signé.
- Décider explicitement si l’analyse cloud doit accepter les notifications
  ou seulement les analyses manuelles.

## Revue de cohérence et risques connus

- Les warnings `contentscript.js`, `ObjectMultiplex` et
  `MaxListenersExceededWarning` observés dans le navigateur viennent d’une
  extension externe, pas du code SafeDM.
- Le warning `passlib` autour de `crypt` est une dépréciation de dépendance,
  pas un échec fonctionnel SafeDM.
- Le stockage local de texte sensible en clair est le principal point de
  sécurité mobile restant.
- L’accès Android aux notifications est une permission très sensible :
  l’onboarding doit rester explicite et le mode local doit être le défaut.
- Le build versionné de l’extension est suivi par Git ; chaque build peut
  remplacer des fichiers hashés dans `build/assets`.
- Jev/TypeSafe est utilisé pour la sémantique ; Gemini n’est plus appelé par le
  backend actif. VirusTotal reste réservé à la réputation des URLs.
- L’API HTTP exposée reste en V1 ; les évolutions de modèle ou de politique ne
  constituent pas une API `/api/v2`.

## Roadmap recommandée

1. Chiffrer l’historique mobile et ajouter “Tout effacer”.
2. Ajouter filtres, déduplication et actions de traitement.
3. Ajouter un diagnostic de permission/service/batterie.
4. Ajouter une notification SafeDM optionnelle et masquée pour les risques
   élevés.
5. Ajouter les tests Android réels sur WhatsApp, SMS, Gmail, Outlook,
   notifications groupées et appareil verrouillé.
6. Appliquer les politiques backend au runtime et automatiser la pipeline de
   déploiement.

## Validations réalisées pendant la session

- Backend : suite complète validée avec `159 passed, 6 deselected`.
- Dashboard : lint et build validés.
- Mobile : lint et tests Jest validés lors des dernières passes.
- Extension : lint et build de production validés.
- Manifest extension : `options.html` présent et déclaré.
- Worktree propre avant la tranche Options ; les changements de cette revue
  sont regroupés dans le commit de documentation associé.

## Références de commits importants

- `a3ec2d2` — revue Operations et pipeline de déploiement.
- `7e1ffa1` — seeds de données de test backend.
- `95b6f5f` — loaders et sheets de détails dashboard.
- `800f892` — reconnexion après déconnexion.
- `aefe326` — dialogs applicatifs SafeDM.
- `ccf3eef` — audit sheet et politique de décision.
- `26254f4` — durcissement de l’extension.
- `0c30026` — page Options extension.
- `eb15484` — test de connectivité API extension.
