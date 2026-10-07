"""Deterministic weekly model-policy patch generation.

The MVP does not persist feature vectors, so this job deliberately aggregates
only anonymous report metadata. It produces a versioned policy manifest rather
than pretending that weights can be retrained from data that is not stored.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import CommunityReport, Threat
from app.models.enums import ReportStatus, ThreatStatus
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
import base64


def _version_for(period_end: datetime) -> str:
    return f"policy-{period_end.strftime('%Y%m%dT%H%M%SZ')}"


def _canonical(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def build_weekly_patch(
    db: Session,
    *,
    period_end: datetime | None = None,
    output_dir: str | Path = "artifacts/weekly",
) -> dict:
    end = period_end or datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    reports = list(
        db.scalars(
            select(CommunityReport).where(
                CommunityReport.created_at >= start,
                CommunityReport.created_at < end,
                CommunityReport.status == ReportStatus.ACTIVE,
            )
        ).all()
    )
    threat_ids = {report.threat_id for report in reports}
    threats = list(
        db.scalars(
            select(Threat).where(
                Threat.id.in_(threat_ids) if threat_ids else False,
                Threat.status == ThreatStatus.ACTIVE,
            )
        ).all()
    )
    severity_counts = {}
    for threat in threats:
        key = threat.severity.value
        severity_counts[key] = severity_counts.get(key, 0) + 1

    version = _version_for(end)
    manifest = {
        "schema_version": 1,
        "version": version,
        "model_url": get_settings().model_patch_url or None,
        "artifact_sha256": get_settings().model_patch_artifact_sha256 or None,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "source": {
            "active_reports": len(reports),
            "affected_signatures": len(threats),
            "severity_counts": severity_counts,
        },
        "policy": {
            "safe_score": get_settings().threshold_safe_score,
            "suspicious_score": get_settings().threshold_suspicious_score,
            "critical_score": get_settings().threshold_critical_score,
            "escalation_confidence": get_settings().threshold_escalation_confidence,
        },
        "metrics": {
            "recall": None,
            "false_positive_rate": None,
            "status": "unlabeled_data",
        },
        "rollout": {"stage": "canary", "percentage": 1},
    }
    body = _canonical(manifest)
    manifest["manifest_sha256"] = hashlib.sha256(body).hexdigest()
    signing_key = get_settings().model_patch_signing_key_pem_b64
    if signing_key:
        private_key = serialization.load_pem_private_key(
            base64.b64decode(signing_key, validate=True), password=None
        )
        manifest["signature"] = base64.b64encode(
            private_key.sign(
                _canonical(manifest),
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
        ).decode()
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    (destination / f"{version}.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (destination / "latest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return manifest
