"""Main API router"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, organizations, deals, documents, payments, sign, templates, bank_split, invitations, disputes, admin, onboarding, inn, receipts, agency

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(deals.router, prefix="/deals", tags=["deals"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(sign.router, prefix="/sign", tags=["signing"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])

# Bank Split (T-Bank instant split)
api_router.include_router(bank_split.router, prefix="/bank-split", tags=["bank-split"])

# Invitations (uses /bank-split/{id}/invite and /invitations/{token})
api_router.include_router(invitations.router, tags=["invitations"])

# Disputes (uses /bank-split/{id}/dispute and /disputes/{id})
api_router.include_router(disputes.router, tags=["disputes"])

# Admin / Analytics
api_router.include_router(admin.router, tags=["admin"])

# Onboarding (T-Bank merchant onboarding)
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])

# INN/BIK lookup (DaData)
api_router.include_router(inn.router, prefix="/inn", tags=["inn"])

# NPD Receipts (self-employed receipt tracking)
api_router.include_router(receipts.router, tags=["receipts"])

# Agency (agency admin endpoints)
api_router.include_router(agency.router, prefix="/agency", tags=["agency"])
