"""Tests Sprint 4 — reports, threats, guide, admin."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models import User
from app.utils.hashing import compute_normalized_hash

client = TestClient(app)


def _username() -> str:
    return f"s4_{uuid.uuid4().hex[:10]}"


@pytest.fixture
def user_auth():
    username = _username()
    password = "SecurePass1"
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert response.status_code == 201, response.text
    return {
        "username": username,
        "password": password,
        "headers": {"Authorization": f"Bearer {response.json()['access_token']}"},
        "user_id": response.json()["user"]["id"],
    }


@pytest.fixture
def second_user_auth():
    username = _username()
    password = "SecurePass1"
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert response.status_code == 201
    return {"headers": {"Authorization": f"Bearer {response.json()['access_token']}"}}


@pytest.fixture
def admin_auth():
    username = f"admin_{uuid.uuid4().hex[:8]}"
    password = "SecurePass1"
    db = SessionLocal()
    try:
        user = User(
            username=username,
            password_hash=hash_password(password),
            is_admin=True,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()

    login = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert login.status_code == 200
    return {"headers": {"Authorization": f"Bearer {login.json()['access_token']}"}}


def test_report_create_stores_content_and_lists_community(user_auth):
    content = (
        f"URGENT phishing unique {uuid.uuid4().hex} "
        "validez votre compte https://secure-bank-login.example/reset"
    )
    response = client.post(
        "/api/v1/reports",
        headers=user_auth["headers"],
        json={"content": content, "source": "DIRECT_REPORT", "severity": "HIGH"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["content_stored"] is True
    assert body["created_threat"] is True
    assert body["report"]["status"] == "ACTIVE"
    threat_id = body["threat_id"]

    community = client.get("/api/v1/threats/community", headers=user_auth["headers"])
    assert community.status_code == 200
    items = community.json()["items"]
    assert any(item["id"] == threat_id for item in items)
    threat = next(item for item in items if item["id"] == threat_id)
    assert threat["content"] == content
    assert threat["report_count"] == 1
    assert len(threat["urls"]) >= 1

    by_hash = client.get(
        f"/api/v1/threats/{threat['normalized_hash']}",
        headers=user_auth["headers"],
    )
    assert by_hash.status_code == 200
    assert by_hash.json()["id"] == threat_id


def test_duplicate_report_conflict(user_auth):
    content = f"Duplicate report content {uuid.uuid4().hex} https://evil.example/a"
    first = client.post(
        "/api/v1/reports",
        headers=user_auth["headers"],
        json={"content": content, "source": "MANUAL_ANALYSIS"},
    )
    assert first.status_code == 201
    second = client.post(
        "/api/v1/reports",
        headers=user_auth["headers"],
        json={"content": content, "source": "MANUAL_ANALYSIS"},
    )
    assert second.status_code == 409


def test_withdraw_and_reactivate(user_auth):
    content = f"Withdrawable threat {uuid.uuid4().hex}"
    created = client.post(
        "/api/v1/reports",
        headers=user_auth["headers"],
        json={"content": content, "source": "NOTIFICATION"},
    )
    assert created.status_code == 201
    report_id = created.json()["report"]["id"]
    threat_id = created.json()["threat_id"]

    withdrawn = client.delete(
        f"/api/v1/reports/{report_id}",
        headers=user_auth["headers"],
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "WITHDRAWN"

    community = client.get("/api/v1/threats/community", headers=user_auth["headers"])
    threat = next(i for i in community.json()["items"] if i["id"] == threat_id)
    assert threat["report_count"] == 0

    reactivated = client.post(
        "/api/v1/reports",
        headers=user_auth["headers"],
        json={"content": content, "source": "DIRECT_REPORT"},
    )
    assert reactivated.status_code == 201
    assert reactivated.json()["created_threat"] is False
    assert reactivated.json()["report"]["status"] == "ACTIVE"


def test_second_user_increments_report_count(user_auth, second_user_auth):
    content = f"Shared community threat {uuid.uuid4().hex}"
    first = client.post(
        "/api/v1/reports",
        headers=user_auth["headers"],
        json={"content": content, "source": "DIRECT_REPORT"},
    )
    assert first.status_code == 201
    second = client.post(
        "/api/v1/reports",
        headers=second_user_auth["headers"],
        json={"content": content, "source": "DIRECT_REPORT"},
    )
    assert second.status_code == 201
    assert second.json()["created_threat"] is False

    community = client.get("/api/v1/threats/community", headers=user_auth["headers"])
    threat = next(i for i in community.json()["items"] if i["id"] == first.json()["threat_id"])
    assert threat["report_count"] == 2


def test_guide_public_endpoints():
    categories = client.get("/api/v1/guide/categories")
    assert categories.status_code == 200
    cats = categories.json()
    assert len(cats) >= 1
    assert all("articles" in c for c in cats)

    # find a published article id
    article_id = None
    for cat in cats:
        if cat["articles"]:
            article_id = cat["articles"][0]["id"]
            break
    assert article_id is not None
    article = client.get(f"/api/v1/guide/articles/{article_id}")
    assert article.status_code == 200
    assert article.json()["is_published"] is True


def test_admin_stats_and_threat_moderation(user_auth, admin_auth):
    content = f"Admin dismiss threat {uuid.uuid4().hex}"
    reported = client.post(
        "/api/v1/reports",
        headers=user_auth["headers"],
        json={"content": content, "source": "DIRECT_REPORT", "severity": "MEDIUM"},
    )
    assert reported.status_code == 201
    threat_id = reported.json()["threat_id"]

    forbidden = client.get("/api/v1/admin/stats", headers=user_auth["headers"])
    assert forbidden.status_code == 403

    stats = client.get("/api/v1/admin/stats", headers=admin_auth["headers"])
    assert stats.status_code == 200
    body = stats.json()
    assert body["users_count"] >= 1
    assert body["threats_active_count"] >= 1
    assert "gemini_configured" in body

    dismissed = client.put(
        f"/api/v1/admin/threats/{threat_id}/status",
        headers=admin_auth["headers"],
        json={"status": "DISMISSED"},
    )
    assert dismissed.status_code == 200
    assert dismissed.json()["status"] == "DISMISSED"

    community = client.get("/api/v1/threats/community", headers=user_auth["headers"])
    assert all(item["id"] != threat_id for item in community.json()["items"])


def test_admin_guide_crud(admin_auth):
    cats = client.get("/api/v1/guide/categories").json()
    category_id = cats[0]["id"]

    created = client.post(
        "/api/v1/admin/guide/articles",
        headers=admin_auth["headers"],
        json={
            "category_id": category_id,
            "title": f"Article test {uuid.uuid4().hex[:6]}",
            "content": "Contenu pédagogique de test.",
            "display_order": 99,
            "is_published": True,
        },
    )
    assert created.status_code == 201, created.text
    article_id = created.json()["id"]

    updated = client.put(
        f"/api/v1/admin/guide/articles/{article_id}",
        headers=admin_auth["headers"],
        json={"title": "Article mis a jour", "is_published": True},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Article mis a jour"

    public = client.get(f"/api/v1/guide/articles/{article_id}")
    assert public.status_code == 200

    deleted = client.delete(
        f"/api/v1/admin/guide/articles/{article_id}",
        headers=admin_auth["headers"],
    )
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/guide/articles/{article_id}").status_code == 404

    new_cat = client.post(
        "/api/v1/admin/guide/categories",
        headers=admin_auth["headers"],
        json={
            "title": f"Cat test {uuid.uuid4().hex[:6]}",
            "description": "temporaire",
            "display_order": 99,
        },
    )
    assert new_cat.status_code == 201, new_cat.text
    new_cat_id = new_cat.json()["id"]
    renamed = client.put(
        f"/api/v1/admin/guide/categories/{new_cat_id}",
        headers=admin_auth["headers"],
        json={"title": "Cat renommee"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Cat renommee"
    removed = client.delete(
        f"/api/v1/admin/guide/categories/{new_cat_id}",
        headers=admin_auth["headers"],
    )
    assert removed.status_code == 204


def test_analysis_picks_up_community_report(user_auth, monkeypatch):
    content = (
        f"Community boost message {uuid.uuid4().hex} "
        "urgent validez https://bank-secure-login.example/x"
    )
    report = client.post(
        "/api/v1/reports",
        headers=user_auth["headers"],
        json={"content": content, "source": "DIRECT_REPORT", "severity": "HIGH"},
    )
    assert report.status_code == 201

    # Ensure demo/analysis works and community matched
    analysis = client.post(
        "/api/v1/analysis",
        headers=user_auth["headers"],
        json={"content": content, "source": "MANUAL"},
    )
    assert analysis.status_code == 200
    body = analysis.json()
    assert body["community"]["matched"] is True
    assert body["content_stored"] is False
    assert compute_normalized_hash(content) == body["normalized_hash"]
