from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_root():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "SentinelX"
    assert "version" in data
    assert "timestamp" in data


def test_health_check_api_v1():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "SentinelX"


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "SentinelX"
    assert data["health"] == "/health"
