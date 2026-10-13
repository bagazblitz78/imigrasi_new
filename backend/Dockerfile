# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder: compile/install Python dependencies into a venv
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libmariadb-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runtime: minimal image, non-root user, immutable application code
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    TZ=Asia/Jakarta

# Minimal runtime libraries: timezone data + Tesseract for MRZ OCR.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

RUN addgroup --system app && adduser --system --ingroup app --home /app app

WORKDIR /app
COPY --chown=app:app app ./app
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app alembic.ini gunicorn_conf.py seed.py ./

# Build metadata (not a secret). Injected at build time.
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ENV APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA}

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/live').status==200 else 1)"

# Production ASGI server (never the uvicorn dev server / --reload).
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
