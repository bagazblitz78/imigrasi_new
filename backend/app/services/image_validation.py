"""Upload hardening for the MRZ scanner (requirement 32).

Never trust the ``Content-Type`` header: validate the declared type, the magic
bytes, the decoded image dimensions and let Pillow detect malformed or
decompression-bomb images.
"""
from __future__ import annotations

import io
import logging

from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import ValidationError

logger = logging.getLogger("app.upload")

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 8000
MAX_PIXELS = 40_000_000  # decompression-bomb guard

# Pillow raises DecompressionBombError above this; warn above ~25MP.
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def _sniff(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_image(content_type: str | None, data: bytes) -> Image.Image:
    if not data:
        raise ValidationError("File gambar kosong")
    if len(data) > settings.UPLOAD_MAX_SIZE:
        raise ValidationError(
            f"Ukuran gambar maksimal {settings.UPLOAD_MAX_SIZE // (1024 * 1024)}MB"
        )

    sniffed = _sniff(data)
    if sniffed is None:
        raise ValidationError("File bukan gambar JPEG, PNG, atau WEBP yang valid")
    if content_type and content_type not in ALLOWED_MIME:
        raise ValidationError("Format gambar harus JPEG, PNG, atau WEBP")
    if content_type and sniffed != content_type:
        raise ValidationError("Tipe file tidak cocok dengan isinya")

    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()  # raises on malformed/truncated files
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.info("Tolak upload gambar tidak valid: %s", exc)
        raise ValidationError("Gambar rusak atau tidak dapat diproses")

    image = Image.open(io.BytesIO(data))
    width, height = image.size
    if width <= 0 or height <= 0:
        raise ValidationError("Dimensi gambar tidak valid")
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise ValidationError("Dimensi gambar terlalu besar")
    if width * height > MAX_PIXELS:
        raise ValidationError("Resolusi gambar terlalu besar")
    return image
