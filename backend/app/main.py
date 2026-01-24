"""FastAPI application entry point"""

import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
import redis.asyncio as aioredis
from minio import Minio

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import async_engine
from app.api.v1.router import api_router

# Configure logging before app initialization
setup_logging()

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add X-Request-ID header to all requests for tracing.

    This middleware:
    - Accepts existing X-Request-ID from incoming requests (for distributed tracing)
    - Generates a new UUID if not provided
    - Stores request_id in request.state for access in handlers
    - Adds X-Request-ID to response headers
    """

    async def dispatch(self, request: Request, call_next):
        # Get existing request ID or generate new one
        request_id = request.headers.get("X-Request-ID") or str(uuid4())

        # Store in request state for access in handlers
        request.state.request_id = request_id

        # Process request
        response = await call_next(request)

        # Add to response headers
        response.headers["X-Request-ID"] = request_id

        return response


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
# Note: Also expose X-Request-ID header for clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# Request ID tracing (added last = executed first in middleware chain)
app.add_middleware(RequestIDMiddleware)


# =============================================================================
# Global Exception Handlers
# =============================================================================


def _get_request_id(request: Request) -> str | None:
    """Safely get request_id from request state."""
    return getattr(request.state, "request_id", None)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with consistent format."""
    request_id = _get_request_id(request)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "detail": exc.detail,
            "status_code": exc.status_code,
            "request_id": request_id,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    request_id = _get_request_id(request)
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "detail": "Validation error",
            "errors": exc.errors(),
            "request_id": request_id,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all handler for unhandled exceptions.

    In production (DEBUG=False), internal details are hidden.
    """
    request_id = _get_request_id(request)

    # Log the full traceback for debugging with request_id
    logger.error(
        f"[{request_id}] Unhandled exception on {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )

    # In debug mode, include exception details for development
    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "detail": str(exc),
                "status_code": 500,
                "type": type(exc).__name__,
                "request_id": request_id,
            },
        )

    # In production, return safe error message (no internal details)
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "detail": "Internal server error",
            "status_code": 500,
            "request_id": request_id,
        },
    )


# =============================================================================
# Routes
# =============================================================================


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

    def _error_detail(e: Exception) -> str:
        """Return error details only in debug mode"""
        if settings.DEBUG:
            return f"error: {str(e)[:100]}"
        return "error"

    # Check PostgreSQL
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        services["database"] = "ok"
    except Exception as e:
        services["database"] = _error_detail(e)
        all_healthy = False

    # Check Redis
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        await redis_client.ping()
        await redis_client.close()
        services["redis"] = "ok"
    except Exception as e:
        services["redis"] = _error_detail(e)
        all_healthy = False

    # Check MinIO/S3
    try:
        endpoint = settings.S3_ENDPOINT.replace("http://", "").replace("https://", "")
        secure = settings.S3_ENDPOINT.startswith("https://")
        minio_client = Minio(
            endpoint, access_key=settings.S3_ACCESS_KEY, secret_key=settings.S3_SECRET_KEY, secure=secure
        )
        minio_client.bucket_exists(settings.S3_BUCKET_DOCUMENTS)
        services["s3"] = "ok"
    except Exception as e:
        services["s3"] = _error_detail(e)
        all_healthy = False

    response_data = {"status": "healthy" if all_healthy else "unhealthy", "services": services}

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
