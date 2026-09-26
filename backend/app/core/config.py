import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Wanderer API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://wanderer_user:wanderer_password@localhost:5432/wanderer_db")
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    HUGGINGFACE_API_KEY: str = ""
    HF_MODEL_URL: str = "https://router.huggingface.co/v1/chat/completions"
    HF_MODEL: str = "CohereLabs/c4ai-command-r-08-2024"
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    AUTO_CREATE_SCHEMA: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", env_nested_delimiter=",")

settings = Settings()
