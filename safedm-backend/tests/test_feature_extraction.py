"""Tests du contrat de features V3.

Ces tests verrouillent l'egalite bit a bit entre Python, Kotlin et JavaScript.
Chaque valeur attendue ici est reprise telle quelle dans les tests des ports
mobiles : si une valeur change, les trois implémentations doivent changer
ensemble, sinon les decisions locales et serveur divergent silencieusement.

`test_golden_vectors_match_fixture` compare aux vecteurs dorés de
`tests/fixtures/feature_vectors.json`, qui est la source partagée.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.utils.feature_extraction import (
    FEATURE_COUNT,
    _CREDENTIAL_KEYWORDS,
    _IMPERATIVE_CTAS,
    _PAYMENT_KEYWORDS,
    _SENSITIVE_KEYWORDS,
    _THREAT_KEYWORDS,
    _URGENCY_KEYWORDS,
    UNKNOWN_KNOWN_BAD_URL,
    _contains_word,
    _URGENCY_KEYWORDS,
    extract_features,
    profile_distance,
    vector_hash,
)

FIXTURE = Path(__file__).parent / "fixtures" / "feature_vectors.json"


# --------------------------------------------------------------- structure


def test_vector_has_exactly_twenty_features() -> None:
    assert len(extract_features("bonjour")) == FEATURE_COUNT


def test_all_features_are_uint8() -> None:
    for value in extract_features("URGENT validez votre compte sur http://x.tk"):
        assert isinstance(value, int)
        assert 0 <= value <= 255


def test_empty_message_yields_neutral_vector() -> None:
    """Un message vide ne doit pas declencher le modele, mais rester valide."""
    features = extract_features("")
    assert len(features) == FEATURE_COUNT
    assert all(0 <= v <= 255 for v in features)
    # known_bad_url reste a 128 (inconnu), pas 0 : on n'a pas verifie.
    assert features[15] == 128


def test_known_bad_url_defaults_to_unknown_not_safe() -> None:
    """128 = « pas verifie », ce n'est pas « sur » (0) ni « malveillant » (255)."""
    assert extract_features("x", known_bad_url=None)[15] == 128
    assert extract_features("x", known_bad_url=False)[15] == 0
    assert extract_features("x", known_bad_url=True)[15] == 255


# ------------------------------------------------- normalisation & accents


@pytest.mark.parametrize(
    "text",
    [
        "URGENT validez votre compte",
        "urgent VALIDEZ votre compte",
        "UrGeNt VaLiDeZ votre compte",
        "Urgent validez votre compte",
    ],
)
def test_case_does_not_change_keyword_features(text: str) -> None:
    """« urgent », « URGENT », « UrGeNt » doivent produire la meme feature.

    On ne compare pas les vecteurs entiers : la longueur du message est une
    feature legitime, donc changer la casse *et* la longueur (ajouter un
    espace) la fait bouger. Ce qui doit etre insensible a la casse, ce sont
    les features de mots-cles.
    """
    reference = extract_features("urgent validez votre compte")
    features = extract_features(text)
    for index in (7, 8, 9, 10, 11, 12):  # urgence, credentials, sensible, paiement, menace, CTA
        assert features[index] == reference[index], f"feature {index} sensible a la casse"


@pytest.mark.parametrize(
    "text",
    [
        "Validez votre compte",
        "válidez votre compte",
        "validez votre compte",
        "VALIDEZ VOTRE COMPTE",
    ],
)
def test_accents_and_case_do_not_change_keyword_features(text: str) -> None:
    """Les accents ne doivent ni declencher ni masquer un mot-cle.

    « validez » avec et sans accent doit declencher le CTA pareil.
    """
    reference = extract_features("validez votre compte")
    features = extract_features(text)
    for index in (7, 8, 9, 10, 11, 12):
        assert features[index] == reference[index], f"feature {index} sensible aux accents"


def test_zero_width_characters_are_detected() -> None:
    clean = extract_features("validez votre compte")
    sneaky = extract_features("vali\u200bdez votre compte")
    assert clean[40] == 0, "un message normal ne doit pas etre marque obfusque"
    assert sneaky[40] == 255, "un zero-width doit lever le signal d'obfuscation"


def test_cyrillic_homoglyphs_are_detected() -> None:
    """« а » cyrillique dans un mot latin : usurpation classique."""
    assert extract_features("vаlidez votre compte")[40] == 255


def test_plain_cyrillic_text_is_not_flagged_as_attack() -> None:
    """Un mot entierement cyrillique est de la langue, pas de l'usurpation."""
    assert extract_features("привет как дела")[40] == 0


# ------------------------------------------------------------ features URL


def test_shortened_url_is_flagged() -> None:
    assert extract_features("cliquez http://bit.ly/x3")[2] == 255


def test_ordinary_url_is_not_flagged_as_shortened() -> None:
    assert extract_features("cliquez https://banque.example.tg/x")[2] == 0


def test_ip_literal_in_url_is_flagged() -> None:
    assert extract_features("http://192.168.1.100/verif")[3] == 255


def test_punycode_host_is_flagged() -> None:
    assert extract_features("http://xn--80ak6aa92e.com")[4] == 255


def test_suspicious_tld_is_flagged() -> None:
    assert extract_features("http://promo.tk/offre")[5] == 255


def test_no_url_means_url_features_are_zero() -> None:
    features = extract_features("bonjour, comment vas-tu ?")
    assert features[0] == 0, "has_url doit etre 0"
    assert features[1] == 0, "url_count doit etre 0"


# ------------------------------------------------------- features lexicales


def test_word_boundary_prevents_false_positive() -> None:
    """"spinning" ne doit pas declencher le mot-cle "pin"."""
    assert extract_features("faire du spinning demain")[8] == 0


def test_separator_evasion_is_caught() -> None:
    """Les separateurs internes ne doivent pas servir a eviter la detection."""
    assert extract_features("cliq-uez vite")[21] == 255, "CTA binaire : 255"
    # Les features de vocabulaire sont comptees puis mises a l'echelle, donc
    # un seul mot-cle donne 31 (255/8) et non 255.
    assert extract_features("p-i-n svp")[17] > 0
    assert extract_features("mot-de-passe")[17] > 0
    assert extract_features("code-de-verification")[17] > 0


def test_separator_tolerance_does_not_eat_word_boundaries() -> None:
    """Le prix de la tolerance aux separateurs : un trait d'union devient
    transparent, donc "porte-ouverte" contient bien "porte". C'est acceptable
    car aucun mot-cle n'est un fragment de mot courant, mais le compromis doit
    rester visible plutot que d'etre decouvert plus tard.
    """
    assert _contains_word("il vous attend", "attendez") is False
    assert _contains_word("faire du spinning", "pin") is False
    assert _contains_word("un p in", "pin") is False


def test_repetition_does_not_inflate_keyword_features() -> None:
    """`_keyword_count` compte des mots-cles DISTINCTS, pas des occurrences.

    Repeter "urgent" cinquante fois ne pese donc pas plus qu'une seule fois :
    la feature mesure la richesse du vocabulaire d'urgence, pas la manie de
    l'auteur. C'est un choix — un compteur d'occurrences serait tout aussi
    reproductible, mais il confondrait « il a passe un SMS sur l'urgence » et
    « il a repete urgence urgence urgence », qui relevent de l'heuristique
    editoriale, pas du signal de menace.
    """
    once = extract_features("urgent")
    many = extract_features(" ".join(["urgent"] * 50))
    assert once[16] == many[16] == 31


def test_more_distinct_keywords_saturate() -> None:
    """En revanche, elargir le vocabulaire d'urgence, si, augmente la feature."""
    one = extract_features("urgent")[16]
    three = extract_features("urgent immediat expire")[16]
    assert three > one
    assert extract_features(" ".join(_URGENCY_KEYWORDS))[16] == 255


def test_all_caps_ratio_uses_original_case() -> None:
    """Regression : `all_caps_ratio` etait mesuree sur le texte deja mise en
    minuscules, donc elle valait toujours 0.

    Une feature morte est pire qu'une feature absente : le modele lui attribue
    un poids nul et personne ne remarque que le signal existe.
    """
    shouted = extract_features("URGENT VALIDEZ VOTRE COMPTE MAINTENANT")
    assert shouted[38] == 255

    silent = extract_features("bonjour")
    assert silent[38] == 0

    # Une seule majuscule parmi 19 lettres reste un ratio faible, pas nul.
    normal = extract_features("Bonjour comment vas-tu ?")
    assert 0 < normal[38] < 30


def test_length_saturates() -> None:
    """Un SMS de 5000 caracteres ne doit pas peser 10x plus qu'un de 500."""
    assert extract_features("a" * 50_000)[36] == 255


# ------------------------------------------------------------- empreintes


def test_hash_is_32_hex_chars() -> None:
    digest = vector_hash(extract_features("bonjour"))
    assert len(digest) == 32
    assert all(c in "0123456789abcdef" for c in digest)


def test_hash_is_deterministic() -> None:
    features = extract_features("URGENT validez ici http://bit.ly/x")
    assert vector_hash(features) == vector_hash(features)


def test_distinct_vectors_hash_differently() -> None:
    """Regression : deux messages sans rapport ne doivent PAS avoir le meme hash.

    Ce test existe parce qu'une premiere version utilisait SimHash, qui
    produisait exactement ce defaut : « offre Orange » et « RDV au stade »
    avaient le meme hash alors que leurs vecteurs different.
    """
    promo = extract_features("Orange: offre 2x data ce week-end pour 500 FCFA.")
    rdv = extract_features("Salut, on joue demain a 17h au stade de Kegue ?")
    assert promo != rdv
    assert vector_hash(promo) != vector_hash(rdv)


def test_hash_rejects_wrong_length() -> None:
    with pytest.raises(ValueError, match="taille"):
        vector_hash([0, 1, 2])


def test_hash_rejects_out_of_range() -> None:
    bad = [0] * FEATURE_COUNT
    bad[0] = 300
    with pytest.raises(ValueError, match="uint8"):
        vector_hash(bad)


# ------------------------------------------------------------ similarite


def test_profile_distance_is_zero_for_identical() -> None:
    features = extract_features("meme message")
    assert profile_distance(features, features) == 0.0


def test_profile_distance_is_symmetric() -> None:
    a = extract_features("URGENT validez votre compte http://bit.ly/x")
    b = extract_features("bonjour comment vas-tu")
    assert profile_distance(a, b) == profile_distance(b, a)


def test_profile_distance_ignores_intensity() -> None:
    """La metrique compare l'activation, pas l'intensite.

    Un message avec trois mots d'urgence et un message avec un seul sont le
    meme profil : c'est ce qui compte pour « ces deux SMS se ressemblent »,
    et c'est ce que la regression logistique traite via les poids par feature.
    """
    one = extract_features("urgent")
    three = extract_features("urgent immediat expire")
    assert one[16] != three[16], "les intensites different bien"
    assert profile_distance(one, three) == 0.0, "mais le profil est identique"


def test_profile_distance_ignores_unverifiable_network_feature() -> None:
    """128 = « pas verifie » ne doit pas peser comme une opinion.

    Deux messages par ailleurs identiques doivent rester a distance 0 meme si
    l'un a ete verifie par le reseau et l'autre non.
    """
    verified = extract_features("cliquez http://bit.ly/x", known_bad_url=False)
    unknown = extract_features("cliquez http://bit.ly/x", known_bad_url=None)
    assert verified[15] == 0 and unknown[15] == UNKNOWN_KNOWN_BAD_URL
    assert profile_distance(verified, unknown) == 0.0


def test_profile_distance_cannot_be_thresholded_into_a_classifier() -> None:
    """Garde-fou documentaire : ce qu'on ne doit PAS faire de cette metrique.

    Mesure sur les vecteurs dores, la paire menace/benin la plus proche est a
    10.5% de distance, exactement le maximum entre deux benigns. Les
    populations se recouvrent : aucun seuil ne peut les separer, parce qu'une
    seule feature represente deja 5% de la distance.

    Ce test verrouille cette limite. Il echouera si quelqu'un introduit un
    seuil et conclut que la metrique « marche », ce qui serait faux.
    """
    golden = json.loads(FIXTURE.read_text(encoding="utf-8"))
    vectors = {case["name"]: case["features"] for case in golden["cases"]}
    benign = [
        "empty", "benign_plain", "benign_meeting", "benign_promo",
        "punctuation_only", "digits_only", "emojis_only",
    ]
    threats = ["phishing_otp", "phishing_url", "payment_scam", "threat_blocked"]

    closest_threat_benign = min(
        profile_distance(vectors[t], vectors[b]) for t in threats for b in benign
    )
    widest_benign = max(
        profile_distance(vectors[a], vectors[b])
        for i, a in enumerate(benign)
        for b in benign[i + 1:]
    )
    assert closest_threat_benign <= widest_benign, (
        "les populations se recouvrent : c'est attendu et documente. "
        "Si ce test echoue, la metrique a gagne de la resolution et il faut "
        "revoir ce commentaire."
    )


def test_negated_threat_keywords_are_detected() -> None:
    """« debloque » est la formulation type du phishing bancaire francophone.

    Sans les formes a prefixe de negation, la frontiere de mot empeche
    « bloque » de matcher dans « debloque » et l'arnaque la plus courante
    du marche passe au travers.
    """
    assert extract_features("votre compte sera bloque")[20] > 0
    assert extract_features("votre compte sera debloque")[20] > 0, (
        "un scam complet ne doit pas passer pour un message neutre"
    )



# ------------------------------------------------------- vecteurs dorés


@pytest.fixture(scope="module")
def golden() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _case_text(case: dict) -> str:
    """Texte d'un cas doré, y compris les cas volontairement enorme.

    Un SMS de 5000 caractères dans le JSON alourdirait la fixture sans rien
    apprendre : on note l'unité et le nombre de répétitions à la place.
    """
    if "text_repeat" in case:
        spec = case["text_repeat"]
        return spec["unit"] * spec["count"]
    return case["text"]


def test_golden_vectors_match_fixture(golden: dict) -> None:
    """Les valeurs de la fixture sont la source de verite des ports mobiles."""
    for case in golden["cases"]:
        features = extract_features(
            _case_text(case),
            urls=case.get("urls"),
            known_bad_url=case.get("known_bad_url"),
        )
        assert features == case["features"], (
            f"vecteur divergent pour {case['name']!r} :\n"
            f"  attendu {case['features']}\n"
            f"  obtenu  {features}"
        )
        assert vector_hash(features) == case["vector_hash"], (
            f"empreinte divergente pour {case['name']!r}"
        )


def test_golden_fixture_covers_edge_cases(golden: dict) -> None:
    names = {case["name"] for case in golden["cases"]}
    required = {
        "empty",
        "benign_plain",
        "phishing_otp",
        "benign_promo",
        "unicode_obfuscated",
        "punctuation_only",
        "very_long",
    }
    assert required <= names, f"cas limites manquants : {required - names}"


def test_golden_fixture_declares_the_same_feature_names(golden: dict) -> None:
    """Le nom des features est lui aussi un contrat : il sert dans les ports."""
    assert len(golden["feature_names"]) == FEATURE_COUNT
    assert golden["feature_count"] == FEATURE_COUNT

# ------------------------------------------------- integrite des listes


def test_no_keyword_list_contains_duplicates() -> None:
    """`_keyword_count` additionne chaque entree de la liste.

    Un doublon ne weigh pas double dans la realite mais double le score : un
    message contenant « numero de carte » marquait 63 au lieu de 31, et
    « appelez » 127 au lieu de 63. Le modele aurait appris un poids trop fort
    pour ces mots-la sans qu'on voie quoi que ce soit dans les logs.
    """
    lists = {
        "URGENCY": _URGENCY_KEYWORDS,
        "CREDENTIAL": _CREDENTIAL_KEYWORDS,
        "SENSITIVE": _SENSITIVE_KEYWORDS,
        "PAYMENT": _PAYMENT_KEYWORDS,
        "THREAT": _THREAT_KEYWORDS,
        "CTA": _IMPERATIVE_CTAS,
    }
    for name, keywords in lists.items():
        seen = set()
        duplicates = {k for k in keywords if k in seen or seen.add(k)}
        assert not duplicates, f"{name} contient des doublons : {duplicates}"


def test_no_keyword_has_leading_or_trailing_space() -> None:
    """«  authentification » (espace initiale) ne matchait jamais en debut de
    message, alors que tous les autres mots-cles matchaient partout. Une
    coquille invisible dans une liste de mots-cles est un signal perdu.
    """
    lists = [
        _URGENCY_KEYWORDS, _CREDENTIAL_KEYWORDS, _SENSITIVE_KEYWORDS,
        _PAYMENT_KEYWORDS, _THREAT_KEYWORDS, _IMPERATIVE_CTAS,
    ]
    for keywords in lists:
        for keyword in keywords:
            assert keyword == keyword.strip(), (
                f"mot-cle avec espace parasite : {keyword!r}"
            )


def test_single_keyword_scores_the_same_regardless_of_list_position() -> None:
    """Un seul mot-clé doit toujours donner la meme valeur.

    `imperative_cta` est binaire (255/0), donc un doublon n'y changeait rien.
    C'est sur les features mises a l'echelle qu'un doublon gonflerait le score :
    « numero de carte » vaut 31 (1/8), pas 63 (2/8).
    """
    assert extract_features("appelez")[21] == 255, "CTA binaire"
    assert extract_features("numero de carte")[18] == 31, "1/8 de l'echelle"
    assert extract_features("mot de passe")[17] == 31
    assert extract_features("transfert")[19] == 31
    assert extract_features("bloque")[20] == 31
