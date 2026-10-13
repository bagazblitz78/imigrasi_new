#!/usr/bin/env python3
"""Idempotent seed for initial data (counters, demo users, sample blacklist).

Run once after migrations:
    docker compose exec backend python seed.py

Passwords are read from environment variables when provided; otherwise
development defaults are used. Change all passwords after first login.
"""
import asyncio
import os

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models import (
    Blacklist,
    BlacklistType,
    Counter,
    CounterStatus,
    User,
    UserRole,
)
from app.utils.normalize import normalize_name, normalize_passport
from sqlalchemy import select


async def _get_or_create_counter(db, name, location):
    counter = (
        await db.execute(select(Counter).where(Counter.name == name))
    ).scalar_one_or_none()
    if counter:
        return counter
    counter = Counter(name=name, location=location, status=CounterStatus.ACTIVE)
    db.add(counter)
    await db.flush()
    return counter


async def _get_or_create_user(db, *, username, email, full_name, password, role, counter_id=None):
    user = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if user:
        return user
    user = User(
        username=username,
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        role=role,
        counter_id=counter_id,
    )
    db.add(user)
    await db.flush()
    return user


async def seed():
    async with AsyncSessionLocal() as db:
        c1 = await _get_or_create_counter(db, "Konter A-1", "Terminal 2 Internasional")
        c2 = await _get_or_create_counter(db, "Konter A-2", "Terminal 2 Internasional")

        admin = await _get_or_create_user(
            db,
            username=os.getenv("SEED_ADMIN_USERNAME", "admin"),
            email="admin@imigrasi.go.id",
            full_name="Administrator Pusdatin",
            password=os.getenv("SEED_ADMIN_PASSWORD", "Admin1234!"),
            role=UserRole.ADMIN,
        )
        await _get_or_create_user(
            db,
            username="supervisor1",
            email="spv1@imigrasi.go.id",
            full_name="Kepala Regu Budi",
            password=os.getenv("SEED_SUPERVISOR_PASSWORD", "Spv12345!"),
            role=UserRole.SUPERVISOR,
        )
        await _get_or_create_user(
            db,
            username="agent1",
            email="agent1@imigrasi.go.id",
            full_name="Petugas Andi",
            password=os.getenv("SEED_AGENT_PASSWORD", "Agent123!"),
            role=UserRole.AGENT,
            counter_id=c1.id,
        )
        await _get_or_create_user(
            db,
            username="agent2",
            email="agent2@imigrasi.go.id",
            full_name="Petugas Sari",
            password=os.getenv("SEED_AGENT_PASSWORD", "Agent123!"),
            role=UserRole.AGENT,
            counter_id=c2.id,
        )

        existing_bl = (
            await db.execute(select(Blacklist).limit(1))
        ).scalar_one_or_none()
        if not existing_bl:
            db.add_all(
                [
                    Blacklist(
                        passport_number="XX1234567",
                        full_name="John Doe Suspect",
                        nationality="Unknown",
                        type=BlacklistType.BOTH,
                        reason="Tersangka tindak pidana penyelundupan",
                        added_by=admin.id,
                        passport_normalized=normalize_passport("XX1234567"),
                        name_normalized=normalize_name("John Doe Suspect"),
                    ),
                    Blacklist(
                        passport_number="YY9876543",
                        full_name=None,
                        nationality="Country X",
                        type=BlacklistType.PASSPORT,
                        reason="Dokumen palsu",
                        added_by=admin.id,
                        passport_normalized=normalize_passport("YY9876543"),
                    ),
                    Blacklist(
                        passport_number=None,
                        full_name="Jane Smith Banned",
                        nationality=None,
                        type=BlacklistType.NAME,
                        reason="Overstay sebelumnya > 6 bulan",
                        added_by=admin.id,
                        name_normalized=normalize_name("Jane Smith Banned"),
                    ),
                ]
            )

        await db.commit()
        print("Seed selesai (idempotent). Ganti password default setelah login!")


if __name__ == "__main__":
    asyncio.run(seed())
