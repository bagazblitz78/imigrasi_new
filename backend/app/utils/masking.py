"""Sensitive-data masking helpers (requirement 28)."""
from __future__ import annotations

from typing import Optional


def mask_passport(value: Optional[str]) -> Optional[str]:
    """``A12345678`` -> ``A123****78``; short values are fully masked."""
    if not value:
        return value
    value = value.strip()
    if len(value) <= 3:
        return "*" * len(value)
    if len(value) <= 5:
        return value[0] + "*" * (len(value) - 1)
    return f"{value[:4]}{'*' * (len(value) - 6)}{value[-2:]}"


def mask_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    parts = value.split()
    if len(parts) == 1:
        return parts[0][:1] + "*" * max(len(parts[0]) - 1, 0)
    return parts[0] + " " + " ".join(p[:1] + "." for p in parts[1:])


def mask_email(value: Optional[str]) -> Optional[str]:
    if not value or "@" not in value:
        return value
    local, _, domain = value.partition("@")
    if len(local) <= 2:
        masked = local[:1] + "*"
    else:
        masked = local[:2] + "*" * (len(local) - 2)
    return f"{masked}@{domain}"
