"""Object-level authorization (IDOR/BOLA protection, requirement 26).

Frontend role checks are never trusted: every object access is verified here.
"""
from __future__ import annotations

from app.core.errors import ForbiddenError, NotFoundError
from app.models.passenger import Passenger
from app.models.user import User, UserRole


def can_view_all_passengers(user: User) -> bool:
    return user.role in (UserRole.SUPERVISOR, UserRole.ADMIN)


def assert_can_view_passenger(user: User, passenger: Passenger) -> None:
    if can_view_all_passengers(user):
        return
    if passenger.agent_id != user.id:
        # Return 404 (not 403) so existence of other agents' records is not leaked.
        raise NotFoundError("Data penumpang tidak ditemukan")


def assert_can_modify_passenger(user: User, passenger: Passenger) -> None:
    if user.role in (UserRole.SUPERVISOR, UserRole.ADMIN):
        return
    if passenger.agent_id != user.id:
        raise NotFoundError("Data penumpang tidak ditemukan")


def assert_can_decide(user: User) -> None:
    if user.role not in (UserRole.SUPERVISOR, UserRole.ADMIN):
        raise ForbiddenError("Hanya Supervisor/Admin yang dapat mengambil keputusan")


def assert_can_manage_users(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise ForbiddenError("Hanya Administrator yang dapat mengelola user")


def assert_can_manage_blacklist(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise ForbiddenError("Hanya Administrator yang dapat mengelola daftar cekal")


def assert_can_manage_counters(user: User) -> None:
    if user.role not in (UserRole.SUPERVISOR, UserRole.ADMIN):
        raise ForbiddenError("Hanya Supervisor/Admin yang dapat mengelola konter")


def assert_can_view_audit(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise ForbiddenError("Hanya Administrator yang dapat mengakses audit log")
