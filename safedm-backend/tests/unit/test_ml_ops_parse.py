"""Dataset ingest parsing for admin ML ops."""

import pytest
from fastapi import HTTPException
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models.enums import ReportStatus
from app.services.ml_ops_service import MlOpsService, _label_counts, _parse_cases


def test_parse_json_list():
    cases = _parse_cases(
        [
            {"message": "Hello bank http://x", "expected": "phishing"},
            {"message": "Votre code OTP 12", "expected": "legitimate"},
        ]
    )
    assert len(cases) == 2
    benign, mal = _label_counts(cases)
    assert benign == 1 and mal == 1


def test_parse_csv():
    raw = "message,expected\nHi,legitimate\nClick http://evil,phishing\n"
    cases = _parse_cases(raw)
    assert len(cases) == 2
    assert cases[1]["expected"] == "phishing"


def test_parse_rejects_empty():
    with pytest.raises(HTTPException):
        _parse_cases([])


def test_report_dataset_uses_only_active_stored_content(monkeypatch):
    db = MagicMock()
    report = SimpleNamespace(id=7, status=ReportStatus.ACTIVE)
    db.execute.return_value.all.return_value = [(report, "  Message de fraude  ")]
    service = MlOpsService(db)
    monkeypatch.setattr(service, "create_dataset", lambda **kwargs: kwargs)

    result = service.create_dataset_from_reports(
        name="reports-reviewed",
        items=[{"report_id": 7, "expected": "malicious"}],
        admin=MagicMock(),
    )

    assert result["content"] == [{
        "message": "Message de fraude",
        "expected": "malicious",
        "source_report_ids": [7],
    }]
    assert result["source"] == "reviewed_reports"


def test_report_dataset_rejects_fingerprint_only_report():
    db = MagicMock()
    report = SimpleNamespace(id=8, status=ReportStatus.ACTIVE)
    db.execute.return_value.all.return_value = [(report, None)]
    service = MlOpsService(db)

    with pytest.raises(HTTPException) as exc:
        service.create_dataset_from_reports(
            name="reports-reviewed",
            items=[{"report_id": 8, "expected": "legitimate"}],
            admin=MagicMock(),
        )

    assert exc.value.status_code == 422
