"""Dataset ingest parsing for admin ML ops."""

import pytest
from fastapi import HTTPException

from app.services.ml_ops_service import _label_counts, _parse_cases


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
