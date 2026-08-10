"""Tests Sprint 2 — auth, profil, monitoring."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _unique_username() -> str:
    return f"user_{uuid.uuid4().hex[:10]}"


@pytest.fixture
def registered_user():
    username = _unique_username()
    password = "SecurePass1"
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return {
        "username": username,
        "password": password,
        "token": data["access_token"],
        "user": data["user"],
    }


def test_register_and_login():
    username = _unique_username()
    password = "SecurePass1"

    register = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert register.status_code == 201
    body = register.json()
    assert "access_token" in body
    assert body["user"]["username"] == username
    assert body["user"]["is_admin"] is False

    login = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert login.status_code == 200
    assert "access_token" in login.json()


def test_register_duplicate_username(registered_user):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": registered_user["username"],
            "password": "AnotherPass1",
        },
    )
    assert response.status_code == 409


def test_login_wrong_password(registered_user):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": registered_user["username"],
            "password": "WrongPassword1",
        },
    )
    assert response.status_code == 401


def test_get_me(registered_user):
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {registered_user['token']}"},
    )
    assert response.status_code == 200
    assert response.json()["username"] == registered_user["username"]


def test_get_me_unauthorized():
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_update_password(registered_user):
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    response = client.put(
        "/api/v1/users/me",
        headers=headers,
        json={"password": "NewSecurePass2"},
    )
    assert response.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login",
        json={
            "username": registered_user["username"],
            "password": registered_user["password"],
        },
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={
            "username": registered_user["username"],
            "password": "NewSecurePass2",
        },
    )
    assert new_login.status_code == 200


def test_list_applications():
    response = client.get("/api/v1/applications")
    assert response.status_code == 200
    apps = response.json()
    assert len(apps) >= 3
    names = {app["name"] for app in apps}
    assert {"WhatsApp", "SMS", "Email"}.issubset(names)


def test_monitoring_defaults_and_update(registered_user):
    headers = {"Authorization": f"Bearer {registered_user['token']}"}

    get_prefs = client.get("/api/v1/users/me/monitoring", headers=headers)
    assert get_prefs.status_code == 200
    prefs = get_prefs.json()
    assert len(prefs) >= 3
    assert all(item["enabled"] is True for item in prefs)

    first_id = prefs[0]["application_id"]
    update = client.put(
        "/api/v1/users/me/monitoring",
        headers=headers,
        json={
            "preferences": [
                {"application_id": first_id, "enabled": False},
            ]
        },
    )
    assert update.status_code == 200
    updated = {item["application_id"]: item["enabled"] for item in update.json()}
    assert updated[first_id] is False


def test_register_device(registered_user):
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    response = client.post(
        "/api/v1/users/me/devices",
        headers=headers,
        json={"device_identifier": "android-test-device-001"},
    )
    assert response.status_code == 201
    assert response.json()["device_identifier"] == "android-test-device-001"

    listed = client.get("/api/v1/users/me/devices", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) >= 1
