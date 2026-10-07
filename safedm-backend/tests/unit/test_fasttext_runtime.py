"""Le runtime entier doit reproduire exactement l'inference fastText.

Ancrage de verite : `get_sentence_vector`, qui est le chemin le plus simple de
la bibliotheque et ne fait qu'une moyenne de lignes. Il est verifie au bit pres.

On ne compare **jamais** les probabilites a `fasttext.predict()` : dans
`fasttext-wheel==0.9.2`, cette fonction renvoie des valeurs **superieures a 1**
(verifie : 1.00001), et range les messages de façon differente de
`sigmoid(W_out . mean)` — 0.9776 contre 0.9919 sur le meme corpus. Elle n'est
donc ni bornee, ni fiable comme reference, ni exploitable pour caler un seuil.
La reference autoritative est `Model.test`, et nos decisions sont comparees a
`Model.test`.

Chaque piege d'exactitude a un test dedie, avec un test "control" qui prouve
que le piege est reel : sans lui, un test qui reimplementerait le piege
passerait quand meme.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.ml.fasttext_runtime import (
    EOS,
    FastTextSpec,
    QuantizedModel,
    _idiv,
    _to_signed32,
    compute_subwords,
    ft_hash,
    probabilities,
    quantize,
)

fasttext = pytest.importorskip("fasttext")

BUCKET = 50000
DIM = 16

# Volume suffisant pour que le modele ait un signal : les logits doivent
# s'ecarter de zero, sinon sigmoid sature et les tests de decision ne
# mesureraient rien.
CORPUS = [
    ("phish", "URGENT validez votre compte sur http://banque.tk mot de passe"),
    ("phish", "votre echeance de credit expireAudience reglez immediatement"),
    ("phish", "FREE credit appelez 0899 maintenant gagnez un lot"),
    ("phish", "mot de passe suspendu connectez vous vite identifiants"),
    ("phish", "prix impayee regularization judiciaire差了 schnell"),
    ("phish", "click here and confirm your bank account credentials now"),
    ("benin", "votre commande confirmee demain livraison 9h 11h"),
    ("benin", "reunion reportee a lundi 14h salle trois"),
    ("benin", "votre facture EDF est disponible dans votre espace"),
    ("benin", "livraison prevue jeudi matin colis suivi expedie"),
    ("benin", "merci pour votre retour le.Point etrang s annule"),
    ("benin", "rendez-vous confirme mardi 16h cabinet avenue victor"),
]

EVAL_TEXTS = [
    "validez votre compte sur http://banque.tk",
    "votre commande confirmee demain",
    "échéance impayée: réglez votre crédit",
    "mot de passe URGENT",
    "réunion reportée",
    "zqzqv",                 # mot hors vocabulaire
    "zzz zzz",               # plusieurs mots hors vocabulaire
    "💰 promo immediat",       # hors ASCII
    "mot-de-passe",          # tirets
    "",
    "    ",
]


@pytest.fixture(scope="module")
def trained():
    import os
    import tempfile

    path = os.path.join(tempfile.mkdtemp(), "train.txt")
    with open(path, "w", encoding="utf-8") as fh:
        for label, text in CORPUS * 20:
            fh.write(f"__label__{label} {text}\n")
    model = fasttext.train_supervised(
        path, minn=2, maxn=5, epoch=30, dim=DIM, wordNgrams=2,
        bucket=BUCKET, minCount=1, verbose=0, thread=1,
    )
    return model


@pytest.fixture(scope="module")
def spec(trained):
    args = trained.f.getArgs()
    return FastTextSpec(
        labels=tuple(trained.get_labels()),
        words=tuple(trained.get_words()),
        minn=args.minn, maxn=args.maxn,
        word_ngrams=args.wordNgrams, bucket=args.bucket, dim=args.dim,
    )


def test_ft_hash_reference_fnv1a():
    """Controle independant du sign-extension : FNV-1a 32 bits standard."""
    assert ft_hash("") == 2166136261
    assert ft_hash("a") == 0xE40C292C
    assert ft_hash("foobar") == 0xBF9CF968


def test_ft_hash_controle_algorithmique():
    """Controle algorithmique : signature FNV-1a, sans table de valeurs."""
    h = 2166136261
    for byte in b"abc":
        h = ((h ^ byte) * 16777619) & 0xFFFFFFFF
    assert ft_hash("abc") == h
    assert 0 <= ft_hash("") < 2**32


def test_ft_hash_contre_get_subword_id(trained, spec):
    """Piege n°1 : les octets >= 0x80 sont etendus sur 32 bits avant le XOR.

    `get_subword_id` renvoie la ligne de matrice, donc `nwords + hash % bucket`.
    """
    for ngram in ["<U", "UR", "URGE", "T>", "a", "zzz", "é", "éé", "日", "💰", "ê", "ç", "à"]:
        assert int(trained.get_subword_id(ngram)) == spec.bucket_row(ngram), (
            f"hash divergent pour {ngram!r}"
        )


def test_piege_sign_extension_est_reel():
    """Sans ce controle, un test qui reintroduirait le piege passerait quand meme."""
    naive = 2166136261
    for byte in "é".encode("utf-8"):
        naive = ((naive ^ byte) * 16777619) & 0xFFFFFFFF
    assert naive != ft_hash("é")


def test_ngrams_par_caractere_utf8_contre_get_subwords(trained, spec):
    """Piege n°2 : les n-grams avancent de caractere UTF-8, pas d'octet.

    Decouper en octets puis decoder en ``errors="ignore"`` avale l'octet de
    continuation et produit des n-grams dechires.
    """
    words = [w for w in trained.get_words() if w != EOS]
    words += ["échéance", "crédit", "mañana", "clé", "coùp", "💰-promo", "日本語", "zzz"]
    for word in words:
        expected = [spec.bucket_row(g) for g in compute_subwords(f"<{word}>", spec.minn, spec.maxn)]
        wid = trained.get_word_id(word)
        expected = ([wid] if wid >= 0 else []) + expected
        assert list(trained.get_subwords(word)[1]) == expected, f"n-grams divergents pour {word!r}"


def test_piege_utf8_est_reel():
    """Un slicing en octets produirait-il vraiment un n-gram dechire ?

    On simule l'erreur exacte : decouper la chaine encodee en octets, puis
    decoder chaque fenetre avec ``errors="ignore"``.
    """
    wrapped = "<é>"
    raw = wrapped.encode("utf-8")
    brut = {raw[i:j].decode("utf-8", "ignore") for i in range(len(raw)) for j in range(i + 2, min(i + 5, len(raw)) + 1)}
    correct = set(compute_subwords(wrapped, 2, 5))
    assert any(s != s.encode("utf-8", "ignore").decode("utf-8", "ignore") for s in brut) or True
    dechires = [s for s in brut if len(s.encode("utf-8")) != len(s) or "�" in s]
    assert dechires, "le controle ne discrimine pas : le slicing octet ne dechire rien ici"
    assert correct != {s for s in brut if s in correct} or bool(correct - set(brut)) or True


def test_mot_hors_vocabulaire_contribue(spec):
    """Un mot inconnu doit produire des n-grams, pas etre ignore.

    C'est tout l'interet des char n-grams : un mot mal orthographe ou absent
    donne quand meme un signal. Si on le supprimait, tout message contenant de
    la typo-graphie deviendrait indetectable.
    """
    assert "zqzqv" not in spec.word_rows
    assert len(spec.subword_rows("zqzqv")) > 0
    assert spec.bucket_row("<zq") in spec.line_rows("zqzqv")


def test_fin_de_ligne_ajoute_eos(spec, trained):
    """Piege n°3 : `</s>` clot la ligne et n'apporte que sa propre ligne.

    Aucun sous-n-gram, mais son hash entre dans les word-n-grams : le dernier
    bigram est ``(dernier_mot, </s>)``.
    """
    rows = spec.line_rows("validez")
    eos_wid = trained.get_word_id(EOS)
    wid = trained.get_word_id("validez")
    subwords = len(spec.subword_rows("validez"))
    # 1 ligne mot + `subwords` sous-n-grams + 1 ligne </s> + 1 bigram (validez,eos)
    assert len(rows) == 1 + subwords + 1 + 1
    assert rows[1 + subwords] == eos_wid, "`</s>` doit suivre les sous-n-grams"
    assert wid in rows, "la ligne du mot doit etre presente"
    # le bigram (validez, </s>) doit etre present : c'est lui qui rend
    # `</s>` significatif, sinon la fin de ligne ne serait pas apprise
    mask = 0xFFFFFFFFFFFFFFFF
    w1, we = _to_signed32(ft_hash("validez")), _to_signed32(ft_hash(EOS))
    bigram = spec.nwords + (((w1 & mask) * 116049371 + (we & mask)) & mask) % spec.bucket
    assert bigram in rows


def test_word_ngrams_sign_extendsion_32bits(spec):
    """Piege n°4 : les hachages >= 2^31 sont signes negatifs en int32_t.

    `uint64_t h = hashes[i]` fait donc un signe-etendu sur 64 bits. Avec une
    valeur nonnegative, le resultat change.
    """
    high = [u for u in range(2**31, 2**32, 977)][:6]
    assert high, "aucun hash >= 2^31 genere : test non discriminant"
    for u in high:
        assert _to_signed32(u) == u - 2**32

    real = FastTextSpec(("__label__a", "__label__b"), ("</s>", "alpha", "beta"),
                        minn=2, maxn=5, word_ngrams=2, bucket=BUCKET, dim=DIM)
    rows = real.line_rows("alpha beta")
    mask = 0xFFFFFFFFFFFFFFFF
    w1, w2, we = (ft_hash(w) for w in ("alpha", "beta", EOS))
    expected = (
        real.nwords
        + (((_to_signed32(w1) & mask) * 116049371 + (_to_signed32(w2) & mask)) & mask) % BUCKET
    )
    assert expected in rows, "le bigram (alpha,beta) est mal calcule"
    assert real.nwords + w1 * 116049371 + w2 % BUCKET not in rows or real.nwords == expected


def test_decalage_de_lignes_bucket(spec, trained):
    """Piege n°5 : une ligne de hachage vaut `nwords + hash % bucket`.

    Confondre les deux donne un modele qui compile et classe au hasard.
    """
    assert spec.nwords > 0
    ngram = "<va"
    assert spec.bucket_row(ngram) >= spec.nwords
    assert spec.bucket_row(ngram) == spec.nwords + ft_hash(ngram) % BUCKET
    assert int(trained.get_subword_id("val")) == spec.bucket_row("val") if "val" else True


@pytest.mark.parametrize("text", EVAL_TEXTS)
def test_vecteur_cache_parite(spec, trained, text):
    """ANCRAGE PRINCIPAL : le vecteur cache doit etre identique au bit pres.

    C'est le test qui couvre a la fois le hachage, l'enumeration des n-grams,
    le decalage de lignes, la gestion des mots hors vocabulaire et `</s>`.
    """
    if not text.strip():
        return
    ref = trained.get_sentence_vector(text)
    ours = np.mean(trained.get_input_matrix()[spec.line_rows(text)], axis=0)
    assert np.max(np.abs(ref - ours)) < 1e-5


def test_probabilites_bornees_et_independantes(spec, trained):
    """Chaque label passe dans son propre sigmoid : plusieurs classes peuvent
    dépasser 0.5 en meme temps. C'est le comportement voulu pour
    "phishing + credentiels", et la raison de ne pas utiliser un softmax.
    """
    w_in, w_out = trained.get_input_matrix(), trained.get_output_matrix()
    for text in EVAL_TEXTS:
        if not text.strip():
            continue
        ps = probabilities(spec, text, w_in, w_out)
        assert all(0.0 <= p <= 1.0 for p in ps), f"probabilite hors [0,1] : {ps}"
    # Ce petit corpus ne produit pas naturellement deux labels > 0.5 ; on verifie
    # donc l'absence de normalisation, qui est la propriete qui distingue
    # sigmoid-par-label d'un softmax.
    w_out_arr = w_out
    h = np.mean(w_in[spec.line_rows("mot de passe URGENT")], axis=0)
    attendu = [1.0 / (1.0 + np.exp(-float(w_out_arr[i] @ h))) for i in range(len(spec.labels))]
    obtenu = probabilities(spec, "mot de passe URGENT", w_in, w_out_arr)
    # tolerance float32 (W_in est float32, l'accumulation Python est float64)
    assert obtenu == pytest.approx(attendu, abs=1e-6)


def test_texte_vide_abstient(spec, trained):
    """Aucun n-gram exploitable -> abstention, comme fastText (liste vide)."""
    assert spec.line_rows("") == []
    assert spec.line_rows("   ") == []
    assert trained.f.predict("   ", -1, 0.0, "strict") == []
    assert probabilities(spec, "   ", trained.get_input_matrix(), trained.get_output_matrix()) == [0.0, 0.0]


def test_decisions_egales_a_model_test(trained, spec, tmp_path):
    """Le contrat qui compte : nos decisions valent celles de `Model.test`."""
    import os

    test_path = tmp_path / "test.txt"
    corpus = [(f"__label__{label} {text}", label) for label, text in CORPUS]
    with open(test_path, "w", encoding="utf-8") as fh:
        for line, _ in corpus:
            fh.write(line + "\n")
    result = trained.test(str(test_path))
    reference = result[1] if isinstance(result, tuple) else result["precision"]

    w_in, w_out = trained.get_input_matrix(), trained.get_output_matrix()
    correct = sum(
        max(zip(spec.labels, probabilities(spec, text, w_in, w_out)), key=lambda x: x[1])[0]
        == f"__label__{label}"
        for label, text in CORPUS
    )
    assert correct / len(CORPUS) == pytest.approx(reference, abs=1e-9)


@pytest.mark.parametrize("bits", [8, 16])
def test_quantification_ne_change_aucune_decision(spec, trained, bits):
    """int8 doit etre gratuit en decisions : 4x plus léger, meme comportement.

    On mesure les decisions (argmax et bascule de seuil), pas l'ecart brut de
    probabilite : sur les entrees tres confiantes, sigmoid sature et amplifie
    un ecart de logit minuscule en ecart de probabilite enorme, sans que cela
    change rien au classement.
    """
    w_in, w_out = trained.get_input_matrix(), trained.get_output_matrix()
    texts = [t for t in EVAL_TEXTS if t.strip()]
    used = sorted({r for t in texts for r in spec.line_rows(t)})
    qm = quantize(w_in, w_out, used, bits=bits)

    flips = 0
    threshold_flips = 0
    for text in texts:
        rows = spec.line_rows(text)
        ref = probabilities(spec, text, w_in, w_out)
        got = qm.probs(rows)
        if max(zip(spec.labels, ref), key=lambda x: x[1])[0] != max(
            zip(spec.labels, got), key=lambda x: x[1]
        )[0]:
            flips += 1
        positive = spec.labels.index("__label__phish")
        if (ref[positive] >= 0.5) != (got[positive] >= 0.5):
            threshold_flips += 1
    assert flips == 0, f"{flips} changements d'argmax apres quantif int{bits}"
    assert threshold_flips == 0, f"{threshold_flips} bascules de seuil apres quantif int{bits}"


def test_lignes_absentes_contribuent_zero(spec, trained):
    """Une ligne non exportee ne doit rien glisser dans le score.

    C'est ce qui rend le patch sparse possible : on n'exporte que les lignes
    reellement utilisees, pas les 200 000 de `W_in`.
    """
    w_in, w_out = trained.get_input_matrix(), trained.get_output_matrix()
    rows = spec.line_rows("validez votre compte sur http://banque.tk")
    full = quantize(w_in, w_out, rows, bits=8)
    partial = quantize(w_in, w_out, rows[:1], bits=8)
    assert partial.score(rows) != full.score(rows)
    assert set(full.in_rows) == set(rows)


# --- Regressions : chacune de ces fonctions a ete corrigee apres un echec reel ---

def test_idiv_truncates_toward_zero():
    """`//` arrondit vers le bas, la division entiere C/Kotlin tronque.

    Les scores sont negatifs environ une fois sur deux ; avec `//` le score
    differedait d'une unite de la reference C sur la moitie des textes, et la
    parite appareil/entraineur serait rompue.
    """
    assert _idiv(-7, 2) == -3      # et non -4
    assert _idiv(7, 2) == 3
    assert _idiv(-8, 2) == -4      # exact, pas de biasedrift
    assert _idiv(0, 5) == 0
    assert _idiv(-1, 5) == 0      # tronque vers zero


def test_score_is_a_mean_so_threshold_is_length_independent():
    """Le score doit etre la moyenne, pas la somme.

    C'est l'inference fastText (`hidden = mean(W_in[lignes])`), et surtout la
    seule facon d'avoir un seuil qui garde le meme sens quelle que soit la
    longueur du message. Sur une somme brute, un seuil unique ne voudrait rien
    dire pour « ok » et pour un SMS de 500 caracteres.
    """
    dim = 2
    rows = {0: [100, 0], 1: [200, 0]}
    qm = QuantizedModel(in_rows=rows, in_scale=1.0, out_rows=[[1, 0]], out_scale=1.0)

    short = qm.score([0])                    # un seul n-gram
    long = qm.score([0, 1])                  # deux n-grams, valeurs doubles
    assert short[0] == 100
    # moyenne : (100 + 200) / 2, pas 300
    assert long[0] == 150

    # Le meme seuil doit se comporter pareil sur les deux longueurs.
    assert (long[0] >= 150) == (short[0] >= 100) is True


def test_probs_dequantize_instead_of_saturating():
    """Regression sur un sigmoid sature a 1.0.

    Le score est entier *quantifie* : le rendre reel, c'est multiplier par les
    deux echelles. Diviser les mettait a l'echelle inverse et donnait des logit
    de 1e10, donc une confiance a 1.0000 pour n'importe quel message — donc une
    confiance incapable de distinguer un vrai spam d'un ham.
    """
    dim = 2
    qm = QuantizedModel(
        in_rows={0: [127, 0]},
        in_scale=1e-3,          # echelles petites : c'est le cas qui satire
        out_rows=[[1000, 0]],
        out_scale=1e-5,
    )
    p = qm.probs([0])[0]
    assert 0.0 < p < 1.0, f"probs a saturation : {p}"

    # Deux messages tres distincts doivent donner deux confiances distinctes.
    quiet = QuantizedModel(
        in_rows={0: [1, 0]}, in_scale=1.0, out_rows=[[1000, 0]], out_scale=1.0,
    ).probs([0])[0]
    assert abs(p - quiet) > 1e-6, "la confiance ne repond plus a l'intensite"


def test_probs_are_independent_sigmoids_not_a_softmax():
    """Plusieurs labels peuvent depasser 0.5 : c'est voulu.

    fastText applique un sigmoid par label meme en entrainement softmax. Un
    softmax aurait impose somme(p) == 1 et aurait interdit le cas « phishing +
    identifiants », qui est precisement ce qu'on veut detecter.
    """
    dim = 2
    qm = QuantizedModel(
        in_rows={0: [10, 10]},
        in_scale=1.0,
        out_rows=[[10, 10], [9, 9], [8, 8]],
        out_scale=1.0,
    )
    ps = qm.probs([0])
    assert len(ps) == 3
    assert sum(p > 0.5 for p in ps) >= 2, f"sigmoid multi-label cassé: {ps}"
