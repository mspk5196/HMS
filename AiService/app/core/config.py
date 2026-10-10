import os

class Settings:
    PROJECT_NAME: str = "Neha Hospitals AI Service"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    HOST: str = os.getenv("AI_SERVICE_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    INTERNAL_SERVICE_KEY: str = os.getenv("AI_INTERNAL_KEY", "neha-ai-internal-key-2026")
    LOG_LEVEL: str = os.getenv("AI_LOG_LEVEL", "info")

settings = Settings()
