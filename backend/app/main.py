"""FastAPI application entry point"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
import redis.asyncio as aioredis
from minio import Minio

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import async_engine
from app.api.v1.router import api_router

# Configure logging before app initialization
setup_logging()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        return response


# Disable API docs in production
_docs_url = "/docs" if settings.APP_ENV != "production" else None
_redoc_url = "/redoc" if settings.APP_ENV != "production" else None
_openapi_url = "/openapi.json" if settings.APP_ENV != "production" else None

# OpenAPI tags metadata
tags_metadata = [
    {"name": "auth", "description": "Authentication: SMS OTP for agents, Email OTP for clients, password for agencies"},
    {"name": "users", "description": "Current user profile operations"},
    {"name": "deals", "description": "Real estate deals management"},
    {"name": "documents", "description": "Contract generation and document management"},
    {"name": "signing", "description": "Public document signing via SMS OTP (PEP)"},
    {"name": "payments", "description": "Payment processing via SBP"},
    {"name": "organizations", "description": "Agency and organization management"},
    {"name": "templates", "description": "Contract templates management"},
]

app = FastAPI(
    title=settings.APP_NAME,
    description="API for Housler Personal Account - real estate deals, contracts, and payments",
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
    openapi_tags=tags_metadata,
    redirect_slashes=False,
)

# CORS - restricted to actual methods and headers used
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)


@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/health")
async def health():
    """Detailed health check with real dependency verification"""
    services = {"api": "ok"}
    all_healthy = True

    # Check PostgreSQL
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        services["database"] = "ok"
    except Exception as e:
        services["database"] = f"error: {str(e)[:100]}"
        all_healthy = False

    # Check Redis
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        await redis_client.close()
        services["redis"] = "ok"
    except Exception as e:
        services["redis"] = f"error: {str(e)[:100]}"
        all_healthy = False

    # Check MinIO/S3
    try:
        endpoint = settings.S3_ENDPOINT.replace("http://", "").replace("https://", "")
        secure = settings.S3_ENDPOINT.startswith("https://")
        minio_client = Minio(
            endpoint,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            secure=secure
        )
        minio_client.bucket_exists(settings.S3_BUCKET_DOCUMENTS)
        services["s3"] = "ok"
    except Exception as e:
        services["s3"] = f"error: {str(e)[:100]}"
        all_healthy = False

    response_data = {
        "status": "healthy" if all_healthy else "unhealthy",
        "services": services
    }

    if not all_healthy:
        return JSONResponse(status_code=503, content=response_data)

    return response_data


# Include API routers
app.include_router(api_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
