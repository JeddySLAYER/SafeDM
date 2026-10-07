"""A/B des questions Noul : detects le biais sur les SMS OTP authentiques.

Le benchmark a montre 2 faux positifs qui sont en realite des SMS bancaires
legitimes ("Code OTP 884213 pour votre carte", "Orange Money: votre code de
confirmation est 551209"). Jev confondait *afficher* un code avec *demander*
un code, et comptait tout numero de telephone comme un piege.

Ce script compare l'ancien jeu de questions au nouveau sur le corpus complet.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings  # noqa: E402
from app.services.jev_service import _MALICIOUS_VERDICTS, _URGENCY_LEVELS, JevService  # noqa: E402
from typesafe_sdk import Choice, Noul, Score  # noqa: E402
from scripts.benchmark_jev import CORPUS  # noqa: E402

MAL = set(_MALICIOUS_VERDICTS)
SUSPECT_BOUNDARY = {"benign_marketing", "legitimate", "none"}

NEW_QUESTIONS = {
    "verdict": Choice(
        instructions=(
            "Classe ce SMS selon le risque principal pour le destinataire. "
            "Choisis 'legitimate' si c'est une notification transactionnelle normale "
            "d'une banque, d'un operateur ou d'un service identifie, meme si elle "
            "contient un code, un montant ou un avertissement de securite."
        ),
        criteria={
            "phishing": "Usurpation d'une marque pour obtenir des identifiants.",
            "social_engineering": "Manipule la confiance, l'urgence ou l'autorite pour obtenir une action.",
            "scam_financial": "Promet un gain ou reclame un paiement en amont.",
            "legitimate": "Notification ou message normal d'un expediteur identifie, sans pression.",
            "benign_marketing": "Publicite ou rappel administratif sans sollicitation sensible.",
            "none": "Aucun risque identifiable.",
        },
    ),
    "urgency": Score(
        instructions="A quel point ce message utilise-t-il l'urgence pour faire agir le destinataire ?",
        criteria=_URGENCY_LEVELS,
    ),
    "credential_request": Noul(
        instructions=(
            "REPONSE 0 si le message RECOIT, AFFICHE ou RAPPELLE un code (OTP, PIN) "
            "ou une reference : c'est une notification, pas une demande.\n"
            "Reponds 1 uniquement si le message EXIGE que le destinataire FOURNISSE "
            "un mot de passe, un code, un RIB ou une coordonnee bancaire."
        ),
    ),
    "sensitive_data_request": Noul(
        instructions=(
            "Reponds 1 uniquement si le message EXIGE que le destinataire FOURNISSE "
            "des donnees sensibles (numero de carte complet, CVV, RIB, mot de passe, "
            "piece d'identite) ou exige un transfert d'argent."
        ),
    ),
    "link_deception": Noul(
        instructions=(
            "Reponds 1 uniquement si le message PIEGE : lien raccourci ou domaine "
            "dissimule, QR code, ou incitation a appeler un numero choisi par "
            "l'attaquant.\n"
            "Reponds 0 si le message cite un canal officiel connu (site de la banque, "
            "service client de l'operateur, code USSD court, lien de suivi de commande)."
        ),
    ),
}

OLD_IDS = ["credential_request", "sensitive_data_request", "link_deception"]


def run(label: str, questions: dict, rows_out: list) -> None:
    settings = Settings(analysis_demo_mode=False)
    service = JevService(settings=settings)
    client = service._get_client()

    print(f"\n{'=' * 96}\n{label}\n{'=' * 96}")
    print(f"{'#':>3}  {'attendu':<18} {'obtenu':<18} {'score':>5} {'conf':>5}  msg")
    for i, (message, expected, difficulty) in enumerate(CORPUS, 1):
        started = time.perf_counter()
        resp = client.system_one(
            state={"message": message, "urls": []},
            questions=questions,
            model=settings.typesafe_model,
        )
        verdict = resp.answers["verdict"]
        probs = dict(verdict.probabilities or {})
        got = max(probs, key=probs.get) if probs else ""
        malicious = sum(float(probs.get(n, 0.0)) for n in _MALICIOUS_VERDICTS)
        score = int(round(max(0.0, min(1.0, malicious)) * 100))
        conf = float(verdict.confidence)
        ms = (time.perf_counter() - started) * 1000

        nouls = {
            k: float(getattr(resp.answers[k], "noul", 0.0))
            for k in OLD_IDS
            if k in resp.answers
        }
        mark = "OK " if got == expected else "RATE"
        short = (message[:36] + "...") if len(message) > 39 else message
        print(f"{i:>3}  {expected:<18} {got:<18} {score:>5} {conf:>5.2f}  {mark} {short}")
        print(f"      nouls: {nouls}")

        rows_out.append(
            {
                "index": i,
                "expected": expected,
                "got": got,
                "score": score,
                "confidence": conf,
                "nouls": nouls,
                "difficulty": difficulty,
                "message": message,
            }
        )


def summarize(rows: list, label: str) -> None:
    tp = sum(1 for r in rows if r["got"] in MAL and r["expected"] in MAL)
    fn = sum(1 for r in rows if r["got"] not in MAL and r["expected"] in MAL)
    fp = sum(1 for r in rows if r["got"] in MAL and r["expected"] not in MAL)
    tn = sum(1 for r in rows if r["got"] not in MAL and r["expected"] not in MAL)
    exact = sum(1 for r in rows if r["got"] == r["expected"])

    mal = [r["score"] for r in rows if r["expected"] in MAL]
    ben = [r["score"] for r in rows if r["expected"] not in MAL]

    print(f"\n--- {label} ---")
    print(f"  exactitude verdict : {exact}/{len(rows)}")
    print(f"  recall menace      : {tp}/{tp + fn}" + (f" = {tp / (tp + fn):.0%}" if tp + fn else ""))
    print(f"  precision menace   : {tp}/{tp + fp}" + (f" = {tp / (tp + fp):.0%}" if tp + fp else ""))
    print(f"  faux positifs      : {fp} -> {[r['index'] for r in rows if r['got'] in MAL and r['expected'] not in MAL]}")
    print(f"  faux negatifs      : {fn}")
    print(f"  score malveillants: min={min(mal)} moyenne={sum(mal) / len(mal):.1f}")
    print(f"  score benigns     : min={min(ben)} max={max(ben)} moyenne={sum(ben) / len(ben):.1f}")

    otp = [r for r in rows if "otp" in r["message"].lower() or "code de confirmation" in r["message"].lower()]
    if otp:
        print("  SMS OTP authentiques (doivent rester non comptes comme phishing) :")
        for r in otp:
            state = "PHISHING A TORT" if r["got"] in MAL else "correct"
            print(f"    #{r['index']} score={r['score']:>3} conf={r['confidence']:.2f} -> {state}")


def main() -> None:
    from app.services.jev_service import _SEMANTIC_QUESTIONS

    old_rows: list = []
    new_rows: list = []
    run("QUESTIONS ACTUELLES (jeu dans jev_service.py)", _SEMANTIC_QUESTIONS, old_rows)
    summarize(old_rows, "AVANT")

    run("QUESTIONS REECRITES (frontieres negatives explicites)", NEW_QUESTIONS, new_rows)
    summarize(new_rows, "APRES")

    Path("/tmp/jev_ab_old.json").write_text(json.dumps(old_rows, indent=2, default=str))
    Path("/tmp/jev_ab_new.json").write_text(json.dumps(new_rows, indent=2, default=str))


if __name__ == "__main__":
    main()