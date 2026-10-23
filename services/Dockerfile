FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core fonts-wqy-zenhei && rm -rf /var/lib/apt/lists/*

COPY requirements.lock .
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

COPY . .

RUN useradd --create-home --uid 10001 appuser && mkdir -p /data/protected_uploads && chown -R appuser:appuser /data /app
ENV UPLOAD_DIR=/data/protected_uploads
USER appuser

EXPOSE 10000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips ${FORWARDED_ALLOW_IPS:-127.0.0.1} --no-access-log"]
