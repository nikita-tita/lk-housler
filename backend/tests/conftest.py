"""Pytest fixtures for testing"""

import pytest

# Flag to check if app can be imported
APP_AVAILABLE = False

# Try to import app, but don't fail if dependencies are missing
try:
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    APP_AVAILABLE = True
except (ImportError, OSError) as e:
    # Dependencies not installed or system libs missing
    import warnings
    warnings.warn(f"Could not import app.main: {e}. App-related tests will be skipped.")
    app = None


@pytest.fixture
async def client():
    """Async test client for FastAPI app"""
    if not APP_AVAILABLE or app is None:
        pytest.skip("App not available (missing dependencies)")
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
