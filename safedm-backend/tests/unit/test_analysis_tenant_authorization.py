from types import SimpleNamespace

from app.api.v1.analysis import authorized_analysis_payload
from app.schemas.analysis import AnalysisRequest, FeatureVectorAnalysisRequest, UrlGateRequest


def test_regular_user_cannot_choose_tenant_policy():
    user = SimpleNamespace(is_admin=False)
    payloads = [
        AnalysisRequest(content="hello", tenant_key="acme", region="eu-west"),
        FeatureVectorAnalysisRequest(
            encrypted_key="k" * 32,
            nonce="n" * 16,
            ciphertext="c" * 16,
            tenant_key="acme",
            region="eu-west",
        ),
        UrlGateRequest(url="https://example.com", tenant_key="acme", region="eu-west"),
    ]

    for payload in payloads:
        authorized = authorized_analysis_payload(user, payload)
        assert authorized.tenant_key is None
        assert authorized.region is None
        assert payload.tenant_key == "acme"  # input model remains untouched


def test_admin_can_choose_tenant_policy():
    user = SimpleNamespace(is_admin=True)
    payload = AnalysisRequest(content="hello", tenant_key="acme", region="eu-west")

    assert authorized_analysis_payload(user, payload) is payload
