# ==============================================================================
# Neha Hospitals AI Microservice - Dockerfile
# ==============================================================================
FROM python:3.11-slim

# Install system dependencies for audio decoding and C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements (CPU PyTorch for fast, lightweight Docker image)
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy microservice application source code
COPY . .

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    AI_SERVICE_HOST=0.0.0.0 \
    AI_SERVICE_PORT=8000

# Volume mount point for Whisper model cache & SpeechBrain embeddings
VOLUME ["/app/models_cache"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
