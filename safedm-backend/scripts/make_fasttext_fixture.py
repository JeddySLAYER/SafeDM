import json, sys
sys.path.insert(0, "/home/joan/Projects/SafeDM/safedm-backend")
from app.ml.fasttext_runtime import FastTextSpec, probabilities, quantize

m = __import__("fasttext").train_supervised(
    "/tmp/sms_train.txt", minn=2, maxn=5, epoch=25, dim=16, wordNgrams=2,
    bucket=200000, lr=0.5, minCount=2, verbose=0, thread=4, seed=7)
a = m.f.getArgs()
spec = FastTextSpec(tuple(m.get_labels()), tuple(m.get_words()), a.minn, a.maxn,
                    a.wordNgrams, a.bucket, a.dim)
W, O = m.get_input_matrix(), m.get_output_matrix()

def label_of(qm, rr):
    sc = qm.score(rr)
    return max(range(len(sc)), key=lambda i: sc[i])

# Seuil choisi a partir de la marge mediane du jeu de test : il doit separer
# sans jamais classer « ham » sur du spam. On le derive, on ne l'invente pas.
import statistics
probe_rows = []
for line in open("/tmp/sms_test.txt", encoding="utf-8"):
    parts = line.split(None, 1)
    if len(parts) == 2 and parts[0].startswith("__label__"):
        probe_rows.append((spec.line_rows(parts[1].strip()), parts[0].strip()))
probe_used = sorted({r for rr, _ in probe_rows for r in rr})
probe_qm = quantize(W, O, probe_used, bits=8)
gaps = []
for rr, g in probe_rows:
    sc = probe_qm.score(rr)
    hi = max(range(len(sc)), key=lambda i: sc[i])
    lo = min(range(len(sc)), key=lambda i: sc[i])
    gaps.append((sc[hi] - sc[lo], g))
THRESH = int(statistics.median([abs(g_) for g_, lab in gaps if lab.endswith("ham")]) * 0.5)
print("seuil derive :", THRESH)

TEXTS = [
 "validez votre compte sur http://banque.tk",
 "votre commande confirmee demain",
 "échéance impayée: réglez votre crédit",
 "mot de passe URGENT",
 "réunion reportée",
 "zqzqv",
 "zzz zzz",
 "💰 promo immediat",
 "mot-de-passe",
 "WINNER!! You have been selected to receive a £900 prize! Call 09061701461 now",
 "Ok lar... Joking wif u oni...",
 "Sorry, I've missed my train, be there by 6",
 "",
 "    ",
 "a",
 "<?>",
 "Ünïcödé",
]
rows_all = [spec.line_rows(t) for t in TEXTS]
used = sorted({r for rr in rows_all for r in rr})
qm = quantize(W, O, used, bits=8)

payload = {
    "labels": list(spec.labels), "words": list(spec.words),
    "minn": spec.minn, "maxn": spec.maxn, "wordNgrams": spec.word_ngrams,
    "bucket": spec.bucket, "dim": spec.dim,
    "inScale": repr(qm.in_scale), "outScale": repr(qm.out_scale),
    "inRows": {str(k): v for k, v in sorted(qm.in_rows.items())},
    "outRows": qm.out_rows,
    "threshold": THRESH,
    "cases": [
        {"text": t, "rows": rr, "scores": (qm.score(rr) if rr else []),
         "label": spec.labels[label_of(qm, rr)] if rr else "",
         "abstained": (not rr) or (max(qm.score(rr)) < THRESH),
         # Reference quantifiee : c'est ce que l'appareil possede reellement.
         # Comparer aux poids flottants mesurerait l'erreur de quantification
         # (~1e-4), pas un defaut d'implementation.
         "confidence": (qm.probs(rr)[label_of(qm, rr)]
                        if rr and max(qm.score(rr)) >= THRESH else 0.0)}
        for t, rr in zip(TEXTS, rows_all)
    ],
}
with open("/tmp/ft_fixture.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False)
print("fixture ecrite :", len(spec.words), "mots,",
      len(qm.in_rows), "lignes,", len(TEXTS), "textes,",
      f"{len(json.dumps(payload))//1024} Ko")
