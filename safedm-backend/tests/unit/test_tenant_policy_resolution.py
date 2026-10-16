"""Résolution des politiques tenant pour /analysis."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models.admin_operations import TenantPolicy
from app.services.tenant_policy_service import resolve_analysis_thresholds


def test_resolve_without_tenant_uses_global():
    db = MagicMock()
    thresholds, meta = resolve_analysis_thresholds(db, tenant_key=None)
    assert meta["source"] == "global"
    assert thresholds["safe"] == 35
    assert thresholds["suspicious"] == 65
    db.scalar.assert_not_called()


def test_resolve_unknown_tenant_falls_back():
    db = MagicMock()
    db.scalar.return_value = None
    thresholds, meta = resolve_analysis_thresholds(db, tenant_key="acme", region="eu")
    assert meta["source"] == "global_fallback"
    assert meta["tenant_key"] == "acme"
    assert thresholds["suspicious"] == 65


def test_resolve_known_tenant_overrides():
    db = MagicMock()
    policy = TenantPolicy(
        tenant_key="acme",
        region="eu-west",
        safe_score=25,
        suspicious_score=50,
        critical_score=80,
        escalation_confidence=0.8,
        updated_by=1,
    )
    db.scalar.return_value = policy
    thresholds, meta = resolve_analysis_thresholds(
        db, tenant_key="acme", region="eu-west"
    )
    assert meta["source"] == "tenant"
    assert thresholds["safe"] == 25
    assert thresholds["suspicious"] == 50
    assert thresholds["critical"] == 80
    assert thresholds["escalation"] == 0.8
    assert thresholds["uncertainty"] == 0.8
    assert meta["region_match"] is True


def test_resolve_ignores_non_policy_mock():
    db = MagicMock()
    db.scalar.return_value = SimpleNamespace(safe_score=1)
    thresholds, meta = resolve_analysis_thresholds(db, tenant_key="x")
    assert meta["source"] == "global_fallback"
    assert thresholds["safe"] == 35


def test_region_mismatch_falls_back_to_global_thresholds():
    db = MagicMock()
    db.scalar.return_value = TenantPolicy(
        tenant_key="acme",
        region="eu-west",
        safe_score=25,
        suspicious_score=50,
        critical_score=80,
        escalation_confidence=0.8,
        updated_by=1,
    )
    thresholds, meta = resolve_analysis_thresholds(db, tenant_key="acme", region="us")
    assert meta["source"] == "global_fallback"
    assert meta["region_match"] is False
    assert thresholds["safe"] == 35
    assert thresholds["suspicious"] == 65
