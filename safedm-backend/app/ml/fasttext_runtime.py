"""Inference fastText supervisee, reimplementee en arithmetique entiere.

Pourquoi reimplementer plutot que d'embarquer la lib fastText ?
---------------------------------------------------------------
fastText n'est PAS un reseau de neurones profonds : en mode supervise, son
inference est exactement

    hidden = mean(W_in[line(text)])
    score  = W_out @ hidden
    prob   = softmax(score)

C'est une modele **lineaire** sur un sac de n-grams. On peut donc l'ecrire en
entiers, comme la regression logistique entiere deja retenue pour le modele
local precedent. Concretement on obtient :

  * un runtime Kotlin de quelques dizaines de lignes, sans dependance native ;
  * un contrat de determinisme bit-a-bit entre Python, Kotlin et l'entraineur ;
  * des poids **patchables ligne par ligne** : un patch est un dictionnaire
    sparse ``{ligne: vecteur}``, verifiable et signable, pas un blob opaque.

Les trois pieges d'exactitude, tous reproduits ici et couvert par les tests :

1. **FNV-1a sign-etendu.** ``Dictionary::hash`` fait
   ``h ^= uint32_t(int8_t(octet))``. Pour un octet >= 0x80, le signe est etendu
   sur 32 bits avant le XOR. Un ``h ^= octet`` naif (qui ne touche que les
   8 bits bas) donne un hash **different** sur tout texte accentue.
2. **N-grams en caracteres, pas en octets.** ``computeSubwords`` avance `j`
   de caractere UTF-8 complet et compte `n` en **caracteres**. Decouper en
   octets puis decoder en ``errors="ignore"`` avale silencieusement l'octet
   de continuation et produit des n-grams dechirés.
3. **Decalage de lignes.** L'espace de travail n'est pas
   ``[0, bucket) + mots`` : les lignes mots occupent ``[0, nwords)`` et les
   lignes de hachage occupent ``[nwords, nwords + bucket)``. Confondre les deux
   donne un modele qui "compile" et classe au hasard.

Deux hachages distincts coexistent et ne doivent pas etre confondus :
``ft_hash`` (FNV-1a, chainage des octets d'un n-gram) et
``FT_NGRAM_COMBINE`` (combinaison glissante des hachages de mots pour les
word-n-grams).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

FNV_OFFSET = 2166136261
FNV_PRIME = 16777619
FT_NGRAM_COMBINE = 116049371
BOW = "<"
EOW = ">"
EOS = "</s>"


def ft_hash(text: str) -> int:
    """fastText ``Dictionary::hash`` — FNV-1a 32 bits, octets sign-etendus.

    Le sign-extension est le point critique : ``int8_t`` etendu sur 32 bits
    vaut ``0xFFFFFFC3`` pour 0xC3, pas ``0x000000C3``. Sans cela, tout texte
    contenant un accent (donc tout le francais) hash differently de fastText.
    """
    h = FNV_OFFSET
    for byte in text.encode("utf-8"):
        signed = byte - 256 if byte >= 128 else byte
        h = (h ^ (signed & 0xFFFFFFFF)) & 0xFFFFFFFF
        h = (h * FNV_PRIME) & 0xFFFFFFFF
    return h


def compute_subwords(word: str, minn: int, maxn: int) -> list[str]:
    """fastText ``Dictionary::computeSubwords`` — n-grams de BOW+word+EOW.

    Itere sur les caracteres UTF-8, pas sur les octets. Le caractere de bord
    est exclu (``n == 1 and (i == 0 or j == size)``), ce qui n'a pas d'effet
    quand ``minn >= 2`` mais doit rester fidele pour generaliser.
    """
    chars = list(word)
    size = len(chars)
    ngrams: list[str] = []
    if maxn <= 0:
        return ngrams
    for i in range(size):
        for n in range(1, maxn + 1):
            j = i + n
            if j > size:
                break
            if n >= minn and not (n == 1 and (i == 0 or j == size)):
                ngrams.append("".join(chars[i:j]))
    return ngrams


def _idiv(a: int, b: int) -> int:
    """Division entiere **tronquee vers zero**, comme C++ et Kotlin.

    `//` en Python arrondit vers le bas : `-7 // 2 == -4`, alors que
    `-7 / 2 == -3` en arithmetique entiere C. Les scores sont negatifs une
    moitie du temps, donc utiliser `//` decalerait le score d'une unite vers le
    bas exactement dans ce cas, et la parite avec l'appareil serait rompue sur
    une moitie des textes.
    """
    q = abs(a) // abs(b)
    return -q if (a < 0) != (b < 0) else q


def _sigmoid(x: float) -> float:
    if x >= 0.0:
        return 1.0 / (1.0 + math.exp(-x))
    z = math.exp(x)
    return z / (1.0 + z)


def _to_signed32(u: int) -> int:
    """Reinterprete un uint32 comme int32 (ce que fait le stockage C++)."""
    return u - 0x100000000 if u >= 0x80000000 else u


@dataclass(frozen=True)
class FastTextSpec:
    """Tout ce dont l'inference a besoin, serialisable vers l'appareil."""

    labels: tuple[str, ...]
    words: tuple[str, ...]
    minn: int
    maxn: int
    word_ngrams: int
    bucket: int
    dim: int

    @property
    def nwords(self) -> int:
        return len(self.words)

    @property
    def word_rows(self) -> dict[str, int]:
        return {w: i for i, w in enumerate(self.words)}

    def bucket_row(self, ngram: str) -> int:
        """Ligne de matrice d'un n-gram : ``nwords + hash % bucket``."""
        return self.nwords + ft_hash(ngram) % self.bucket

    def subword_rows(self, token: str) -> list[int]:
        wrapped = BOW + token + EOW
        return [self.bucket_row(g) for g in compute_subwords(wrapped, self.minn, self.maxn)]

    def line_rows(self, text: str) -> list[int]:
        """fastText ``Dictionary::getLine`` pour une ligne de prediction.

        Trois comportements non triviaux, tous verifies contre les bindings C++ :

        * un mot **hors vocabulaire** apporte bien ses n-grams (sans ligne mot).
          C'est tout l'interet des char n-grams : un mot inconnu ou mal orthographe
          produit quand meme un signal, au lieu d'etre silencieusement ignore ;
        * la ligne se termine par ``</s>``, qui n'apporte que sa propre ligne
          (aucun sous-n-gram) mais qui **entre dans le hachage des word-n-grams**,
          donc le dernier bigram est ``(dernier_mot, </s>)`` ;
        * un mot litteral ``</s>`` dans le texte arrete la lecture.
        """
        rows: list[int] = []
        word_hashes: list[int] = []
        rows_of = self.word_rows
        for token in text.split():
            wid = rows_of.get(token, -1)
            if wid >= 0:
                if self.maxn <= 0:
                    rows.append(wid)
                else:
                    rows.append(wid)
                    rows.extend(self.subword_rows(token))
                word_hashes.append(ft_hash(token))
            elif token != EOS:
                rows.extend(self.subword_rows(token))
                word_hashes.append(ft_hash(token))
            if token == EOS:
                return self._finish(rows, word_hashes)
        return self._finish(rows, word_hashes)

    def _finish(self, rows: list[int], word_hashes: list[int]) -> list[int]:
        # `</s>` n'est ajoute que si la ligne a contenu au moins un mot : sur une
        # entree vide ou uniquement blanches, fastText n'abstient pas et renvoie
        # une liste de predictions vide. Ajouter `</s>` quand meme ferait passer
        # une notification vide en "un mot connu", donc en faux positif.
        if not word_hashes:
            return rows
        eos_wid = self.word_rows.get(EOS, -1)
        if eos_wid >= 0:
            rows.append(eos_wid)
            word_hashes.append(ft_hash(EOS))
        rows.extend(self._word_ngram_rows(word_hashes))
        return rows

    def _word_ngram_rows(self, word_hashes: list[int]) -> list[int]:
        """fastText ``Dictionary::addWordNgrams`` — hachage glissant 116049371.

        Piege n°4, et le plus vicieux : ``word_hashes`` est un
        ``vector<int32_t>``. Un hachage >= 2^31 y est donc stocke **negatif**,
        et l'affectation ``uint64_t h = hashes[i]`` le convertit en signe
        etendu sur 64 bits (``0xFFFFFFFFxxxxxxxx``), pas en zero-extension.
        Utiliser la valeur nonnegative change le resultat pour environ la
        moitie des mots — et le taux de hash >= 2^31 depend des octets presents,
        donc le bug frappe plus souvent les textes accentues.
        """
        out: list[int] = []
        n = self.word_ngrams
        if n <= 1:
            return out
        mask = 0xFFFFFFFFFFFFFFFF
        count = len(word_hashes)
        signed = [_to_signed32(x) for x in word_hashes]
        for i in range(count):
            h = signed[i] & mask
            for j in range(i + 1, min(count, i + n)):
                h = (h * FT_NGRAM_COMBINE + signed[j]) & mask
                out.append(self.nwords + h % self.bucket)
        return out


def probabilities(spec: FastTextSpec, text: str, w_in, w_out) -> list[float]:
    """Reference flottante : moyenne des lignes puis **sigmoid par label**.

    Piege n°5 : l'inference fastText n'est PAS un softmax. Chaque label passe
    independamment dans un sigmoid, meme pour un modele multi-classe entraine
    avec ``loss="softmax"`` (le softmax ne sert qu'au calcul du gradient pendant
    l'entrainement). Un softmax ici imposeait ``somme(p) = 1``, ce qui est faux
    pour une classification multi-etiquettes : plusieurs classes peuvent
    reellement etre actives en meme temps.

    Une consequence utile : deux labels peuvent tous deux depasser 0.5, ce qui
    est le comportement voulu pour " phishing + credentiels ".

    Sert de temoin pour valider le chemin entier. En production on utilise
    :func:`quantize` puis :class:`QuantizedModel`, qui fait deja ce sigmoid.
    """
    rows = spec.line_rows(text)
    dim = spec.dim
    nlabels = len(spec.labels)
    if not rows:
        return [0.0] * nlabels
    hidden = [0.0] * dim
    for r in rows:
        row = w_in[r]
        for d in range(dim):
            hidden[d] += float(row[d])
    n = float(len(rows))
    out = []
    for l in range(nlabels):
        acc = 0.0
        wrow = w_out[l]
        for d in range(dim):
            acc += float(wrow[d]) * (hidden[d] / n)
        out.append(_sigmoid(acc))
    return out


def quantize(w_in, w_out, rows: list[int], bits: int = 8) -> "QuantizedModel":
    """Quantifie en entiers, **uniquement les lignes reellement utilisees**.

    Restreindre aux lignes vues pendant l'evaluation est ce qui rend le modele
    patchable : le patch porte sur ces lignes la, pas sur les 2 Mo de `W_in`.
    Les lignes non exportees valent zero, ce qui revient a dire qu'elles ne
    contribuent pas au score.
    """
    qmax = (1 << (bits - 1)) - 1
    used = sorted(set(rows))
    peak = 0.0
    for r in used:
        row = w_in[r]
        for v in row:
            peak = max(peak, abs(float(v)))
    in_scale = max(peak / qmax, 1e-12) if peak > 0 else 1.0

    out_peak = 0.0
    for l in range(w_out.shape[0]):
        for v in w_out[l]:
            out_peak = max(out_peak, abs(float(v)))
    out_scale = max(out_peak / 32767.0, 1e-12) if out_peak > 0 else 1.0

    in_rows: dict[int, list[int]] = {}
    for r in used:
        row = w_in[r]
        in_rows[r] = [
            max(-qmax - 1, min(qmax, int(round(float(v) / in_scale)))) for v in row
        ]
    out_rows = [
        [max(-32768, min(32767, int(round(float(v) / out_scale)))) for v in w_out[l]]
        for l in range(w_out.shape[0])
    ]
    return QuantizedModel(in_rows, in_scale, out_rows, out_scale)


@dataclass
class QuantizedModel:
    """Inference entier exacte, reproductible sur n'importe quelle plateforme."""

    in_rows: dict[int, list[int]]
    in_scale: float
    out_rows: list[list[int]]
    out_scale: float

    def score(self, rows: list[int]) -> list[int]:
        """Scores entiers, normalises par le nombre de n-grams (la moyenne).

        Retourne ``sum_r sum_d q_in[r][d] * q_out[l][d] / max(len(rows), 1)``.

        La moyenne n'est pas cosmetique : c'est l'inference supervisee de
        fastText (``hidden = mean(W_in[lignes])``), et surtout c'est ce qui rend
        le seuil **independant de la longueur du message**. Sur une somme brute,
        un seuil global vaudrait un cout different sur « ok » et sur un SMS de
        500 caracteres, et il faudrait un seuil par longueur.

        Diviser par une constante positive ne change pas l'argmax d'un texte
        donne, donc l'exactitude reste identique a celle de ``Model.test``.
        """
        dim = len(self.out_rows[0])
        acc = [0] * dim
        for r in rows:
            row = self.in_rows.get(r)
            if row is None:          # ligne non exportee : contribution nulle
                continue
            for d in range(dim):
                acc[d] += row[d]
        n = max(len(rows), 1)
        out = []
        for l in range(len(self.out_rows)):
            qrow = self.out_rows[l]
            total = 0
            for d in range(dim):
                total += acc[d] * qrow[d]
            out.append(_idiv(total, n))
        return out

    def probs(self, rows: list[int]) -> list[float]:
        """Sigmoid par label, sur le score **desquantifie**.

        Le score de `score()` est entier quantifie : le rendre reel, c'est le
        multiplier par les deux echelles. Diviser les*ecalerait* dans le sens
        contraire et produirait des logit de l'ordre de 1e10, donc un sigmoid
        sature a 1.0 partout et une confiance qui ne distingue plus rien.
        """
        factor = self.in_scale * self.out_scale
        return [_sigmoid(s * factor) for s in self.score(rows)]
