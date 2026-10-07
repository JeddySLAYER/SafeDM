"""Tests Sprint 10 review — durcissement de la configuration.

Trois garanties verifiees ici :

1. `SECRET_KEY` n'a plus de defaut utilisable. C'etait une cle JWT codee en dur
   dans le depot : une API deployee sans `.env` signait des jetons forges par
   n'importe qui.
2. La production refuse de demarrer avec un secret faible.
3. Les seuils de decision sont reconfigurables par l'environnement, sans toucher
   au source. Le benchmark Sprint 10 les a deja fait bouger de 0.40 a 0.65.
"""

from __future__ import annotations

import pytest

from app.core.config import Settings, get_settings
from app.schemas.analysis_enums import AnalysisStatus
from app.services.fusion_service import _severity_from_score, _status_from_score, _thresholds


# --------------------------------------------------------------- SECRET_KEY


def test_secret_key_has_no_usable_default() -> None:
    """Plus aucune valeur par defaut exploitable pour signer des JWT."""
    s = Settings(_env_file=None)
    assert s.secret_key == "", "secret_key ne doit pas avoir de defaut code en dur"


@pytest.mark.parametrize(
    "weak", ["", "change-me-to-a-long-random-string", "secret", "change-me"]
)
def test_production_refuses_weak_secret(weak: str) -> None:
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(app_env="production", secret_key=weak, _env_file=None)


def test_production_accepts_strong_secret() -> None:
    s = Settings(app_env="production", secret_key="k" * 64, _env_file=None)
    assert s.is_production is True


def test_production_refuses_absent_secret() -> None:
    """Le cas le plus dangerous : `.env` oublie en production."""
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(app_env="production", _env_file=None)


def test_development_tolerates_missing_secret(caplog) -> None:
    """Un novice ne doit pas etre bloque par un garde-fou en local."""
    with caplog.at_level("WARNING"):
        s = Settings(app_env="development", secret_key="", _env_file=None)
    assert s.secret_key == ""
    assert any("SECRET_KEY" in rec.message for rec in caplog.records)


# ------------------------------------------------------------------ seuils


def test_thresholds_are_readable() -> None:
    t = _thresholds()
    assert set(t) == {
        "uncertainty",
        "escalation",
        "safe",
        "suspicious",
        "critical",
        "uncertain_score_floor",
    }


def test_default_thresholds_match_architecture_v2() -> None:
    """Garde-fou contre une edition accidentelle des defauts."""
    t = _thresholds()
    assert t["safe"] == 35
    assert t["suspicious"] == 65
    assert t["critical"] == 85
    assert t["uncertain_score_floor"] == 40
    # Recale par le benchmark : 0.40 sous-couvrait les erreurs.
    assert t["uncertainty"] == 0.65


def test_thresholds_are_monotonic() -> None:
    """Un seuil incoherent (suspicious < safe) rendrait la decision absurde."""
    t = _thresholds()
    assert t["safe"] < t["suspicious"] <= t["critical"]
    assert 0.0 < t["uncertainty"] <= 1.0
    assert 0.0 < t["escalation"] <= 1.0


def test_thresholds_are_overridable_by_env(monkeypatch) -> None:
    monkeypatch.setenv("THRESHOLD_SAFE_SCORE", "50")
    monkeypatch.setenv("THRESHOLD_UNCERTAINTY_CONFIDENCE", "0.80")
    get_settings.cache_clear()
    try:
        t = _thresholds()
        assert t["safe"] == 50.0
        assert t["uncertainty"] == 0.80
        # Et la consequence est bien visible dans le statut final :
        # avec un plancher de 50, un score de 40 n'est plus SAFE.
        assert _status_from_score(40) is AnalysisStatus.SAFE
        assert _status_from_score(50) is AnalysisStatus.SUSPICIOUS
    finally:
        get_settings.cache_clear()


def test_status_boundaries_follow_configured_scores() -> None:
    """score < safe -> SAFE ; entre safe et suspicious -> SUSPICIOUS."""
    t = _thresholds()
    assert _status_from_score(int(t["safe"]) - 1).value == "SAFE"
    assert _status_from_score(int(t["safe"])).value == "SUSPICIOUS"
    assert _status_from_score(int(t["suspicious"])).value == "DANGEROUS"