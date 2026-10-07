"""Smoke d'intégration API SafeDM (auth → analyse → reports → guide → admin).

Usage:
  uvicorn app.main:app --port 8000
  python scripts/smoke_integration.py
"""

from __future__ import annotations

import os
import sys
import uuid

import httpx

BASE = os.environ.get("SMOKE_BASE", "http://127.0.0.1:8000/api/v1")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}".encode("ascii", errors="replace").decode("ascii"))
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"OK   {msg}")


def main() -> None:
    user = f"smoke_{uuid.uuid4().hex[:8]}"
    password = "SmokeTest1!"

    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        health = client.get("/health")
        if health.status_code != 200:
            fail(f"health status={health.status_code}")
        ok("GET /health")

        reg = client.post("/auth/register", json={"username": user, "password": password})
        if reg.status_code != 201:
            fail(f"register status={reg.status_code} body={reg.text}")
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        ok("POST /auth/register")

        login = client.post("/auth/login", json={"username": user, "password": password})
        if login.status_code != 200:
            fail(f"login status={login.status_code}")
        ok("POST /auth/login")

        me = client.get("/users/me", headers=headers)
        if me.status_code != 200:
            fail(f"me status={me.status_code}")
        ok("GET /users/me")

        apps = client.get("/applications")
        if apps.status_code != 200 or len(apps.json()) < 1:
            fail("applications")
        ok("GET /applications")

        content = (
            f"URGENT smoke {uuid.uuid4().hex} "
            "validez https://bank-secure-login.example/x"
        )
        analysis = client.post(
            "/analysis",
            headers=headers,
            json={"content": content, "source": "MANUAL"},
        )
        if analysis.status_code != 200:
            fail(f"analysis status={analysis.status_code} body={analysis.text}")
        body = analysis.json()
        if body.get("content_stored") is not False:
            fail("analysis must not store content")
        ok(f"POST /analysis status={body.get('status')} score={body.get('risk_score')}")

        report = client.post(
            "/reports",
            headers=headers,
            json={
                "content": content,
                "source": "MANUAL_ANALYSIS",
                "severity": "HIGH",
            },
        )
        if report.status_code != 201:
            fail(f"report status={report.status_code} body={report.text}")
        report_id = report.json()["report"]["id"]
        ok("POST /reports")

        listed = client.get("/reports", headers=headers)
        if listed.status_code != 200 or listed.json()["total"] < 1:
            fail("list reports")
        ok("GET /reports")

        community = client.get("/threats/community", headers=headers)
        if community.status_code != 200:
            fail("community")
        ok("GET /threats/community")

        guide = client.get("/guide/categories")
        if guide.status_code != 200:
            fail("guide")
        ok("GET /guide/categories")

        withdrawn = client.delete(f"/reports/{report_id}", headers=headers)
        if withdrawn.status_code != 200:
            fail(f"withdraw status={withdrawn.status_code}")
        ok("DELETE /reports/{id}")

        admin_stats = client.get("/admin/stats", headers=headers)
        if admin_stats.status_code == 403:
            ok("GET /admin/stats correctly forbidden for non-admin")
        elif admin_stats.status_code == 200:
            ok("GET /admin/stats (user is admin)")
        else:
            fail(f"admin stats unexpected {admin_stats.status_code}")

    print("\nIntegration smoke PASSED")


if __name__ == "__main__":
    main()
