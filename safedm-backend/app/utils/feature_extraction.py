"""Extracteur de features V3 — implementation de reference du contrat V3.

Ce module est la source de verite. `docs/FEATURE_SCHEMA.md` decrit le contrat ;
ce code l'implemente. Les portages Kotlin et JavaScript doivent reproduire
exactement ces valeurs, verifiables via `tests/fixtures/feature_vectors.json`.

Quatre regles non negociables pour garantir l'egalite bit a bit entre
plateformes :

1. **Aucune feature n'est un flottant.** Toutes les features sont des entiers
   `uint8` dans [0, 255]. Une feature valant 160/255 n'existe pas ; on calcule
   `(160 * 255) // num` et on stocke l'entier. Python manipule des entiers
   arbitrairement grands, Kotlin des `Long`, JavaScript des `Number` : en
   arithmetique entiere les trois donnent le meme resultat, alors qu'en
   flottant `0.1 + 0.2` diverge deja.

2. **Tout ce qui depend du texte passe par NFKD + suppression des diacritiques.**
   Ainsi "cliquez", "cliquez" et "CLIQUEZ" produisent la meme feature. Le
   folder NFD/NFKD est disponible en Python (`unicodedata`), Java
   (`Normalizer`) et JavaScript (`String.normalize`), donc l'etape est
   reproductible partout.

3. **SHA-256 uniquement.** Le SDK TypeSafe (donc Python) et le backend utilisent
   `hashlib` ; Kotlin a `MessageDigest` ; JavaScript n'a pas de SHA-256 natif,
   il faudra une implementation ou une lib. Pas de hash maison : il serait
   difficile a verifier et probablement divergent entre langages.

4. **L'empreinte du vecteur encode fidelement les 160 bits.** SHA-256 tronque a
   128 bits, pas SimHash — voir la justification detaillee dans `vector_hash`.

5. **Aucune distance ne classe menace et benin.** `profile_distance` compare des
   profils de features, rien de plus. Avec 50 features, une seule
   feature vaut 5% de la distance : la resolution est trop grossiere pour
   separer les populations, et un seuil serait une illusion de separation.
   La decision appartient au modele local.

La normalization de contenu deja existante (`normalize_content`) sert a la
detection de quasi-doublons par SHA-256 ; elle ne doit PAS servir ici, car elle
remplace les URLs par un placeholder et perdrait les features de lien.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional

# Taille du vecteur. Contractuel : ajouter une feature est un changement de
# version de schema, pas une modification retrocompatible.
FEATURE_COUNT = 50

# L'ordre EST le contrat. Le modele local, son patch signe et les vecteurs
# dores indexent tous par position, donc cette liste doit rester alignee avec
# `docs/FEATURE_SCHEMA.md` et avec `FeatureExtraction.kt`. Elle est lisible par
# machine parce que le patch signe embarque `feature_names` : un patch produit
# pour un autre ordre se voit au premier echec d'inference.
FEATURE_NAMES: tuple[str, ...] = (
    "has_url",    "url_count",    "shortened_url",    "ip_url",    "punycode",    "suspicious_tld",    "non_https_url",    "url_atypical_port",    "deep_subdomain",    "brand_in_subdomain",    "url_host_digit_ratio",    "url_userinfo",    "url_query_count",    "url_executable_extension",    "url_hyphen_count",    "known_bad_url",  # 15 : reseau
    "urgency",    "credentials",    "sensitive",    "payment",    "threat",    "imperative_cta",    "crypto",    "otp_code",    "account_word",    "bank_word",    "delivery_word",    "prize_word",    "refund_word",    "money_amount",    "phone_number",    "authority_claim",    "urgency_count",    "question_count",    "first_person_pressure",    "personal_salutation",    "message_length",    "exclamation_ratio",    "all_caps_ratio",    "digit_ratio",    "obfuscation",    "hour_off_hours",    "is_weekend",    "is_social_app",    "notification_kind",    "agg_urgency_index",    "agg_link_risk",    "agg_credential_pressure",    "agg_social_engineering",    "agg_total_risk",)
assert len(FEATURE_NAMES) == FEATURE_COUNT, "ordre des features incoherent avec FEATURE_COUNT"

# Index des features qui exigent le reseau. Les 49 autres sont calculables
# hors ligne, ce qui permet au mobile de decider sans aucune connexion.
FEATURE_KNOWN_BAD_URL = 15

# Bornes des blocs, pour retrouver une categorie a partir d'un indice. Le plan
# exige des espaces « textuel / lien / contextuel / agrege » distincts ; ces
# bornes rendent cette repartition lisible dans le code et dans les tests, au
# lieu d'exiger de compter a la main.
LINK_RANGE = range(0, 16)
TEXT_RANGE = range(16, 37)
TYPO_RANGE = range(37, 41)
CONTEXT_RANGE = range(41, 45)
AGGREGATE_RANGE = range(45, 50)

# Valeur neutre de `known_bad_url` : le verdict reseau n'a pas ete obtenu.
# Distincte de 0 (« sur ») et de 255 (« malveillant ») pour ne pas basculer le
# modele dans un sens ou dans l'autre par defaut d'information.
UNKNOWN_KNOWN_BAD_URL = 128

_MAX_UINT8 = 255

# Longueur de reference pour la normalisation lineaire de `message_length` et
# `all_caps_ratio`. Au-dela, la feature sature : un SMS de 2000 caracteres ne
# doit pas peser 4x plus qu'un SMS de 500 dans l'espace lineaire du modele.
_LENGTH_SATURATION = 512

_URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"']+", re.IGNORECASE)
_IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_HOST_RE = re.compile(r"^(?:https?://)?(?:[^@/]+@)?([^/?#:]+)", re.IGNORECASE)
_SPACE_RE = re.compile(r"\s+")

# Mots qui signalent une urgence artificielle. Volontairement courts et
# stricts : un mot trop large ("vite", "bientot") gonflerait le score sur des
# messages anecdotiques.
_URGENCY_KEYWORDS = (
    "urgent", "urgence", "immediat", "immediate", "tout de suite",
    "sous 24h", "24 heures", "dernier avertissement", "ultime",
    "expire", "expiration", "avant minuit", "limited", "bientot",
)

# Vocabulaire de vol d'identifiants. A distinguer de la simple mention d'un
# code : la feature compte la presence, pas l'intention — l'intention est le
# travail de Jev, pas du modele local.
_CREDENTIAL_KEYWORDS = (
    "mot de passe", "password", "identifiant", "login", "connexion",
    "otp", "code de verification", "code de confirmation", "code pin",
    "pin", "jeton", "token", "authentification",
)

_SENSITIVE_KEYWORDS = (
    "rib", "iban", "carte bancaire", "numero de carte",
    "cvv", "cvc", "securite sociale", "numero de carte bancaire",
    "piece d'identite", "nationalite", "date de naissance",
    "solde", "numero de compte",
)

_PAYMENT_KEYWORDS = (
    "transfert", "transferer", "envoyer", "envoyez", "paiement", "payer",
    "reglez", "regler", "frais", "depot", "deposez", "recharge",
    "credit", "avance", "commission", "taxe", "frais de livraison",
)

_THREAT_KEYWORDS = (
    "bloque", "bloquee", "bloquer", "bloquez", "suspendu", "suspendue",
    "suspendre", "ferme", "fermee", "desactive", "desactivee", "annule",
    "annulee", "resilie", "confisque", "penalite", "amende",
    "mise en demeure", "poursuite", "cloture",
    # Formes a prefixe de negation, courantes en francais : « le compte sera
    # debloque » est le message type du phishing bancaire. Sans ces formes, la
    # frontiere de mot empeche « bloque » de matcher dans « debloque » et la
    # menace passe au travers.
    "debloque", "debloquee", "debloquer", "debloquez", "reactive",
    "reactivez", "reactivation", "desactivez", "annulez", "renouvelez",
)

_IMPERATIVE_CTAS = (
    "cliquez", "clique", "validez", "valider", "confirmez", "confirmer",
    "composez", "repondez", "repondre", "appelez", "telechargez",
    "installez", "ouvrez", "acceptez", "autorisez", "renouvelez", "connectez",
)

# Caracteres zero-width et de direction, utilises pour fractionner un mot
# ("valide\u200bz") afin de contourner un filtre naif cote expediteur.
# Un `frozenset` de caracteres et non un dict indexe par codepoint : on
# interroge avec `ch in _ZERO_WIDTH`, donc les cles doivent etre des caracteres.
_ZERO_WIDTH = frozenset("\u200b\u200c\u200d\u2060\ufeff")

_SHORTENER_HOSTS = (
    "bit.ly", "tinyurl.com", "t.co", "ow.ly", "is.gd", "buff.ly",
    "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc",
)

# TLD frequemment abuses : registre gratuit, pas de verification d'identite,
# et forte concentration de campagnes. Liste courte et explicite plutot qu'un
# score de reputation, qui evoluerait hors du controle du modele.
_SUSPICIOUS_TLDS = (
    ".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".xyz", ".click",
    ".link", ".work", ".rest", ".loan", ".buzz", ".monster",
)

# --- Mots-cles supplementaires (schema V3) --------------------------------
# Regroupes par intention plutot qu'en un seul bloc : le plan exige un espace
# de 50 dimensions reparti en textuel / lien / contextuel / agrege.

_OTP_KEYWORDS = (
    "code de verification",
    "code de securite",
    "code otp",
    "otp",
    "jeton de securite",
    "code a 4 chiffres",
    "code a 6 chiffres",
    "authentification a deux facteurs",
)

_ACCOUNT_KEYWORDS = (
    "votre compte",
    "mon compte",
    "compte client",
    "compte utilisateur",
    "espace client",
    "area client",
    "votre profil",
)

_BANK_KEYWORDS = (
    "banque",
    "bancaire",
    "rib",
    "virement",
    "compte bancaire",
    "releve bancaire",
    "coiffe",
    "credit",
)

_DELIVERY_KEYWORDS = (
    "colis",
    "livraison",
    "expedition",
    "suivi de commande",
    "numero de suivi",
    "coursier",
    "douane",
)

_PRIZE_KEYWORDS = (
    "gagne",
    "winner",
    "loterie",
    "concours",
    "prize",
    "cadeau",
    "gratuit",
    "million",
)

_REFUND_KEYWORDS = (
    "remboursement",
    "rembourse",
    "avoir",
    "trop paye",
    "rembours",
    "reimbursement",
)

_AUTHORITY_KEYWORDS = (
    "officiel",
    "officielle",
    "service client",
    "assistance",
    "support officiel",
    "equipe",
    "securite",
    "confidentiel",
)

_PRESSURE_KEYWORDS = (
    "vous devez",
    "il faut",
    "vous etes oblige",
    "il est obligatoire",
    "sous peine",
    "avant 24h",
    "sous 24 heures",
    "derniere chance",
    "dernier avertissement",
    "ne pas ignorer",
)

# Extensions de fichier livrees par une URL : signal d'attaque classique, car
# une campagne de phishing mobile sert rarement autre chose qu'un APK.
_EXECUTABLE_EXTENSIONS = (
    ".apk",
    ".exe",
    ".msi",
    ".apkdownload",
    ".jar",
    ".bat",
    ".dmg",
)

# Marques bancaires et telecoms francophones. Sert au typosquatting : un
# sous-domaine qui contient la marque alors que le TLD est suspect est une
# imitation quasi certaine.
_KNOWN_BRANDS = (
    "paypal",
    "visa",
    "mastercard",
    "banque",
    "bnpc",
    "sgb",
    "orange",
    "mtn",
    "moov",
    "whatsapp",
    "facebook",
    "instagram",
    "google",
    "apple",
    "microsoft",
    "amazon",
    "free",
    "sfr",
    "bouygues",
)

_CRYPTO_WORDS = (
    "usdt",
    "bitcoin",
    "wallet",
    "crypto",
    "btc",
)

_PERSONAL_SALUTATIONS = (
    "cher client", "chere cliente", "cher monsieur", "chere madame",
    "madame", "monsieur", "cher abonne", "chere abonnee", "cher utilisateur",
)


def _strip_accents(text: str) -> str:
    """NFKD puis suppression des diacritiques.

    "e" avec accent -> "e". On conserve les caracteres non latins : un SMS en
   Tamazight ou en chinois doit rester analysable, on ne projette pas tout en
    ASCII.
    """
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _normalize(text: str) -> str:
    """Texte de travail : minuscules, sans diacritiques, espaces tassés."""
    return _SPACE_RE.sub(" ", _strip_accents(text).lower()).strip()


def _scale(count: int, cap: int) -> int:
    """Proportion -> uint8, en arithmetique entiere.

    `count` elements sur `cap` possibles devient `(count * 255) // cap`.
    L'entier 255 est la borne, pas une moyenne empirique : c'est une decision
    de design, pas une constante measuree.
    """
    if cap <= 0:
        return 0
    clamped = max(0, min(count, cap))
    return (clamped * _MAX_UINT8) // cap


def _keyword_count(text: str, keywords: tuple[str, ...], cap: int) -> int:
    """Nombre de mots-clés distincts présents, plafonné à `cap`.

    On compte des occurrences de mots-clés, pas d'occurrences de sous-chaîne :
    "pin" ne doit pas se déclencher dans "spinning", et "code" ne doit pas se
    déclencher dans "code postal". La frontière de mot est donc obligatoire.
    """
    hits = sum(1 for kw in keywords if _contains_word(text, kw))
    return min(hits, cap)


def _contains_word(text: str, needle: str) -> bool:
    """Recherche par frontiere de mot, insensible aux separateurs.

    Les escrocs cassent les filtres en inserant des separateurs *a l'interieur*
    des mots : "cliq-uez", "s*v*i*r", "mot-de-passe". On autorise donc un
    separateur optionnel entre chaque caractere du mot-cle.

    Deux nuances qui_evitent des faux positifs :
      - Les separateurs internes n'incluent PAS l'espace. Sinon "p in" serait
        lu comme "pin", et "il vous attend" comme "attendez".
      - A l'inverse, l'espace d'un mot-cle multi-mots ("code de verification")
        accepte toute suite de separateurs, y compris les espaces multiples.

    La classe de separateurs est ecrite explicitement plutot qu'avec une
    propriete Unicode (`[^\\W\\d_]` et son inverse se comportent differemment
    selon les moteurs) : c'est une des lignes les plus recopiees telles quelles
    en Kotlin et en JavaScript, elle doit etre lisible sans reflexe.
    """
    internal_separator = r"[-'*_.]*"  # ponctuation, jamais un espace
    chars = [re.escape(ch) for ch in needle]
    spaced = internal_separator.join(chars)
    # Un espace dans le mot-cle devient "un ou plusieurs separateurs".
    spaced = spaced.replace(r"\ ", r"[\s\-*'_]+")
    pattern = rf"(?<![a-z0-9]){spaced}(?![a-z0-9])"
    return re.search(pattern, text) is not None


def _extract_urls(text: str) -> list[str]:
    return _URL_RE.findall(text)


def _host_of(url: str) -> str:
    match = _HOST_RE.match(url)
    return match.group(1).lower() if match else ""


def _subdomain_depth(host: str) -> int:
    """Nombre de labels avant le TLD. « a.b.exemple.tk » -> 3.

    Les campagnes de phishing creent souvent 2 a 4 niveaux (« login.securite.
    banque.orange.tk ») pour_noyer la vraie marque dans du bruit. Un profondeur
    nulle, c'est un domaine direct.
    """
    host = host.rstrip(".")
    return max(0, host.count("."))


def _host_digit_ratio(hosts: list[str]) -> int:
    """Part de chiffres dans l'hote. Un nom de domaine legitime en est pauvre ;
    une adresse d'IP ou un domaine genere au hasard en est riche."""
    joined = "".join(hosts)
    digits = sum(1 for ch in joined if ch.isdigit())
    return 255 * digits // max(1, len(joined))


def _atypical_port(url: str) -> bool:
    """Port explicite dans l'URL. `:80` et `:443` sont normaux ; tout autre port
    dans un SMS pointe vers un service inhabituel."""
    match = re.search(r":(\d{2,5})(?=$|[/?#\s])", url)
    if not match:
        return False
    return match.group(1) not in ("80", "443")


def _has_obfuscation(text: str) -> bool:
    """Detecte les caracteres invisibles et les substitutions de glyphes.

    Un attaquant insere des caracteres zero-width pour contourner un filtre
    naive cote expediteur. Notre extracteur etant en aval, on ne se laisse pas
    pieger : on signale l'anomalie comme feature plutot que de la normaliser
    en silence.

    Les glyphes cyrilliques qui imitent des latins ("сib", "раypal") sont
    relevantes quand ils sont melanges a de vrais latins dans le mot
    correspondant ; un mot entierement cyrillique est de la langue legitime,
    pas une usurpation.
    """
    if any(ch in _ZERO_WIDTH for ch in text):
        return True

    cyrillic_homoglyphs = set("аеорсухіј")
    latin_lookalikes = set("aeopxyi j".replace(" ", ""))
    return bool(cyrillic_homoglyphs & set(text)) and bool(latin_lookalikes & set(text.lower()))


def extract_features(
    text: str,
    *,
    urls: Optional[list[str]] = None,
    known_bad_url: Optional[bool] = None,
    post_time_ms: Optional[int] = None,
    package_name: Optional[str] = None,
) -> list[int]:
    """Calcule les `FEATURE_COUNT` features en uint8, dans l'ordre du schema.

    `urls` et `known_bad_url` sont injectables pour que l'appelant puisse
    transmettre les URLs deja extraites par le pipeline et le verdict reseau.
    Quand `known_bad_url` vaut None, la feature vaut 128 (inconnu) : neutre, elle
    ne pousse ni vers benin ni vers malveillant quand on n'a pas pu verifier.

    `post_time_ms` et `package_name` alimentent le bloc CONTEXT. Ils sont
    facultatifs : sans eux, les features contextuelles valent 128 (« inconnu »)
    plutot que 0, pour ne pas faire croire a un signal qu'on n'a pas observe.

    Conséquence sur le hachage : `vector_hash` couvre desormais le triplet
    (texte, instant, application). Deux SMS identiques recus a des moments
    differents n'ont donc plus le meme hachage. C'est delibere : une salve de
    phishing a 3h du matin venue de WhatsApp est un motif distinct de la meme
    phrase envoyee a midi par SMS, et l'agregation communautaire gagne a les
    separer plutot qu'a les confondre.
    """
    if not isinstance(text, str):
        raise TypeError("text doit etre une str")

    norm = _normalize(text)
    # Version sans accents mais avec la casse d'origine, reservee a `all_caps`.
    # Mesurer les majuscules sur `norm` donnerait toujours 0, puisque `norm`
    # est en minuscules : la feature serait morte et le modele lui attribuerait
    # un poids nul sans qu'on s'en apercoive.
    folded = _SPACE_RE.sub(" ", _strip_accents(text)).strip()

    if urls is None:
        urls = _extract_urls(norm)

    f: list[int] = []

    # ---------------- LIENS (0-15) ----------------
    hosts = [_host_of(u) for u in urls]
    f.append(_MAX_UINT8 if urls else 0)
    f.append(_scale(len(urls), 8))
    f.append(_MAX_UINT8 if any(h.endswith(_SHORTENER_HOSTS) for h in hosts) else 0)
    f.append(_MAX_UINT8 if any(_IPV4_RE.search(u) for u in urls) else 0)
    f.append(_MAX_UINT8 if any(h.startswith("xn--") for h in hosts) else 0)
    f.append(_MAX_UINT8 if any(h.endswith(_SUSPICIOUS_TLDS) for h in hosts) else 0)
    # `http://` est le defaut historique des campagnes ; `https` dans un SMS
    # reste rare, donc sa presence est faiblement suspecte et son absence est
    # neutre.
    f.append(
        _scale(sum(1 for u in urls if u.lower().startswith("http://")), 4)
    )
    f.append(_scale(sum(1 for u in urls if _atypical_port(u)), 2))
    f.append(_scale(max((_subdomain_depth(h) for h in hosts), default=0), 5))
    # Marque presente dans le sous-domaine alors que le TLD final est suspect :
    # signature de typosquatting (« paypal.secure-verif.tk »).
    f.append(
        _MAX_UINT8
        if any(
            _subdomain_depth(h) >= 2 and any(b in h for b in _KNOWN_BRANDS)
            for h in hosts
        )
        else 0
    )
    f.append(_scale(_host_digit_ratio(hosts), 255))
    f.append(_MAX_UINT8 if any(_URL_USERINFO_RE.search(u) for u in urls) else 0)
    f.append(_scale(sum(u.count("?") for u in urls if "?" in u), 3))
    f.append(
        _MAX_UINT8
        if any(u.lower().rstrip(".,);\"'").endswith(_EXECUTABLE_EXTENSIONS) for u in urls)
        else 0
    )
    f.append(_scale(max((h.count("-") for h in hosts), default=0), 6))

    # Reseau. Reserve a la derniere du bloc pour que les 15 premieres soient
    # toutes decidables hors ligne.
    if known_bad_url is None:
        f.append(UNKNOWN_KNOWN_BAD_URL)
    else:
        f.append(_MAX_UINT8 if known_bad_url else 0)

    # ---------------- TEXTUELLES (16-36) ----------------
    f.append(_scale(_keyword_count(norm, _URGENCY_KEYWORDS, 8), 8))
    f.append(_scale(_keyword_count(norm, _CREDENTIAL_KEYWORDS, 8), 8))
    f.append(_scale(_keyword_count(norm, _SENSITIVE_KEYWORDS, 8), 8))
    f.append(_scale(_keyword_count(norm, _PAYMENT_KEYWORDS, 8), 8))
    f.append(_scale(_keyword_count(norm, _THREAT_KEYWORDS, 8), 8))
    f.append(_MAX_UINT8 if _keyword_count(norm, _IMPERATIVE_CTAS, 4) > 0 else 0)
    f.append(_MAX_UINT8 if any(_contains_word(norm, w) for w in _CRYPTO_WORDS) else 0)
    f.append(_scale(_keyword_count(norm, _OTP_KEYWORDS, 4), 4))
    f.append(_MAX_UINT8 if _keyword_count(norm, _ACCOUNT_KEYWORDS, 4) > 0 else 0)
    f.append(_MAX_UINT8 if _keyword_count(norm, _BANK_KEYWORDS, 4) > 0 else 0)
    f.append(_MAX_UINT8 if _keyword_count(norm, _DELIVERY_KEYWORDS, 4) > 0 else 0)
    f.append(_MAX_UINT8 if _keyword_count(norm, _PRIZE_KEYWORDS, 4) > 0 else 0)
    f.append(_MAX_UINT8 if _keyword_count(norm, _REFUND_KEYWORDS, 4) > 0 else 0)
    f.append(_MAX_UINT8 if _MONEY_AMOUNT_RE.search(norm) else 0)
    f.append(_MAX_UINT8 if _PHONE_RE.search(norm) else 0)
    f.append(_MAX_UINT8 if _keyword_count(norm, _AUTHORITY_KEYWORDS, 4) > 0 else 0)
    # Comptage et non booleen : la repetition d'un signal est elle-meme un
    # indice d'echelle, absente d'un simple present/absent.
    f.append(_scale(_keyword_count(norm, _URGENCY_KEYWORDS, 12), 12))
    f.append(_scale(norm.count("?"), 6))
    f.append(_MAX_UINT8 if _keyword_count(norm, _PRESSURE_KEYWORDS, 4) > 0 else 0)
    f.append(
        _MAX_UINT8
        if any(_contains_word(norm, s) for s in _PERSONAL_SALUTATIONS)
        else 0
    )
    f.append(_scale(len(norm), _LENGTH_SATURATION))

    # ---------------- TYPOGRAPHIQUES (37-40) ----------------
    f.append(_scale(norm.count("!"), 5))

    letters = sum(1 for ch in folded if ch.isalpha())
    upper_letters = sum(1 for ch in folded if ch.isalpha() and ch.isupper())
    f.append(_scale(upper_letters, max(1, letters)))

    f.append(
        _scale(
            sum(1 for ch in norm if ch.isdigit()),
            max(1, len(norm)),
        )
    )
    f.append(_MAX_UINT8 if _has_obfuscation(text) else 0)

    # ---------------- CONTEXTUELLES (41-44) ----------------
    f.extend(_context_features(post_time_ms, package_name))

    # ---------------- AGREGÉES (45-49) ----------------
    f.extend(_aggregate_features(f))

    _validate_vector(f)
    return f


def _context_features(
    post_time_ms: Optional[int], package_name: Optional[str]
) -> list[int]:
    """Bloc CONTEXT. 128 = « pas observe », 0 = « observe et neutre ».

    On distingue explicitement l'absence de donnee de la donnee negative. Sinon,
    un message analyse sans horodatage aurait l'air « en plein jour » et le
    modele lui accorderait une confiance qu'on n'a pas.
    """
    unknown = UNKNOWN_KNOWN_BAD_URL

    if post_time_ms is None:
        off_hours = unknown
        weekend = unknown
    else:
        moment = datetime.fromtimestamp(post_time_ms / 1000, tz=timezone.utc)
        off_hours = _MAX_UINT8 if not (8 <= moment.hour < 20) else 0
        weekend = _MAX_UINT8 if moment.weekday() >= 5 else 0

    if not package_name:
        # Sans nom d'application, on ne peut pas distinguer une cible de
        #banque ou un SMS anodin : on encode « inconnu » au lieu de 0.
        return [off_hours, weekend, unknown, unknown]

    lowered = package_name.lower()
    social = any(marker in lowered for marker in _SOCIAL_APP_MARKERS)
    return [off_hours, weekend, _MAX_UINT8 if social else 0, _notification_kind(package_name)]


def _notification_kind(package_name: str) -> int:
    """Encode le type d'application en 0/85/170/255.

    Une simple valeur binaire « est-ce une app sociale » perdrait l'information
    qui compte : un SMS de banque et un WhatsApp n'appartiennent pas au meme
    circuit de confiance. Quatre paliers tenant dans un uint8 suffisent.
    """
    lowered = package_name.lower()
    if any(m in lowered for m in ("com.android.mms", "messaging", "sms")):
        return 0
    if "whatsapp" in lowered:
        return 85
    if any(m in lowered for m in ("gmail", "mail", "outlook", "mailorange")):
        return 170
    return 255


def _aggregate_features(f: list[int]) -> list[int]:
    """Cinq features AGREGEES, comme le plan les exige.

    Ce n'est pas de la redondance : avec 28 echantillons d'entrainement, une
    regression logistique ne peut pas apprendre seule les interactions
    (« URL + credentials » est bien plus suspecteux que chacun pris
    isolement). Donner explicitement ces combinaisons au modele est la
    difference entre un modele qui generalise et un modele qui memorise.
    """
    urgency = _mean(f[16], f[18], f[17], f[37], f[38])
    link = _mean(f[2], f[3], f[5], f[8], f[9])
    credential = _mean(f[17], f[18], f[23], f[24], f[25])
    social = _mean(f[35], f[21], f[30], f[33])

    total = _mean(urgency, link, credential, social)
    return [urgency, link, credential, social, total]


def _mean(*values: int) -> int:
    """Moyenne entiere tronquee, pour rester reproductible partout.

    `round()` serait plus exact mais varie selon l'arrondi des flottants selon
    la plateforme. Une division entiere ne laisse pas ce genre de place a
    l'incertitude.
    """
    return sum(values) // len(values)


# Regex supplementaires du schema V3.
_URL_USERINFO_RE = re.compile(r"^[a-z][a-z0-9+.-]*://[^/@\s]+@", re.IGNORECASE)
_MONEY_AMOUNT_RE = re.compile(
    r"(?:\d[\s\u00a0.,]*){1,3}(?:\s*(?:euros?|eur|francs?|fcp|dollars?|usd|dh|dirhams?))",
    re.IGNORECASE,
)
# Au moins 6 chiffres consecutifs : un numero de telephone, pas un code court
# ni un montant. Exclut les codes OTP de 4 chiffres, traites comme tels.
_PHONE_RE = re.compile(r"(?:\+?\d[\s.-]*){7,}")

_SOCIAL_APP_MARKERS = (
    "whatsapp",
    "telegram",
    "messenger",
    "instagram",
    "facebook",
    "signal",
    "viber",
    "snapchat",
)

def _validate_vector(features: list[int]) -> None:
    if len(features) != FEATURE_COUNT:
        raise ValueError(
            f"vecteur de taille {len(features)}, attendu {FEATURE_COUNT}"
        )
    for value in features:
        if not isinstance(value, int) or not 0 <= value <= _MAX_UINT8:
            raise ValueError(f"feature hors bornes uint8 : {value!r}")


def vector_hash(features: list[int]) -> str:
    """SHA-256 tronque a 128 bits sur l'encodage fidele du vecteur.

    Pourquoi pas SimHash : SimHash est un resume a 64 bits construit pour
    detecter des quasi-doublons *textuels*, via les projections aleatoires du
    sous-ensemble de mots. Ici on a deja fait le travail difficile — les
    features encodentLIENS, vocabulaire, typographie et contexte — donc il ne
    reste qu'a hasher fidelement ces bits. Un SimHash nous ferait perdre de
    l'information deja extraite, et surtout ne serait pas reproductible : il
    dépend d'un tirage de projections qui doit etre partage a l'identique.

    Pourquoi 128 bits et non 256 : c'est une empreinte d'*identification* et de
    deduplication, pas une signature de confiance. Les collisions sur
    2^128 sont hors de portee de notre volume, et 128 bits font 16 octets, ce
    qui tient dans un UUID Android sans conversion. Couper a la moitie du
    digest n'affaiblit pas la resistance aux collisions de facon mesurable.

    L'encodage est `bytes(features)` : chaque feature tient dans un uint8, donc
    50 features = 400 bits exacts, sans ambiguite d'ordre ni de separateur. Le
    hachage depend donc de l'ordre des features, ce qui est voulu — permuter
    deux features change le vecteur de classe.

    Cette empreinte couvre le triplet (texte, instant, application), puisque les
    features contextuelles sont dans le vecteur : deux SMS identiques recus a des
    moments differents n'ont pas la meme empreinte. C'est delibere, voir la
    docstring de `extract_features`.
    """
    _validate_vector(features)
    return hashlib.sha256(bytes(features)).hexdigest()[:32]


def profile_distance(a: list[int], b: list[int]) -> float:
    """Distance de profil entre deux vecteurs, dans [0, 1].

    Hamming normalise sur l'**activation** des features (une feature est active
    si elle vaut > 0), pas sur l'intensite. `known_bad_url` a 128 = « pas
    verifie » : on l'exclut du calcul quand l'un des deux messages n'a pas ete
    verifie, plutot que de laisser « inconnu » peser comme une opinion.

    Pourquoi l'activation et non l'intensite : la premiere version utilisait
    une distance L1 normalisee par `50 * 255 = 12750`. Or aucun vecteur realist ne
    s'approche de 5100 — les features de vocabulaire sont mises a l'echelle sur
    8 mots-cles, donc un seul mot-cle donne 31. Toutes les distances tombeient
    sous 10% et la metrique ne distinguait plus rien. L'activation est le signal
    utile : le modele local apprend des poids par feature, il cares de
    « urgence declenchee » bien plus que du nombre exact de mots d'urgence.

    **Ce que cette distance ne fait pas : classer menace contre benin.** Mesure
    sur les vecteurs dores, la distance la plus proche entre un message
    malveillant et un message benin vaut 10.5%, exactement la meme que le
    maximum entre deux messages benins (10.5%) : les deux populations se
    recouvrent. La metrique ne remplace pas le modele local : une seule feature
    peut deja modifier fortement la distance. Un seuil ne peut pas separer ce que la resolution ne
    permet pas de separer, et il n'y a donc volontairement aucun seuil ici.

    Le role de cette fonction est restreint et assumé : dire si deux messages
    partagent le meme *profil* de features. La decision malveillant/benin
    appartient au modele local (regression logistique), pas a une distance. La
    detection de quasi-doublons textuels, elle, revient a
    `compute_normalized_hash` (SHA-256 du texte normalise).
    """
    _validate_vector(a)
    _validate_vector(b)

    compared = 0
    differing = 0
    for index, (left, right) in enumerate(zip(a, b)):
        if index == FEATURE_KNOWN_BAD_URL and (
            left == UNKNOWN_KNOWN_BAD_URL or right == UNKNOWN_KNOWN_BAD_URL
        ):
            continue  # « pas verifie » n'est pas une opinion
        compared += 1
        if (left > 0) != (right > 0):
            differing += 1

    return differing / compared if compared else 0.0
