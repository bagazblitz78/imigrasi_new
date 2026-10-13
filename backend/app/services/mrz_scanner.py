"""MRZ (Machine Readable Zone) extraction using Tesseract OCR + ICAO checksum
validation. No passport image is ever sent to a third-party service.

Concurrency/CPU notes:
- A semaphore caps simultaneous OCR jobs so scans cannot starve other requests.
- OCR (CPU-bound, blocking) runs in a thread pool via ``asyncio.to_thread``.
- Only the MRZ strip is OCR'd, not the full-resolution photo.
- The whole operation is bounded by ``MRZ_PROCESSING_TIMEOUT``.
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import date
from typing import Optional

import pytesseract
from PIL import Image, ImageFilter, ImageOps

from app.core.config import settings

try:  # mrz>=0.6 exposes TD3CodeChecker
    from mrz.checker.td3 import TD3CodeChecker
except Exception:  # pragma: no cover - import guard for unusual installs
    TD3CodeChecker = None

logger = logging.getLogger("app.mrz")

_OCR_SEMAPHORE = asyncio.Semaphore(3)

_MRZ_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
_TESS_CONFIG = f"--psm 6 -c tessedit_char_whitelist={_MRZ_CHARSET}"
_CROP_RATIOS = [0.30, 0.40, 0.55, 1.0]


class MRZNotFoundError(ValueError):
    pass


def _clean_line(line: str) -> str:
    line = line.upper().strip()
    return re.sub(r"[^A-Z0-9<]", "", line)


def _ocr_crop(image: Image.Image, ratio: float) -> list[str]:
    w, h = image.size
    top = int(h * (1 - ratio))
    crop = image.crop((0, top, w, h))

    gray = ImageOps.grayscale(crop)
    gray = ImageOps.autocontrast(gray, cutoff=1)
    if gray.width < 1000:
        scale = 1000 / gray.width
        gray = gray.resize((1000, int(gray.height * scale)))
    gray = gray.filter(ImageFilter.SHARPEN)

    raw = pytesseract.image_to_string(gray, config=_TESS_CONFIG)
    return [cl for line in raw.splitlines() if len(cl := _clean_line(line)) >= 20]


def _yymmdd_to_iso(yymmdd: str, is_expiry: bool) -> Optional[str]:
    if not yymmdd or len(yymmdd) != 6 or not yymmdd.isdigit():
        return None
    yy, mm, dd = int(yymmdd[0:2]), int(yymmdd[2:4]), int(yymmdd[4:6])
    current_yy = date.today().year % 100
    century = 2000 if is_expiry else (1900 if yy > current_yy else 2000)
    try:
        return date(century + yy, mm, dd).isoformat()
    except ValueError:
        return None


_DIGIT_TO_LETTER = {"0": "O", "1": "I", "5": "S", "8": "B", "2": "Z"}
_LETTER_TO_DIGIT = {v: k for k, v in _DIGIT_TO_LETTER.items()}


def _fix_zone(s: str, expect: str) -> str:
    out = []
    for ch in s:
        if expect == "D" and ch in _LETTER_TO_DIGIT:
            out.append(_LETTER_TO_DIGIT[ch])
        elif expect == "A" and ch in _DIGIT_TO_LETTER:
            out.append(_DIGIT_TO_LETTER[ch])
        else:
            out.append(ch)
    return "".join(out)


def _fix_td3_confusion(line1: str, line2: str) -> tuple[str, str]:
    line1 = _fix_zone(line1.ljust(44, "<")[:44], "A")
    l2 = list(line2.ljust(44, "<")[:44])

    def set_zone(a: int, b: int, expect: str) -> None:
        l2[a:b] = list(_fix_zone("".join(l2[a:b]), expect))

    set_zone(9, 10, "D")
    set_zone(10, 13, "A")
    set_zone(13, 19, "D")
    set_zone(19, 20, "D")
    set_zone(21, 27, "D")
    set_zone(27, 28, "D")
    set_zone(42, 43, "D")
    set_zone(43, 44, "D")

    return line1, "".join(l2)


def _try_parse_td3(lines: list[str]) -> Optional[dict]:
    if len(lines) < 2 or TD3CodeChecker is None:
        return None
    candidates = lines[-2:]

    line1, line2 = _fix_td3_confusion(candidates[0], candidates[1])
    mrz_text = f"{line1}\n{line2}"
    try:
        checker = TD3CodeChecker(mrz_text)
    except Exception as exc:
        logger.info("MRZ candidate gagal di-parse: %s", exc)
        return None

    f = checker.fields()
    return {
        "document_type": "passport",
        "valid": bool(checker),
        "errors": [str(e) for e in checker.report.errors],
        "document_number": f.document_number,
        "surname": f.surname,
        "given_names": f.name,
        "nationality": f.nationality,
        "birth_date": _yymmdd_to_iso(f.birth_date, is_expiry=False),
        "sex": f.sex,
        "expiry_date": _yymmdd_to_iso(f.expiry_date, is_expiry=True),
        "raw_mrz": mrz_text,
    }


def scan_passport_mrz_sync(image: Image.Image) -> dict:
    image = ImageOps.exif_transpose(image)
    for ratio in _CROP_RATIOS:
        lines = _ocr_crop(image, ratio)
        result = _try_parse_td3(lines)
        if result and result["valid"]:
            return result

    raise MRZNotFoundError(
        "MRZ tidak terbaca dengan valid. Pastikan foto jelas, paspor rata "
        "(tidak miring), dan 2 baris teks MRZ di bagian bawah paspor terlihat penuh."
    )


async def scan_passport_mrz(image: Image.Image) -> dict:
    async with _OCR_SEMAPHORE:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(scan_passport_mrz_sync, image),
                timeout=settings.MRZ_PROCESSING_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise MRZNotFoundError(
                "Pemrosesan MRZ melebihi batas waktu. Coba lagi dengan foto yang lebih jelas."
            )
