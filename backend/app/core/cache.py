"""
Unified cache service for Wanderer.

Connects to Redis when available (production / docker), falls back to an
in-memory LRU dict for local development without Docker.

All values are JSON-serialized. TTLs are in seconds.
"""
from __future__ import annotations

import json
import logging
import time
from threading import Lock
from collections import OrderedDict
from typing import Any

logger = logging.getLogger("wanderer.cache")

# ---------------------------------------------------------------------------
# In-memory fallback (bounded LRU)
# ---------------------------------------------------------------------------
_MAX_MEMORY_ENTRIES = 512


class _MemoryCache:
    """Thread-safe-enough for a single-process uvicorn dev server."""

    def __init__(self, maxsize: int = _MAX_MEMORY_ENTRIES):
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._maxsize = maxsize

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if expires_at and time.time() > expires_at:
            self._store.pop(key, None)
            return None
        self._store.move_to_end(key)
        return value

    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        expires_at = time.time() + ttl if ttl > 0 else 0
        self._store[key] = (expires_at, value)
        self._store.move_to_end(key)
        while len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def delete_pattern(self, prefix: str) -> int:
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            del self._store[k]
        return len(keys)


# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------
_redis_client: Any | None = None
_memory_cache = _MemoryCache()
_using_redis = False
_rate_lock = Lock()


# ---------------------------------------------------------------------------
# Initialisation (called from lifespan)
# ---------------------------------------------------------------------------
def init_cache(redis_url: str) -> bool:
    """Try to connect to Redis. Returns True if Redis is active."""
    global _redis_client, _using_redis
    try:
        import redis as redis_lib
        client = redis_lib.Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        _redis_client = client
        _using_redis = True
        logger.info("Cache: connected to Redis at %s", redis_url)
        return True
    except Exception as exc:
        _redis_client = None
        _using_redis = False
        logger.info("Cache: Redis unavailable (%s), using in-memory fallback", exc)
        return False


def is_redis_active() -> bool:
    return _using_redis


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def cache_get(key: str) -> Any | None:
    """Return cached value or None."""
    if _using_redis and _redis_client:
        try:
            raw = _redis_client.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            pass
    return _memory_cache.get(key)


def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Store a value with TTL (seconds). Default 5 minutes."""
    if _using_redis and _redis_client:
        try:
            _redis_client.setex(key, ttl, json.dumps(value, default=str))
            return
        except Exception:
            pass
    _memory_cache.set(key, value, ttl)


def cache_delete(key: str) -> None:
    """Remove a single key."""
    if _using_redis and _redis_client:
        try:
            _redis_client.delete(key)
            return
        except Exception:
            pass
    _memory_cache.delete(key)


def cache_invalidate_prefix(prefix: str) -> int:
    """Remove all keys starting with *prefix*. Returns count removed."""
    if _using_redis and _redis_client:
        try:
            cursor, keys = 0, []
            while True:
                cursor, batch = _redis_client.scan(cursor, match=prefix + "*", count=100)
                keys.extend(batch)
                if cursor == 0:
                    break
            if keys:
                _redis_client.delete(*keys)
            return len(keys)
        except Exception:
            pass
    return _memory_cache.delete_pattern(prefix)


# ---------------------------------------------------------------------------
# Rate limiting helper
# ---------------------------------------------------------------------------
def rate_limit_check(key: str, max_attempts: int, window_seconds: int) -> bool:
    """
    Fixed-window rate limiter with atomic counters.

    Returns True if the request is ALLOWED, False if rate-limited.
    Each call increments the counter for *key*.
    """
    full_key = f"rate:{key}"

    if _using_redis and _redis_client:
        try:
            count = _redis_client.eval(
                "local n = redis.call('INCR', KEYS[1]); "
                "if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
                1, full_key, window_seconds,
            )
            return int(count) <= max_attempts
        except Exception:
            return False  # An unavailable limiter must not allow unlimited auth attempts.

    # ponytail: one process in local development; use Redis for multiple workers.
    with _rate_lock:
        entry = _memory_cache.get(full_key)
        now = time.time()
        if entry is None or now - entry["start"] >= window_seconds:
            entry = {"count": 0, "start": now}
        entry["count"] += 1
        _memory_cache.set(full_key, entry, max(.001, window_seconds - (now - entry["start"])))
        return entry["count"] <= max_attempts
