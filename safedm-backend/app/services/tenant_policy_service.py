"""Résolution des politiques de seuils par entreprise (tenant)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin_operations import TenantPolicy
from app.services.fusion_service import default_thresholds


def resolve_analysis_thresholds(
    db: Session,
    *,
    tenant_key: str | None = None,
    region: str | None = None,
) -> tuple[dict[str, float], dict]:
    """Retourne (seuils pour fuse_analysis, meta providers.policy).

    Sans `tenant_key`, ou si aucune politique n'existe : seuils globaux (env).
    """
    base = default_thresholds()
    meta = {
        "source": "global",
        "tenant_key": None,
        "region": None,
        "safe": int(base["safe"]),
        "suspicious": int(base["suspicious"]),
        "critical": int(base["critical"]),
        "escalation": float(base["escalation"]),
        "uncertainty": float(base["uncertainty"]),
    }

    key = (tenant_key or "").strip()
    if not key:
        return base, meta

    policy = db.scalar(select(TenantPolicy).where(TenantPolicy.tenant_key == key))
    if not isinstance(policy, TenantPolicy):
        meta["source"] = "global_fallback" if key else "global"
        meta["tenant_key"] = key
        meta["region"] = (region or "").strip() or None
        return base, meta

    requested_region = (region or "").strip() or None
    region_match = (
        requested_region is None
        or requested_region.lower() == (policy.region or "").lower()
    )
    if not region_match:
        meta.update(
            source="global_fallback",
            tenant_key=key,
            region=requested_region,
            policy_region=policy.region,
            region_match=False,
        )
        return base, meta
    thresholds = {
        **base,
        "safe": policy.safe_score,
        "suspicious": policy.suspicious_score,
        "critical": policy.critical_score,
        # Même levier produit : confiance minimale d'affirmation SAFE.
        "escalation": policy.escalation_confidence,
        "uncertainty": policy.escalation_confidence,
    }
    meta = {
        "source": "tenant",
        "tenant_key": policy.tenant_key,
        "region": policy.region,
        "requested_region": requested_region,
        "region_match": region_match,
        "safe": policy.safe_score,
        "suspicious": policy.suspicious_score,
        "critical": policy.critical_score,
        "escalation": policy.escalation_confidence,
        "uncertainty": policy.escalation_confidence,
    }
    return thresholds, meta
