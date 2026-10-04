# SafeDM — Architecture post-MVP

## Confidentialité de référence

La classification par défaut est locale. Le texte du message reste sur
l'appareil et n'est pas transmis au backend pour l'inférence locale.

Quand la confiance locale est insuffisante, l'application peut proposer une
consultation distante. Cette consultation est un **opt-in explicite** :
l'utilisateur peut refuser et le flux revient à `UNKNOWN`/signalement manuel.
Avec accord, seul le vecteur non textuel nécessaire est transmis sur un
transport TLS standard. TLS protège le transport ; ce chemin n'est pas du
chiffrement de bout en bout.

Le backend traite ce vecteur en mémoire uniquement. Il ne le persiste pas, ne
persiste pas le texte et ne l'écrit pas dans les logs. Le service distant réel
derrière le nom de code « Jev » doit être confirmé avant toute nouvelle
intégration ; le code existant TypeSafe est réutilisé sans inventer d'API.

## Deux mécanismes à ne pas confondre

1. **Empreinte de motif :** SHA-256 du vecteur pour l'identification actuelle.
   Une future agrégation de quasi-doublons peut utiliser SimHash/MinHash, sans
   en faire une primitive de chiffrement.
2. **Transport :** TLS pour les appels autorisés. Le chiffrement applicatif
   éventuel utilisera une bibliothèque maintenue (`react-native-quick-crypto`
   côté mobile et `cryptography` côté Python), jamais une implémentation maison.

## Flux et stockage

- Extraction des caractéristiques : appareil, hors ligne par défaut.
- Inférence locale : modèle TFLite/LiteRT avec entrée de forme vérifiée avant
  branchement UI.
- Réputation d'URL : VirusTotal facultatif, URL uniquement, fallback local.
- Signalement : hash et métadonnées minimales ; jamais le contenu ni le
  vecteur brut.
- Persistance cible post-MVP : Firestore pour les signatures et Storage pour
  les versions de modèle/correctif. Le MVP existant PostgreSQL reste réutilisé
  tant que la migration n'est pas implémentée.

## Règle de cohérence

Toute documentation, route ou écran qui affirme « sûr » doit préciser la
source de la décision. Une absence de réseau ou de consentement ne peut jamais
être convertie silencieusement en `SAFE`.
