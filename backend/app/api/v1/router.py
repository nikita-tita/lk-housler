"""Main API router"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, organizations, deals, documents, payments, sign

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(deals.router, prefix="/deals", tags=["deals"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(sign.router, prefix="/sign", tags=["signing"])

