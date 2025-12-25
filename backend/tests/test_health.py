"""Health endpoint tests"""

import pytest


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Test root endpoint returns ok status"""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "app" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_health_endpoint_structure(client):
    """Test health endpoint returns expected structure"""
    response = await client.get("/health")
    # Note: May return 503 if services unavailable in test env
    assert response.status_code in [200, 503]
    data = response.json()
    assert "status" in data
    assert "services" in data
    assert "api" in data["services"]
