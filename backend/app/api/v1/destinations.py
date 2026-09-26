import httpx
from fastapi import APIRouter, HTTPException, Query
from app.services.travel import CATALOG, BY_ID
from app.core.cache import cache_get, cache_set

router = APIRouter()

WEATHER_TTL = 900    # 15 minutes
DEST_LIST_TTL = 3600  # 1 hour
DEST_ITEM_TTL = 3600  # 1 hour


@router.get("/")
def get_destinations(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100)):
    cache_key = f"destinations:list:{skip}:{limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    result = CATALOG[skip : skip + limit]
    cache_set(cache_key, result, DEST_LIST_TTL)
    return result


@router.get("/{place_id}")
def destination(place_id: int):
    if place_id not in BY_ID:
        raise HTTPException(404, "Destination not found")

    cache_key = f"destinations:item:{place_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    result = BY_ID[place_id]
    cache_set(cache_key, result, DEST_ITEM_TTL)
    return result


@router.get("/{place_id}/weather")
async def weather(place_id: int):
    p = destination(place_id)

    cache_key = f"weather:{place_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    params = {
        "latitude": p["latitude"],
        "longitude": p["longitude"],
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
        "hourly": "visibility",
        "timezone": "Asia/Kolkata",
        "forecast_days": 5,
    }
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast", params=params
            )
            response.raise_for_status()
        data = response.json()
        if "current" not in data or "daily" not in data:
            raise ValueError("Incomplete forecast")
        cache_set(cache_key, data, WEATHER_TTL)
        return data
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            503, "Weather is temporarily unavailable. Please retry."
        )
