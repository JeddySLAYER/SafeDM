import pytest
from pydantic import ValidationError

from app.schemas.analysis import FeatureVectorAnalysisRequest


def test_feature_vector_request_requires_explicit_envelope_fields():
    payload = FeatureVectorAnalysisRequest(
        encrypted_key="k" * 32,
        nonce="n" * 16,
        ciphertext="c" * 16,
    )
    assert payload.consent_external is True


def test_feature_vector_request_rejects_missing_ciphertext():
    with pytest.raises(ValidationError):
        FeatureVectorAnalysisRequest(
            encrypted_key="k" * 32,
            nonce="n" * 16,
        )
