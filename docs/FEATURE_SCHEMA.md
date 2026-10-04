# SafeDM — Contrat des caractéristiques V3

Ce contrat est partagé par `safedm-backend/app/utils/feature_extraction.py`,
le module Kotlin de notification et le futur portage JavaScript. Le backend
Python est la source de vérité ; la fixture
`safedm-backend/tests/fixtures/feature_vectors.json` verrouille la parité.

## Invariants

- Le vecteur contient exactement **50 entiers uint8** dans `[0, 255]`.
- L'ordre ci-dessous est immuable dans la version 3. Ajouter, supprimer ou
  déplacer une caractéristique exige une nouvelle `schema_version`.
- Toutes les caractéristiques sauf `known_bad_url` sont calculables hors ligne.
  `128` signifie « verdict réseau inconnu », distinct de `0` (sûr) et `255`
  (malveillant).
- Les caractéristiques sont extraites séparément de l'inférence. Elles ne
  classent pas un message à elles seules.
- Les divisions sont entières : `scale(n, cap) = min(max(n, 0), cap) * 255 // cap`.

## Ordre et groupes

| Index | Nom | Groupe |
|---:|---|---|
| 0-15 | `has_url`, `url_count`, `shortened_url`, `ip_url`, `punycode`, `suspicious_tld`, `non_https_url`, `url_atypical_port`, `deep_subdomain`, `brand_in_subdomain`, `url_host_digit_ratio`, `url_userinfo`, `url_query_count`, `url_executable_extension`, `url_hyphen_count`, `known_bad_url` | liens |
| 16-36 | `urgency`, `credentials`, `sensitive`, `payment`, `threat`, `imperative_cta`, `crypto`, `otp_code`, `account_word`, `bank_word`, `delivery_word`, `prize_word`, `refund_word`, `money_amount`, `phone_number`, `authority_claim`, `urgency_count`, `question_count`, `first_person_pressure`, `personal_salutation`, `message_length` | texte |
| 37-40 | `exclamation_ratio`, `all_caps_ratio`, `digit_ratio`, `obfuscation` | typographie |
| 41-44 | `hour_off_hours`, `is_weekend`, `is_social_app`, `notification_kind` | contexte |
| 45-49 | `agg_urgency_index`, `agg_link_risk`, `agg_credential_pressure`, `agg_social_engineering`, `agg_total_risk` | agrégats |

La normalisation textuelle est NFKD, suppression des diacritiques, puis
minuscules et espaces tassés. `all_caps_ratio` utilise une copie sans
diacritiques qui conserve la casse. Les séparateurs internes `- * ' _ .` sont
tolérés dans les mots-clés, mais pas l'espace entre les caractères d'un mot.

## Réseau et confidentialité

VirusTotal ne reçoit que les URLs lorsqu'un enrichissement est explicitement
autorisé. Un échec réseau laisse `known_bad_url` à `128` et l'analyse locale
continue. Le texte complet n'est jamais envoyé pour cette extraction.

Le hash SHA-256 tronqué à 128 bits (`vector_hash`) identifie un vecteur ; ce
n'est pas un hash de similarité. Un éventuel SimHash/MinHash destiné à
l'agrégation de motifs est un mécanisme distinct. TLS protège le transport
d'une consultation distante et ne doit pas être décrit comme un chiffrement de
bout en bout. Le vecteur transmis pour cette consultation est traité en
mémoire et n'est jamais persisté ni écrit dans les logs.

## Validation obligatoire

```bash
cd safedm-backend
.venv/bin/pytest -q tests/test_feature_extraction.py
```

Tout portage doit rejouer la fixture complète, notamment les emojis (points de
code, pas unités UTF-16), les mots fractionnés, les homoglyphes, les URLs avec
ports/punycode et les valeurs `128` sans vérification réseau.
