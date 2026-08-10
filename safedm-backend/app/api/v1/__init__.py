from fastapi import APIRouter

from app.api.v1 import admin, analysis, applications, auth, guide, health, reports, threats, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(applications.router)
api_router.include_router(analysis.router)
api_router.include_router(reports.router)
api_router.include_router(threats.router)
api_router.include_router(guide.router)
api_router.include_router(admin.router)
