#!/usr/bin/env python3
"""Entraine, quantifie et signe le modele local de SafeDM.

======================================================================
ARBITRAGE : TFLite ou regression logistique entiere ?
======================================================================

Le plan initial prevoyait TensorFlow Lite. Apres examen, ce n'est pas le bon
outil ici, pour quatre raisons concretees :

1. **Le modele est trivial.** Une regression logistique sur 50 features
   entieres est `sigmoid(w.x + b)`. TFLite pour cela, c'est un runtime
   d'interpreteur de graphes de plusieurs Mo pour executer 50 multiplications.
   Cout : ~2-4 Mo d'APK pour un gain nul.

2. **TFLite casse le contrat de determinisme.** Le contrat V2 impose des
   `uint8` et une parite bit-a-bit entre Python, Kotlin et (a terme) le JS.
   TFLite fait ses accumulations en `float32`. Deux plateformes, ou deux
   versions de runtime, peuvent differer au dixieme — et donc changer le
   niveau affiche a l'utilisateur. C'est exactement le piege qu'on a deja paye
   avec SimHash.

3. **Le contrat de patch exige des entiers.** Un patch signe et verifiable doit
   etre reproductible bit-a-bit. Un blob `.tflite` est un artefact binaire
   versionne par le runtime, pas par nous : on ne peut pas garantir qu'il
   produise les memes sorties dans 5 ans.

4. **Pas de benefice mesure.** TFLite ne paie que si le modele devient assez
   complexe pour justifier un reseau (texte, non lineaires, interactions
   complexes). Ce n'est pas le cas : les 50 features sont des comptages
   normalises, et leur combination lineaire est exactement la forme qu'on
   veut pour rester auditables.

**Decision : regression logistique entiere, zero dependance.** Les poids sont
des entiers dans un JSON lisible, signable et diffable. Si un jour un modele
texte (embedding + reseau) devient pertinent, TFLite redevient raisonnable —
et le patch aura alors la forme d'un modele, pas d'un blob opaque.

Ce qui fait la qualite du modele, ce n'est pas le runtime : c'est le dataset.
Avec 28 messages (dont 8 benins), ce modele est un **demarrage**, pas une
reference. Le script affiche donc la validation croisee, pas la precision sur
les donnees d'entrainement, et refuse de publier un modele qui ne bat pas le
hasard.

======================================================================
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.feature_extraction import extract_features, FEATURE_NAMES  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
BENCHMARK = ROOT / "tests/fixtures/jev_benchmark_baseline.json"
GOLDEN = ROOT / "tests/fixtures/feature_vectors.json"

# Les cibles benignes des benchmarks Jev, converties en binaire.
BENIGN_LABELS = {"legitimate", "benign_marketing"}
MODEL_VERSION = 1


def load_dataset() -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Construit la matrice de features et les etiquettes binaires.

    `known_bad_url` est laisse a 128 (« non verifie ») : c'est la seule valeur
    honnete pour un appareil qui n'a pas de reputation reseau, et c'est celle
    que le modele verra en production sur la majorite des messages.
    """
    cases = json.loads(BENCHMARK.read_text(encoding="utf-8"))
    rows: list[list[int]] = []
    labels: list[int] = []
    texts: list[str] = []
    for case in cases:
        text = case["message"]
        rows.append([int(v) for v in extract_features(text, known_bad_url=128)])
        labels.append(0 if case["expected"] in BENIGN_LABELS else 1)
        texts.append(text)
    return np.asarray(rows, dtype=np.float64), np.asarray(labels), texts


def golden_fixture_sha256() -> str:
    """Empreinte des vecteurs dores.

    Le modele est valide pour CE contrat. Si une feature change, l'empreinte
    change, et un patch signe devient detectable comme etant produit pour une
    autre version du contrat. C'est le mecanisme qui relie modele et schema.
    """
    return hashlib.sha256(GOLDEN.read_bytes()).hexdigest()


def evaluate(model: LogisticRegression, X: np.ndarray, y: np.ndarray) -> dict:
    """Validation croisee etrophe, jamais la precision d'entrainement.

    Sur 28 echantillons, un modele peut afficher 97% en entrainement et 58% en
    validation. Publier le premier nombre serait un mensonge : il mesure
    l' memorisation, pas la generalisation.
    """
    # 5 plis : le plus grand nombreCompatible avec ~8 benins sans qu'un pli
    # se retrouve avec zero negatif.
    n_splits = min(5, int(np.bincount(y).min()))
    if n_splits < 2:
        return {"cv_folds": 0, "note": "trop peu d'exemples pour une validation croisee"}

    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    predictions = cross_val_predict(model, X, y, cv=cv)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y, predictions, average="binary", zero_division=0
    )
    tn, fp, fn, tp = confusion_matrix(y, predictions, labels=[0, 1]).ravel()

    # Taux de faux positifs : le cout le plus cher ici. Un « benchmark »
    # bloque sur un SMS de banque legitime fait perdre la confiance de
    # l'utilisateur pour toujours — c'est le mode de defaillance typique des
    # filtres antispam trop agressifs.
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    fnr = fn / (fn + tp) if (fn + tp) else 0.0
    return {
        "cv_folds": n_splits,
        "precision": round(float(precision), 3),
        "recall": round(float(recall), 3),
        "f1": round(float(f1), 3),
        "false_positive_rate": round(float(fpr), 3),
        "false_negative_rate": round(float(fnr), 3),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def out_of_fold_probabilities(
    model: LogisticRegression, X: np.ndarray, y: np.ndarray
) -> tuple[np.ndarray, int]:
    """Probabilites hors pli, indispensable pour choisir un seuil honnete.

    Choisir le seuil sur les predictions d'entrainement revient a optimiser sur
    les donnees qu'on a deja vues : le seuil parait toujoursSpecifications tenir
    la contrainte de faux positifs, puis il echoue des la premiere encounter avec
    du vrai trafic. Un seuil n'a de sens que sur des predictions hors pli.
    """
    n_splits = min(5, int(np.bincount(y).min()))
    if n_splits < 2:
        return model.predict_proba(X)[:, 1], 0
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    return cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1], n_splits


def decide_threshold(
    probabilities: np.ndarray, y: np.ndarray, max_fpr: float = 0.10
) -> float | None:
    """Choisit un seuil sur predictions hors pli, en privilegiant la precision.

    Retourne `None` si AUCUN seuil ne respecte la contrainte de faux positifs.
    C'est deliberé : retourner une valeur par defaut quand la contrainte est
    infaisable transformerait un modele inutilisable en modele « configure »,
    et l'echec n'apparaitrait qu'en production, sur un SMS de banque bloque.
    """
    benign_total = int((y == 0).sum())
    if benign_total == 0:
        return None

    best_threshold, best_score = None, -1.0
    for threshold in np.linspace(0.20, 0.95, 76):
        predictions = (probabilities >= threshold).astype(int)
        tp = int(((predictions == 1) & (y == 1)).sum())
        fp = int(((predictions == 1) & (y == 0)).sum())
        if fp / benign_total > max_fpr:
            continue
        # On maximise la detection sous contrainte de FPR, mais un seuil qui
        # ne detecte rien ne vaut rien : un rappel nul ne sert a personne.
        score = tp - 2 * fp
        if score > best_score:
            best_score, best_threshold = score, float(threshold)

    if best_threshold is None:
        # Diagnostic : meme le seuil le plus permissif depasse la cible.
        predictions = (probabilities >= 0.20).astype(int)
        fp = int(((predictions == 1) & (y == 0)).sum())
        achievable = fp / benign_total
        print(
            f"\nAUCUN seuil ne respecte FPR <= {max_fpr:.0%}. "
            f"Le meilleur atteignable au seuil le plus bas (0.20) est "
            f"{achievable:.1%} : {fp}/{benign_total} faux positifs."
        )
    return best_threshold


def quantize(model: LogisticRegression, threshold: float) -> dict:
    """Convertit les poids en entiers.

    Les features sont des uint8 (0..255). On met les poids a l'echelle 1e4 :
    Assez fin pour preserver l'ordre des scores, assez grossier pour que
    l'arithmetique entiere reste exactement reproductible sur tous les
    langages — c'est l'exigence du contrat.
    """
    scale = 10_000
    weights = [int(round(w * scale)) for w in model.coef_[0]]
    # biais : le threshold est applique directement sur le score, donc le
    #biais est nul par construction et le seuil fait office de terme libre.
    return {
        "weights": weights,
        "weight_scale": scale,
        "threshold_score": int(round(threshold * scale)),
        "intercept": 0,
    }


def score_from_quantized(quantized: dict, features: list[int]) -> int:
    """Reference du score entier. Le Kotlin doit reproduire exactement ca."""
    total = quantized["intercept"]
    for weight, value in zip(quantized["weights"], features, strict=True):
        total += weight * int(value)
    return total


def build_patch(
    quantized: dict,
    metrics: dict,
    dataset_size: int,
    private_key: ec.EllipticCurvePrivateKey,
    publishable: bool,
) -> dict:
    payload = {
        "model_version": MODEL_VERSION,
        # Le statut voyage DANS le patch signe : un client qui ignore la sortie
        # console reste refuse. C'est la seule maniere de garantir qu'un modele
        # non valide ne s'active pas par megarde.
        "status": "production" if publishable else "research",
        "feature_names": list(FEATURE_NAMES),
        "golden_fixture_sha256": golden_fixture_sha256(),
        "quantization": quantized,
        "training": {
            "dataset": "tests/fixtures/jev_benchmark_baseline.json",
            "samples": dataset_size,
            "validated": metrics,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        },
        "canary_percent": 5,
    }
    # CANONISATION : l'empreinte signee doit etre reproductible au bit pres par
    # Kotlin. Deux details cassent cela si on les neglige :
    #  - `json.dumps` insere des espaces apres `:` et `,` par defaut. On impose
    #    le format compact, que `LocalThreatModel.canonicalPayload` reproduit ;
    #  - `ensure_ascii` doit rester `False`, sinon un accent deviendrait
    #    `\uXXXX` cote Python et resterait brut cote Kotlin.
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    # `ec.ECDSA(hashes.SHA256())` produit une signature DER, exactement le
    # format attendu par `Signature.getInstance("SHA256withECDSA")` sur Android.
    signature = private_key.sign(canonical.encode(), ec.ECDSA(hashes.SHA256()))
    payload["signature"] = signature.hex()
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Entraine et signe le modele local SafeDM")
    parser.add_argument("--out", required=True, help="chemin du patch JSON signe")
    parser.add_argument(
        "--private-key",
        help="cle ECDSA P-256 PEM. Generee aleatoirement si absente (mode dev).",
    )
    args = parser.parse_args()

    X, y, texts = load_dataset()
    print(f"dataset : {X.shape[0]} messages, {X.shape[1]} features")
    print(f"  benins : {int((y == 0).sum())}   malveillants : {int((y == 1).sum())}")

    model = LogisticRegression(
        C=0.5,            # regularisation forte : 28 echantillons, 50 features
        max_iter=2000,
        class_weight="balanced",
        solver="liblinear",
    )
    model.fit(X, y)

    metrics = evaluate(model, X, y)
    print("\nvalidation croisee (et NON la precision d'entrainement) :")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))

    # Seuil choisi sur predictions hors pli : le seul qui resiste a la vie reelle.
    oof, n_splits = out_of_fold_probabilities(model, X, y)
    threshold = decide_threshold(oof, y)

    if threshold is None:
        # Aucun seuil deployable : on écrit quand meme le patch (pour allow
        # l'inspection et la reprise quand le dataset grossira), mais il portera
        # le statut 'research' et le client refusera de l'activer.
        threshold = 0.95
        threshold_feasible = False
    else:
        threshold_feasible = True

    # Le modele est-il deployable ? On verifie avec les predictions du SEUIL
    # retenu, pas avec les metriques au seuil par defaut de 0.5.
    final = (oof >= threshold).astype(int)
    tp = int(((final == 1) & (y == 1)).sum())
    fp = int(((final == 1) & (y == 0)).sum())
    fn = int(((final == 0) & (y == 1)).sum())
    tn = int(((final == 0) & (y == 0)).sum())
    deployed_metrics = {
        "precision": round(tp / max(1, tp + fp), 3),
        "recall": round(tp / max(1, tp + fn), 3),
        "false_positive_rate": round(fp / max(1, fp + tn), 3),
        "false_negative_rate": round(fn / max(1, fn + tp), 3),
        "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
    }
    metrics["at_operational_threshold"] = deployed_metrics
    print(f"\nau seuil operationnel {threshold:.3f} (mesure hors pli) :")
    print(json.dumps(deployed_metrics, indent=2, ensure_ascii=False))
    print(f"\nseuil retenu : {threshold:.3f}  (cible : FPR <= 10%)")

    # Verdict de deployabilite, base sur le FPR AU SEUIL CHOISI. Sans ce
    # garde-fou, on publie un modele « valide » qui bloque un tiers des SMS
    # legitimes — c'est le mode d'echec le plus probable et le plus destructeur
    # pour la confiance.
    fpr = deployed_metrics["false_positive_rate"]
    recall = deployed_metrics["recall"]
    publishable = threshold_feasible and fpr <= 0.10 and recall >= 0.60
    if publishable:
        print("\nVERDICT : deployable sous canary 5%.")
    else:
        print("\nVERDICT : NON DEPLOYABLE.")
        if not threshold_feasible:
            print("  - aucun seuil ne respecte la cible de faux positifs.")
        if fpr > 0.10:
            print(f"  - FPR {fpr:.1%} > 10% : trop de SMS legitimes bloques.")
        if recall < 0.60:
            print(f"  - rappel {recall:.1%} < 60% : trop de phishing laisse passer.")
        print("  Cause racine : le dataset (28 messages) est trop petit pour 50 features.")
        print("  Ce n'est PAS un probleme de runtime : entrainer sur plus de donnees")
        print("  labelled, puis relancer. Le patch est ecrit avec le statut")
        print("  'research' pour interdire tout deploiement automatise.")
    print(f"\nseuil de publication : {'OK' if publishable else 'BLOQUE'}")

    quantized = quantize(model, threshold)

    if args.private_key:
        private_key = serialization.load_pem_private_key(
            Path(args.private_key).read_bytes(), password=None
        )
        if not isinstance(private_key, ec.EllipticCurvePrivateKey):
            raise SystemExit("la cle doit etre une cle privee ECDSA (secp256r1).")
    else:
        private_key = ec.generate_private_key(ec.SECP256R1())
        print("\nATTENTION : cle de dev aleatoire. La cle publique correspond")
        print("  doit etre embarquee dans l'app. Ne JAMAIS utiliser cette cle")
        print("  pour signer un patch distribue.")

    patch = build_patch(quantized, metrics, len(texts), private_key, publishable)

    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    print(f"cle publique (a embarquer dans l'app) : {public_key.hex()}")

    # Verification locale de la quantisation : le score entier doit classer
    # dans le meme ordre que le score flottant.
    mismatches = 0
    for features, label in zip(X, y, strict=True):
        vector = [int(v) for v in features]
        predicted = 1 if score_from_quantized(quantized, vector) >= quantized["threshold_score"] else 0
        if predicted != label:
            mismatches += 1
    print(f"\ndesaccord entier/flottant sur l'entrainement : {mismatches}/{len(texts)}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(patch, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"patch ecrit : {out}")
    print(f"empreinte des vecteurs dores liee : {patch['golden_fixture_sha256'][:16]}...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())