from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "SafeDM"


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "docs" in response.json()
