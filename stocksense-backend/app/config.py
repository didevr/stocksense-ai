from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    alpha_vantage_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    supabase_url: str = ""
    supabase_key: str = ""

    price_cache_ttl: int = 900
    fundamentals_cache_ttl: int = 86400
    news_cache_ttl: int = 1800

    free_daily_limit: int = 10
    pro_daily_limit: int = 100

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
