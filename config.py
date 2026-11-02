import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load .env file
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "nexora-ai-ultra-secure-jwt-key-2026-x9z2p")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = 72

    # Database
    DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "nexora.db"))

    # Uploads directory
    UPLOAD_FOLDER = BASE_DIR / "uploads"
    MAX_CONTENT_LENGTH = 32 * 1024 * 1024  # 32MB max upload

    # AI API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    DEFAULT_AI_PROVIDER = os.getenv("DEFAULT_AI_PROVIDER", "gemini")
    DEFAULT_AI_MODEL = os.getenv("DEFAULT_AI_MODEL", "gemini-2.0-flash")

    # Host & Port
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

# Ensure upload directory exists
Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

