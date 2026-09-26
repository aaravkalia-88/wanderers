from fastapi import APIRouter
from app.api.v1 import destinations, auth, travel, export, community, ai_chat

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(destinations.router, prefix="/destinations", tags=["destinations"])
api_router.include_router(export.router, tags=["export"])
api_router.include_router(travel.router, tags=["travel"])
api_router.include_router(community.router, tags=["community"])
api_router.include_router(ai_chat.router, prefix="/ai", tags=["ai"])
