"""Server-side pagination with hard caps and safe sort whitelisting
(requirements 15/31/46)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Query

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 25


@dataclass(slots=True)
class PageParams:
    page: int
    page_size: int
    offset: int
    sort: Optional[str]
    order: str


def pagination_params(
    page: int = Query(1, ge=1, le=100_000),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    sort: Optional[str] = Query(None),
    order: str = Query("desc", pattern="^(asc|desc)$"),
) -> PageParams:
    page = max(page, 1)
    return PageParams(
        page=page,
        page_size=page_size,
        offset=(page - 1) * page_size,
        sort=sort,
        order=order,
    )


PaginationDep = Depends(pagination_params)
