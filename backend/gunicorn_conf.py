"""Gunicorn configuration for production (requirement 89).

Uvicorn workers with a conservative worker count; tune ``WEB_CONCURRENCY`` based
on available memory (each worker loads the OCR stack).
"""
import multiprocessing
import os

bind = os.getenv("BIND", "0.0.0.0:8000")
workers = int(os.getenv("WEB_CONCURRENCY", min(multiprocessing.cpu_count(), 4)))
worker_class = "uvicorn.workers.UvicornWorker"
timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = 5
max_requests = 2000
max_requests_jitter = 200
accesslog = None  # structured logging handled by the app middleware
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info").lower()
forwarded_allow_ips = os.getenv("FORWARDED_ALLOW_IPS", "*")
preload_app = False
