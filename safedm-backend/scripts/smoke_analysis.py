"""Smoke test Sprint 3 against a running API."""

from __future__ import annotations

import sys
import uuid

import httpx

BASE = "http://127.0.0.1:8000/api/v1"


def main() -> int:
    client = httpx.Client(base_url=BASE, timeout=30.0)
    failures: list[str] = []

    # Health
    r = client.get("/health")
    if r.status_code != 200 or r.json().get("status") != "ok":
        failures.append(f"health failed: {r.status_code} {r.text}")
    else:
        print("OK health")

    username = f"s3_{uuid.uuid4().hex[:8]}"
    password = "SecurePass1"

    # Register
    r = client.post("/auth/register", json={"username": username, "password": password})
    if r.status_code != 201:
        failures.append(f"register failed: {r.status_code} {r.text}")
        print("FAIL", failures[-1])
        return 1
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("OK register/login token")

    # Unauthorized analysis
    r = client.post("/analysis", json={"content": "message assez long pour test"})
    if r.status_code != 401:
        failures.append(f"expected 401 without token, got {r.status_code}")
    else:
        print("OK analysis requires auth")

    # Insufficient content
    r = client.post(
        "/analysis",
        headers=headers,
        json={"content": "hi", "source": "MANUAL"},
    )
    body = r.json()
    if r.status_code != 200 or body.get("status") != "INSUFFICIENT_CONTENT":
        failures.append(f"insufficient content: {r.status_code} {body}")
    elif body.get("content_stored") is not False:
        failures.append("content_stored should be false")
    else:
        print("OK insufficient content")

    # Full analysis without API keys (must not crash; never SAFE by default)
    payload = {
        "content": (
            "URGENT: votre compte sera ferme. "
            "Cliquez https://secure-bank-login.example/reset pour valider."
        ),
        "source": "MANUAL",
        "application_package": "com.whatsapp",
    }
    r = client.post("/analysis", headers=headers, json=payload)
    body = r.json()
    print("analysis_response", r.status_code, body.get("status"), body.get("risk_score"))
    print("providers", body.get("providers"))
    print("urls", body.get("urls"))
    print("reasons", body.get("reasons"))

    if r.status_code != 200:
        failures.append(f"analysis HTTP {r.status_code}: {body}")
    else:
        required = [
            "status",
            "risk_score",
            "severity",
            "threat_type",
            "reasons",
            "recommendations",
            "urls",
            "community",
            "providers",
            "raw_hash",
            "normalized_hash",
            "content_stored",
        ]
        missing = [k for k in required if k not in body]
        if missing:
            failures.append(f"missing fields: {missing}")
        if body.get("content_stored") is not False:
            failures.append("content must not be stored")
        if not body.get("urls"):
            failures.append("expected extracted URL in response")
        else:
            print("OK url extracted", body["urls"][0].get("url"), body["urls"][0].get("available"))
        if len(body.get("raw_hash", "")) != 64:
            failures.append("raw_hash invalid")

        providers = body.get("providers") or {}
        gemini_ok = providers.get("gemini", {}).get("available")
        if gemini_ok:
            # Mode demo ou cles reelles : un message phishing+lien doit etre dangereux
            if body.get("status") != "DANGEROUS":
                failures.append(f"expected DANGEROUS for phishing demo, got {body.get('status')}")
            if body.get("risk_score", 0) < 65:
                failures.append(f"expected high risk score, got {body.get('risk_score')}")
            if not body.get("urls") or body["urls"][0].get("available") is not True:
                failures.append("expected VT available in demo/real mode")
            print("OK phishing classified as DANGEROUS")
        else:
            if body.get("status") == "SAFE":
                failures.append("without API keys, SAFE is forbidden by default")
            if body.get("status") not in ("PARTIAL", "UNKNOWN", "SUSPICIOUS", "DANGEROUS"):
                failures.append(f"unexpected status without keys: {body.get('status')}")
            print("OK analysis structured response (providers unavailable)")

    # Plain text without URL
    r = client.post(
        "/analysis",
        headers=headers,
        json={
            "content": "Bonjour, pouvez-vous me rappeler demain apres-midi s'il vous plait ?",
            "source": "MANUAL",
        },
    )
    body = r.json()
    print("plain_status", body.get("status"), "stored", body.get("content_stored"))
    if r.status_code != 200:
        failures.append(f"plain analysis failed: {r.status_code}")
    else:
        gemini_ok = body.get("providers", {}).get("gemini", {}).get("available")
        if not gemini_ok and body.get("status") == "SAFE":
            failures.append("plain text became SAFE while Gemini unavailable")
        elif gemini_ok and body.get("status") not in ("SAFE", "SUSPICIOUS", "PARTIAL"):
            # message benign en demo peut etre SAFE
            failures.append(f"unexpected plain status: {body.get('status')}")
        print("OK plain analysis")

    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(" -", f)
        return 1

    print("\nALL SMOKE CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
