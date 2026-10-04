# SafeDM — guide de déploiement production

Ce guide décrit le chemin de mise en production vérifiable. Les valeurs
secrètes ne doivent jamais être placées dans Git, une image Docker, un fichier
`.env` partagé ou les logs CI.

## 1. Pré-requis et séparation des environnements

Créer des projets GCP séparés pour `staging` et `production`, puis activer
Cloud Run, Cloud Run Jobs, Cloud Scheduler, Artifact Registry, Secret Manager,
Cloud SQL (ou Firestore après migration) et Cloud Storage. Utiliser un compte
de service par workload : API, job hebdomadaire et scheduler ne doivent pas
partager le même compte.

Les domaines autorisés, les URLs CORS et les buckets doivent être propres à
chaque environnement. En production, `APP_ENV=production`, `DEBUG=false` et
`ANALYSIS_DEMO_MODE=false` sont obligatoires.

## 2. Secrets et identité

Stocker dans Secret Manager au minimum `SECRET_KEY`, les identifiants
TypeSafe/VirusTotal si activés, `FINGERPRINT_PRIVATE_KEY_PEM_B64` et
`MODEL_PATCH_SIGNING_KEY_PEM_B64`. Accorder uniquement `secretmanager.versions
 .access` au compte de service Cloud Run. La clé privée de signature ne doit
jamais être montée dans le dépôt ou l’image.

L’API applique aujourd’hui son contrôle `is_admin` sur le JWT. Avant un pilote
entreprise, remplacer ou fédérer cette source avec Firebase Auth et un custom
claim administrateur, puis conserver l’autorisation côté backend : un claim
présent dans le navigateur ne constitue jamais une permission.

## 3. Base et migrations

```bash
cd safedm-backend
.venv/bin/alembic upgrade head
.venv/bin/python -m compileall app
.venv/bin/pytest -q
```

Exécuter les migrations avec une identité dédiée avant de basculer le trafic.
Sauvegarder la base, tester une restauration et vérifier les index des menaces,
signalements et journaux d’audit. Les journaux sont append-only en production
et leur accès doit lui-même être autorisé et audité.

## 4. Image backend et Cloud Run

Construire une image immuable, la pousser dans Artifact Registry et déployer
avec `deploy/cloudrun.env.example` comme checklist de variables. Configurer :

- minimum d’instances à 1 pour éviter les cold starts pendant un pilote ;
- timeout et concurrence adaptés au chemin d’escalade ;
- probes `/api/v1/health` ;
- ingress privé ou contrôlé, HTTPS et domaine personnalisé ;
- compte de service sans rôle propriétaire ;
- `--no-allow-unauthenticated` si le proxy d’identité est devant l’API.

Après déploiement, vérifier `/health`, `/api/v1/admin/stats` et une requête
admin authentifiée. Ne jamais considérer une réponse `200` sans vérification
de l’identité comme un test d’autorisation.

## 5. Modèles, artefacts et signature

Générer la paire RSA hors dépôt, conserver la clé privée dans Secret Manager et
embarquer uniquement la clé publique dans l’application mobile. Publier le
modèle et son manifest dans un bucket privé. Le client vérifie séparément :

1. la signature RSA du manifest canonique ;
2. `artifact_sha256` du fichier téléchargé ;
3. la version, la forme `[1, 50]`, le type de sortie et la cohérence des
   `feature_names`.

Le modèle embarqué reste le fallback. Un échec de réseau, signature,
checksum ou chargement ne doit jamais bloquer la classification locale.

## 6. Job hebdomadaire et canary

Déployer `deploy/cloudrun-job.yaml` comme Cloud Run Job avec un compte de
service séparé. Créer un job Cloud Scheduler en OIDC qui invoque uniquement ce
job. Le job doit produire un manifest déterministe, publier les métriques et
rester en canary tant que le rappel, le taux de faux positifs et la latence
indépendants ne satisfont pas les seuils convenus.

Le rollback consiste à republier le dernier manifest signé connu comme sain,
pas à modifier manuellement un fichier dans le conteneur.

## 7. Dashboard admin

Le dashboard reste React/Vite. Les appels sont dans `services/adminApi.js`,
leur orchestration dans `src/hooks/`, et les pages se concentrent sur le rendu.
Le dashboard doit être servi en HTTPS avec CSP, `frame-ancestors 'none'`,
`Referrer-Policy: no-referrer`, et limitation réseau au domaine API.

La branche actuelle expose l’aperçu Opérations : signatures/menaces, canary,
audit, état d’agrégation, seuils et rétention. Les seuils
entreprise/région sont affichés comme configuration globale tant qu’un
repository de configuration tenant n’existe pas ; aucune valeur locale n’est
présentée comme une configuration persistée.

## 8. Vérifications avant ouverture

- tester connexion, rôle non-admin, expiration et révocation d’un token ;
- vérifier qu’un utilisateur final ne peut appeler aucune route `/admin` ;
- tester signature invalide, checksum invalide, modèle corrompu et mode avion ;
- tester la rétention sur données synthétiques et vérifier l’audit ;
- exécuter un benchmark Android release et confirmer le p95 cible ;
- charger un jeu de test labellisé indépendant avant de publier recall/FPR ;
- vérifier les logs : aucun message, vecteur brut, hash brut ou secret ;
- effectuer un test de restauration et documenter le RTO/RPO.

Un déploiement est production-ready seulement lorsque ces contrôles sont
passés dans l’environnement de staging avec les mêmes IAM et secrets que la
production.
