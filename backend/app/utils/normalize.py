"""Normalisation helpers for blacklist matching (requirement 37)."""
from __future__ import annotations

import re
from typing import Optional

_WS = re.compile(r"\s+")
_NON_PASSPORT = re.compile(r"[^A-Z0-9]")


def normalize_passport(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    return _NON_PASSPORT.sub("", value.upper())


def normalize_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    return _WS.sub(" ", value.strip().upper())


def normalize_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    return _WS.sub(" ", value.strip())
