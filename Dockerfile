FROM python:3.11-slim

WORKDIR /app

# Install system audio dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU first
RUN pip install --no-cache-dir torch==2.6.0+cpu torchaudio==2.6.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# Install backend dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy application files
COPY backend/ /app/backend/
COPY web/ /app/web/
COPY config/ /app/config/

# Configure environment
ENV PYTHONPATH="/app:/app/backend"
ENV HOST="0.0.0.0"
ENV PORT="7860"
ENV DEBUG="False"
ENV TRUST_PROXY_HEADERS="True"
ENV ALLOWED_ORIGINS="*"

# Run as non-root user (Hugging Face standard)
RUN useradd -m -u 1000 user && chown -R user:user /app
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /app/backend

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--ws", "websockets", "--proxy-headers", "--forwarded-allow-ips=*"]
