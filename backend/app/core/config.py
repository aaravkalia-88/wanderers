import os
from pydantic import Field, SecretStr, model_validator
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
    TINYFISH_API_KEY: SecretStr = SecretStr('')
    TINYFISH_API_KEY_ENCRYPTED: str = ''
    TINYFISH_DISCOVERY_VERIFIED: bool = False
    TINYFISH_BILLING_VERIFIED: bool = False
    TINYFISH_LIVE_SOURCES: list[str] = Field(default_factory=list)
    TINYFISH_CUSTOM_STEP_LIMIT: bool = False
    TINYFISH_STEP_COST_MUSD: int = Field(default=16, ge=1)
    TINYFISH_BUDGET_MUSD: int = Field(default=9000, ge=0, le=9000)

    @model_validator(mode='after')
    def encrypted_tinyfish(self):
        if not self.TINYFISH_API_KEY.get_secret_value() and self.TINYFISH_API_KEY_ENCRYPTED:
            from app.core.tinyfish_secret import decrypt_tinyfish
            self.TINYFISH_API_KEY = SecretStr(decrypt_tinyfish(self.TINYFISH_API_KEY_ENCRYPTED))
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", env_nested_delimiter=",")

settings = Settings()
