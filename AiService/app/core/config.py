import os
from pathlib import Path
from dotenv import load_dotenv

# Locate and load .env file from AiService root
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

class Settings:
    PROJECT_NAME: str = "Neha Hospitals AI Service"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Server Binding
    HOST: str = os.getenv("AI_SERVICE_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    INTERNAL_SERVICE_KEY: str = os.getenv("AI_INTERNAL_KEY", "neha-ai-internal-key-2026")
    LOG_LEVEL: str = os.getenv("AI_LOG_LEVEL", "info")

    # Allowed backend origins for CORS (Server-to-Server / Reverse proxy)
    ALLOWED_ORIGINS: list = [
        origin.strip()
        for origin in os.getenv(
            "AI_ALLOWED_ORIGINS",
            "http://localhost:7000,http://127.0.0.1:7000,http://localhost:5000,http://nehahospital-backend:5000,https://neha.tylo.co.in,https://neha.mspkapps.in"
        ).split(",")
        if origin.strip()
    ]

    # Local Ollama LLM Configuration
    OLLAMA_API_URL: str = os.getenv("OLLAMA_API_URL", "http://127.0.0.1:11434/api/generate")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:1.5b")
    OLLAMA_TIMEOUT_SECONDS: int = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45"))

    # Local Faster-Whisper Speech-to-Text Configuration
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "small")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "auto")  # "auto", "cuda", "cpu"
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "auto")  # "auto", "float16", "int8"
    WHISPER_CACHE_DIR: str = os.getenv(
        "WHISPER_CACHE_DIR",
        str(BASE_DIR / "models_cache" / "whisper")
    )

settings = Settings()
