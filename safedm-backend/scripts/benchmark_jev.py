"""Benchmark Jev (System One) sur un corpus SMS francais/togolais etiquete.

But : mesurer la qualite reelle de Jev avant de figer quoi que ce soit du V2
(seuils, schema de features, confiance). Ne lance aucun appel si la cle est absente.

Usage :
    .venv/bin/python scripts/benchmark_jev.py
    .venv/bin/python scripts/benchmark_jev.py --out /tmp/jev_bench.json
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings  # noqa: E402
from app.services.jev_service import _MALICIOUS_VERDICTS, JevService  # noqa: E402

# (message, verdict_attendu, difficulte)
# difficulte : "clair" = signal explicite, "frontiere" = ambigu par design.
CORPUS: list[tuple[str, str, str]] = [
    # --- phishing bancaire / OTP (claires) ---
    (
        "Votre compte bancaire est suspendu. Verifiez immediatement vos identifiants sur http://bit.ly/banque228",
        "phishing",
        "clair",
    ),
    (
        "Code OTP 884213 pour votre carte. Ne le communiquez a PERSONNE. Un conseiller vous le reclame au tel? Appelez le 110.",
        "legitimate",
        "frontiere",
    ),
    (
        "Orange Money: votre code de confirmation est 551209. Vous n'avez pas demande cette operation? Composez *155#",
        "legitimate",
        "frontiere",
    ),
    (
        "ALERTE SECURITY: tentative de connexion suspecte. Confirmez votre mot de passe immediatement: https://ecobank-secure.tg/login",
        "phishing",
        "clair",
    ),
    (
        "Votre RIB a ete modifie. Merci de confirmer vos coordonnees bancaires sur https://secure-verif.tg/rib",
        "phishing",
        "clair",
    ),

    # --- arnaque financiere / Orange Money ---
    (
        "FELICITATIONS! Vous avez gagne 5 000 000 FCFA. Envoyez 5000 FCFA au 90 12 34 56 pour recevoir votre lot.",
        "scam_financial",
        "clair",
    ),
    (
        "Votre carte Orange Money est bloquee. Validez votre compte ici: http://bit.ly/3xKm9p",
        "phishing",
        "clair",
    ),
    (
        "Le ministre vous a attribue 10 millions. Cliquez ici pour les recevoir: https://gagne-million.tg",
        "scam_financial",
        "clair",
    ),
    (
        "Votre prochain remboursement de 50000 FCFA est disponible. Transfert sur le compte 123456789",
        "social_engineering",
        "frontiere",
    ),

    # --- ingenierie sociale / urgence ---
    (
        "URGENT votre abonnement interrompu dans 24h. Composez *888# pour eviter la coupure. Reglement immediat",
        "social_engineering",
        "clair",
    ),
    (
        "Dernier avertissement: suspendu de teleadministration. Regularisez vos impayes sous 48h via le lien",
        "social_engineering",
        "clair",
    ),
    (
        "Maman je suis en prison a Lome, envoie vite 20000 FCFA sur ce numero, ne parle pas a papa",
        "social_engineering",
        "clair",
    ),
    (
        "Cher client, votre abonnement Togocom expire ce soir. Renouvelez vite avant la desactivation de votre ligne.",
        "benign_marketing",
        "frontiere",
    ),

    # --- faux support / livraison ---
    (
        "Votre colis est bloque en douane. Payez 3000 FCFA de frais via Orange Money et recevez-le demain.",
        "social_engineering",
        "clair",
    ),
    (
        "Support Orange: nous pouvons vous aider a reinitialiser votre code. Lien: https://or-help.tg",
        "phishing",
        "clair",
    ),

    # --- piege reseau social / emploi ---
    (
        "Petit job a distance 15000 FCFA/jour. Pas de diplome requis. Reponds OUI pour recevoir le lien de recrutement",
        "social_engineering",
        "frontiere",
    ),
    (
        "Ma belle, je suis tombe amoureux de toi. Envoie moi 50000 FCFA pour le billet d'avion et je viens te voir",
        "social_engineering",
        "clair",
    ),

    # --- marketing agressif mais legitime ---
    (
        "Orange: offre speciale ce week-end, 2x data illimitee pour 500 FCFA. validez dans votre espace client.",
        "benign_marketing",
        "clair",
    ),
    (
        "Togocom: pensez a recharger votre credit avant samedi pour eviter l interruption des appels.",
        "benign_marketing",
        "clair",
    ),

    # --- messages parfaitement legitimes ---
    (
        "Bonjour, votre commande a ete livree aujourd'hui. Merci de vos achats.",
        "legitimate",
        "clair",
    ),
    (
        "Rendez-vous confirmes demain a 14h au cabinet. N'oubliez pas vos analyses.",
        "legitimate",
        "clair",
    ),
    (
        "Le cours de change EUR/XOF est de 604,85 aujourd'hui.",
        "legitimate",
        "clair",
    ),
    (
        "Salut, tu es disponible demain pour le match? On joue a 17h au stade de Kégué.",
        "legitimate",
        "clair",
    ),
    (
        "Votre facture electricity de ce mois est disponible. Montant: 12500 FCFA, echeance le 25.",
        "legitimate",
        "frontiere",
    ),
    (
        "Merci pour votre achat de 45 000 FCFA. Guichetier 214. CONSERVEZ CE RECU.",
        "legitimate",
        "frontiere",
    ),

    # --- ingenierie sociale subtile (le vrai test) ---
    (
        "Cher client, nous avons detecte une activite inhabituelle. Par sécurité, confirmez vos informations dans les 2h sinon acces bloque.",
        "social_engineering",
        "frontiere",
    ),
    (
        "Bonjour, c'est le comptable de l'entreprise. Peux-tu m'envoyer le fichier de facture confidentiel sur WhatsApp? Urgent.",
        "social_engineering",
        "frontiere",
    ),
    (
        "Votre numero a ete selectionne pour un remboursement. Envoyez vos nom, prenom et numero de carte pour verification.",
        "scam_financial",
        "frontiere",
    ),
]


def _fmt_verdict(name: str) -> str:
    return name


def run(out_path: Path | None) -> int:
    settings = Settings(analysis_demo_mode=False)
    if not settings.typesafe_api_key:
        print("TYPESAFE_API_KEY absente: impossible de benchmarker.", file=sys.stderr)
        return 2

    service = JevService(settings=settings)
    rows: list[dict] = []
    latencies: list[float] = []
    confidences: list[float] = []

    print(f"Corpus : {len(CORPUS)} messages\n")
    print(f"{'#':>3}  {'attendu':<18} {'obtenu':<18} {'score':>5} {'conf':>5} {'ms':>6}  msg")
    print("-" * 100)

    for i, (message, expected, difficulty) in enumerate(CORPUS, 1):
        started = time.perf_counter()
        result = service.analyze(message, [])
        elapsed_ms = (time.perf_counter() - started) * 1000
        latencies.append(elapsed_ms)

        if not result.available:
            print(f"{i:>3}  {expected:<18} {'ERREUR ' + str(result.error):<18}")
            rows.append(
                {
                    "index": i,
                    "message": message,
                    "expected": expected,
                    "difficulty": difficulty,
                    "ok": False,
                    "error": result.error,
                    "latency_ms": round(elapsed_ms),
                }
            )
            continue

        got = str(result.raw.get("verdict_name") or "")
        probs = result.raw.get("verdict_probabilities") or {}
        got = max(probs, key=probs.get) if probs else ""
        ok = got == expected
        confidences.append(result.confidence or 0.0)

        if ok:
            mark = "OK "
        else:
            mark = "RATE"
        short = (message[:34] + "...") if len(message) > 37 else message
        print(
            f"{i:>3}  {expected:<18} {got:<18} {result.risk_score:>5} "
            f"{result.confidence:>5.2f} {elapsed_ms:>6.0f}  {mark} {short}"
        )

        rows.append(
            {
                "index": i,
                "message": message,
                "expected": expected,
                "difficulty": difficulty,
                "ok": ok,
                "got": got,
                "risk_score": result.risk_score,
                "confidence": result.confidence,
                "threat_type": str(result.threat_type),
                "severity": str(result.severity),
                "reasons": result.reasons,
                "recommendations": result.recommendations,
                "verdict_probabilities": probs,
                "latency_ms": round(elapsed_ms),
            }
        )

    total = len(rows)
    failures = [r for r in rows if not r["ok"]]
    unavailable = [r for r in rows if r.get("error")]
    scored = total - len(unavailable)

    print("\n" + "=" * 100)
    print(f"Exactitude sur le verdict : {total - len(failures)}/{total}")
    if scored:
        print(f"Exactitude (appels reussis) : {total - len(failures)}/{scored}")
    print(f"Latence mediane : {statistics.median(latencies):.0f} ms")
    print(f"Latence max : {max(latencies):.0f} ms")

    if confidences:
        print("\n--- CONFIANCE (critique pour le routage V2) ---")
        print(f"min={min(confidences):.3f}  max={max(confidences):.3f}  mediane={statistics.median(confidences):.3f}")
        below = [c for c in confidences if c < 0.40]
        print(f"reponses sous 0.40 (declencheraient le routage d'incertitude) : {len(below)}")
        buckets = {}
        for c in confidences:
            key = f"{int(c * 10) / 10:.1f}"
            buckets[key] = buckets.get(key, 0) + 1
        print("distribution :", dict(sorted(buckets.items())))

    if failures:
        print("\n--- ECARTS ---")
        for r in failures:
            got = r.get("got") or r.get("error")
            print(f"  #{r['index']:>2} [{r['difficulty']}] attendu={r['expected']:<18} obtenu={got}")
            print(f"       {r['message'][:90]}")
            print(f"       score={r.get('risk_score')} conf={r.get('confidence')}")

    out_path and out_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False, default=str))
    if out_path:
        print(f"\nDetail ecrit dans {out_path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("/tmp/jev_benchmark.json"))
    args = parser.parse_args()
    return run(args.out)


if __name__ == "__main__":
    raise SystemExit(main())