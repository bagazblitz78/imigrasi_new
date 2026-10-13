"""Baseline schema — matches the legacy ``create_all`` tables exactly.

Idempotent: existing production databases (created historically by
``Base.metadata.create_all``) keep their data; only missing tables are created.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def _has_table(bind, name: str) -> bool:
    return inspect(bind).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table(bind, "counters"):
        op.create_table(
            "counters",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(64), nullable=False),
            sa.Column("location", sa.String(128), nullable=True),
            sa.Column(
                "status",
                sa.Enum("ACTIVE", "INACTIVE", "BREAK", name="counterstatus"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )

    if not _has_table(bind, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("username", sa.String(64), nullable=False, unique=True),
            sa.Column("email", sa.String(128), nullable=False, unique=True),
            sa.Column("full_name", sa.String(128), nullable=False),
            sa.Column("hashed_password", sa.String(256), nullable=False),
            sa.Column(
                "role",
                sa.Enum("AGENT", "SUPERVISOR", "ADMIN", name="userrole"),
                nullable=False,
            ),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column("counter_id", sa.Integer(), sa.ForeignKey("counters.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )

    if not _has_table(bind, "passengers"):
        op.create_table(
            "passengers",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("full_name", sa.String(128), nullable=False),
            sa.Column("passport_number", sa.String(64), nullable=False),
            sa.Column("nationality", sa.String(64), nullable=False),
            sa.Column("visa_type", sa.String(64), nullable=True),
            sa.Column("flight_number", sa.String(32), nullable=True),
            sa.Column(
                "direction",
                sa.Enum("ARRIVAL", "DEPARTURE", name="traveldirection"),
                nullable=False,
            ),
            sa.Column(
                "status",
                sa.Enum(
                    "PENDING",
                    "APPROVED",
                    "HOLD",
                    "DEPORTED",
                    "REJECTED",
                    name="passengerstatus",
                ),
                nullable=False,
            ),
            sa.Column("blacklist_hit", sa.String(256), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("agent_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("counter_id", sa.Integer(), sa.ForeignKey("counters.id"), nullable=True),
            sa.Column("processed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )

    if not _has_table(bind, "blacklists"):
        op.create_table(
            "blacklists",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("passport_number", sa.String(64), nullable=True),
            sa.Column("full_name", sa.String(128), nullable=True),
            sa.Column("nationality", sa.String(64), nullable=True),
            sa.Column(
                "type",
                sa.Enum("PASSPORT", "NAME", "BOTH", name="blacklisttype"),
                nullable=False,
            ),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column("added_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )

    if not _has_table(bind, "escalations"):
        op.create_table(
            "escalations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "passenger_id",
                sa.Integer(),
                sa.ForeignKey("passengers.id"),
                nullable=False,
                unique=True,
            ),
            sa.Column("agent_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("supervisor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column(
                "decision",
                sa.Enum(
                    "PENDING", "APPROVED", "DEPORTED", "REJECTED", name="escalationdecision"
                ),
                nullable=True,
            ),
            sa.Column("decision_notes", sa.Text(), nullable=True),
            sa.Column("notified", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("resolved_at", sa.DateTime(), nullable=True),
        )

    if not _has_table(bind, "voa_applications"):
        op.create_table(
            "voa_applications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "passenger_id",
                sa.Integer(),
                sa.ForeignKey("passengers.id"),
                nullable=False,
                unique=True,
            ),
            sa.Column("supervisor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("duration_days", sa.Integer(), nullable=True),
            sa.Column("fee_paid", sa.Boolean(), nullable=True),
            sa.Column(
                "status",
                sa.Enum("PENDING", "APPROVED", "REJECTED", name="voastatus"),
                nullable=True,
            ),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("applied_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("processed_at", sa.DateTime(), nullable=True),
        )

    if not _has_table(bind, "audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("action", sa.String(128), nullable=False),
            sa.Column("target_type", sa.String(64), nullable=True),
            sa.Column("target_id", sa.Integer(), nullable=True),
            sa.Column("detail", sa.Text(), nullable=True),
            sa.Column("ip_address", sa.String(45), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )


def downgrade() -> None:
    # Never auto-drop production data.
    pass
