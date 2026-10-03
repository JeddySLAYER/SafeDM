"""Non-regression Jev : compare l'API reelle a la baseline figee.

Ces testsappelent l'API consomment des credits, donc ils sont ignores par defaut :

    .venv/bin/python -m pytest tests/test_jev_benchmark.py -q -m jev_benchmark

`baseline.json` contient le resultat mesure le 2026-10-02 sur 28 SMS
francais/togolais. Il verrouille le comportement des questions Noul, qui est
la partie la plus fragile : une reformulation naive reintroduit le biais sur
les SMS OTP authentiques (voir scripts/ab_jev_questions.py).

Seuils volontairement permissifs : on teste une tendance, pas une egalite
stricte, car le modele derriere l'API peut evoluer.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.benchmark_jev import CORPUS

pytestmark = pytest.mark.jev_benchmark

MALICIOUS = {"phishing", "scam_financial", "social_engineering"}
BASELINE = json.loads(
    (Path(__file__).parent / "fixtures" / "jev_benchmark_baseline.json").read_text()
)
# Tolerance sur l'exactitude du verdict. La baseline est a 16/28.
MIN_EXACT = 15
# Les faux positifs sont le vrai risque produit : un SMS OTP bancaire legitime
# signale comme phishing ferait deserter l'utilisateur en une semaine.
MAX_FALSE_POSITIVES = 1
MIN_SEPARATION_MARGIN = 25


@pytest.fixture(scope="module")
def live_rows() -> list[dict]:
    from app.core.config import Settings

    if not Settings().typesafe_api_key:
        pytest.skip("TYPESAFE_API_KEY absente : benchmark live impossible")

    from app.services.jev_service import JevService

    service = JevService(settings=Settings(analysis_demo_mode=False))
    client = service._get_client()
    rows = []
    for i, (message, expected, difficulty) in enumerate(CORPUS, 1):
        resp = client.system_one(
            state={"message": message, "urls": []},
            questions=__import__(
                "app.services.jev_service", fromlist=["_SEMANTIC_QUESTIONS"]
            )._SEMANTIC_QUESTIONS,
            model=service.settings.typesafe_model,
        )
        verdict = resp.answers["verdict"]
        probs = dict(verdict.probabilities or {})
        rows.append(
            {
                "index": i,
                "expected": expected,
                "difficulty": difficulty,
                "got": max(probs, key=probs.get) if probs else "",
                "malicious_probability": sum(float(probs.get(n, 0.0)) for n in MALICIOUS),
                "credential_noul": float(
                    getattr(resp.answers.get("credential_request"), "noul", 0.0) or 0.0
                ),
            }
        )
    return rows


def test_no_threat_is_missed(live_rows: list[dict]) -> None:
    """Recall 100% attendu : manquer une menace est le seul echec tolerable ici."""
    missed = [
        r["index"] for r in live_rows if r["expected"] in MALICIOUS and r["got"] not in MALICIOUS
    ]
    assert not missed, f"Messages malveillants classes benins : {missed}"


def test_false_positive_budget_is_respected(live_rows: list[dict]) -> None:
    false_positives = [
        r["index"] for r in live_rows if r["got"] in MALICIOUS and r["expected"] not in MALICIOUS
    ]
    assert len(false_positives) <= MAX_FALSE_POSITIVES, (
        f"Faux positifs au-dela du budget ({MAX_FALSE_POSITIVES}) : {false_positives}. "
        "Un SMS bancaire legitime signale comme phishing casse la confiance."
    )


def test_exact_accuracy_does_not_regress(live_rows: list[dict]) -> None:
    exact = sum(1 for r in live_rows if r["got"] == r["expected"])
    assert exact >= MIN_EXACT, f"Exactitude {exact}/{len(live_rows)} < {MIN_EXACT}"


def test_score_separation_is_preserved(live_rows: list[dict]) -> None:
    """Les scores malveillants doivent rester nettement au-dessus des benigns.

    C'est ce qui permet au modele local (Sprint 12) d'apprendre une frontiere
    propre, et a l'utilisateur de verifier manuellement la zone grise.
    """
    mal = [r["malicious_probability"] * 100 for r in live_rows if r["expected"] in MALICIOUS]
    benign = [r["malicious_probability"] * 100 for r in live_rows if r["expected"] not in MALICIOUS]
    margin = min(mal) - max(benign)
    assert margin >= MIN_SEPARATION_MARGIN, (
        f"Marge de separation {margin:.0f} points < {MIN_SEPARATION_MARGIN} "
        f"(benins max={max(benign):.0f}, malveillants min={min(mal):.0f})"
    )


def test_authentic_otp_sms_are_not_phishing(live_rows: list[dict]) -> None:
    """Le biais le plus coûteux : confondre delivering un OTP et le demander."""
    otp = [
        r
        for r in live_rows
        if "otp" in CORPUS[r["index"] - 1][0].lower()
        or "code de confirmation" in CORPUS[r["index"] - 1][0].lower()
    ]
    assert otp, "Le corpus doit contenir des SMS OTP authentiques"
    flagged = [r["index"] for r in otp if r["got"] in MALICIOUS]
    assert not flagged, f"SMS OTP authentiques classes comme menace : {flagged}"


def test_baseline_fixture_is_in_sync_with_corpus() -> None:
    """Detecte un corpus modifie sans re-générer la baseline."""
    assert len(BASELINE) == len(CORPUS), (
        f"Le corpus compte {len(CORPUS)} messages mais la baseline {len(BASELINE)}. "
        "Re-lancer scripts/benchmark_jev.py puis rafraichir la fixture."
    )
    for row, (message, expected, _) in zip(BASELINE, CORPUS):
        assert row["message"] == message
        assert row["expected"] == expected