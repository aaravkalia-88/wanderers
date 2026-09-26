import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.db.session import Base, engine, SessionLocal
from app.models import destination, travel, community, user
from app.services.travel import CATALOG
from app.core.cache import init_cache, is_redis_active
from app.core.config import settings

logger = logging.getLogger("wanderer")


@asynccontextmanager
async def lifespan(app):
    # Initialize cache (Redis or in-memory fallback)
    using_redis = init_cache(settings.REDIS_URL)
    logger.info(
        "Cache: %s",
        "Redis connected" if using_redis else "in-memory fallback (Redis unavailable)",
    )

    # Local SQLite can bootstrap itself; production schemas are versioned with Alembic.
    if settings.AUTO_CREATE_SCHEMA or "sqlite" in settings.DATABASE_URL:
        Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for place in CATALOG:
            if not db.get(destination.Destination, place["id"]):
                allowed = {c.name for c in destination.Destination.__table__.columns}
                db.add(
                    destination.Destination(
                        **{k: v for k, v in place.items() if k in allowed}
                    )
                )
        db.commit()
    yield


from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def response_security(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    if request.headers.get("authorization") or request.url.path.startswith(f"{settings.API_V1_STR}/auth/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {"status": "ok"}


@app.get(f"{settings.API_V1_STR}/health/ready")
def readiness_check():
    from sqlalchemy import text
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready", "cache": "redis" if is_redis_active() else "memory"}
