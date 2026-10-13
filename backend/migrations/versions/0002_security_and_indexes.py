"""Security tables, normalised blacklist columns and performance indexes.

Non-destructive and idempotent: every object is created only when missing, so
it is safe on both existing production databases and fresh installs.

Revision ID: 0002_security
Revises: 0001_baseline
Create Date: 2026-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0002_security"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def _has_table(bind, name: str) -> bool:
    return inspect(bind).has_table(name)


def _columns(bind, table: str) -> set[str]:
    return {c["name"] for c in inspect(bind).get_columns(table)}


def _indexes(bind, table: str) -> set[str]:
    return {i["name"] for i in inspect(bind).get_indexes(table)}


def _add_index(bind, name: str, table: str, columns: list[str], unique: bool = False) -> None:
    if name not in _indexes(bind, table):
        op.create_index(name, table, columns, unique=unique)


def upgrade() -> None:
    bind = op.get_bind()

    # ── Blacklist normalised columns + backfill ──────────────────────────────
    if _has_table(bind, "blacklists"):
        cols = _columns(bind, "blacklists")
        if "passport_normalized" not in cols:
            op.add_column(
                "blacklists", sa.Column("passport_normalized", sa.String(64), nullable=True)
            )
        if "name_normalized" not in cols:
            op.add_column(
                "blacklists", sa.Column("name_normalized", sa.String(128), nullable=True)
            )
        op.execute(
            sa.text(
                "UPDATE blacklists SET passport_normalized = "
                "UPPER(REGEXP_REPLACE(passport_number, '[^A-Za-z0-9]', '')) "
                "WHERE passport_number IS NOT NULL AND passport_normalized IS NULL"
            )
        )
        op.execute(
            sa.text(
                "UPDATE blacklists SET name_normalized = "
                "UPPER(TRIM(REGEXP_REPLACE(full_name, '[[:space:]]+', ' '))) "
                "WHERE full_name IS NOT NULL AND name_normalized IS NULL"
            )
        )
        _add_index(bind, "ix_blacklists_active_passport", "blacklists", ["is_active", "passport_number"])
        _add_index(bind, "ix_blacklists_active_name", "blacklists", ["is_active", "full_name"])
        _add_index(bind, "ix_blacklists_passport_norm", "blacklists", ["passport_normalized"])
        _add_index(bind, "ix_blacklists_name_norm", "blacklists", ["name_normalized"])

    # ── Audit log correlation ────────────────────────────────────────────────
    if _has_table(bind, "audit_logs"):
        if "request_id" not in _columns(bind, "audit_logs"):
            op.add_column("audit_logs", sa.Column("request_id", sa.String(64), nullable=True))
        _add_index(bind, "ix_audit_user_created", "audit_logs", ["user_id", "created_at"])
        _add_index(bind, "ix_audit_action_created", "audit_logs", ["action", "created_at"])
        _add_index(bind, "ix_audit_created", "audit_logs", ["created_at"])
        _add_index(bind, "ix_audit_request_id", "audit_logs", ["request_id"])

    # ── Passenger query indexes ──────────────────────────────────────────────
    if _has_table(bind, "passengers"):
        _add_index(bind, "ix_passengers_agent_created", "passengers", ["agent_id", "created_at"])
        _add_index(bind, "ix_passengers_status_created", "passengers", ["status", "created_at"])
        _add_index(
            bind, "ix_passengers_direction_created", "passengers", ["direction", "created_at"]
        )
        _add_index(
            bind, "ix_passengers_counter_created", "passengers", ["counter_id", "created_at"]
        )
        _add_index(bind, "ix_passengers_created", "passengers", ["created_at"])

    if _has_table(bind, "escalations"):
        _add_index(
            bind, "ix_escalations_decision_created", "escalations", ["decision", "created_at"]
        )
        _add_index(bind, "ix_escalations_created", "escalations", ["created_at"])

    if _has_table(bind, "voa_applications"):
        _add_index(bind, "ix_voa_status_applied", "voa_applications", ["status", "applied_at"])
        _add_index(bind, "ix_voa_applied", "voa_applications", ["applied_at"])

    if _has_table(bind, "users"):
        _add_index(bind, "ix_users_role", "users", ["role"])
        _add_index(bind, "ix_users_is_active", "users", ["is_active"])

    if _has_table(bind, "counters"):
        _add_index(bind, "ix_counters_status", "counters", ["status"])

    # ── New security tables ──────────────────────────────────────────────────
    if not _has_table(bind, "refresh_tokens"):
        op.create_table(
            "refresh_tokens",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("replaced_by_hash", sa.String(128), nullable=True),
            sa.Column("user_agent", sa.String(256), nullable=True),
            sa.Column("ip_address", sa.String(45), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        _add_index(bind, "ix_refresh_user", "refresh_tokens", ["user_id"])
        _add_index(bind, "ix_refresh_expires", "refresh_tokens", ["expires_at"])
        _add_index(bind, "ix_refresh_token_hash", "refresh_tokens", ["token_hash"], unique=True)

    if not _has_table(bind, "login_attempts"):
        op.create_table(
            "login_attempts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("ip_address", sa.String(45), nullable=False),
            sa.Column("username", sa.String(64), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        _add_index(bind, "ix_login_ip_created", "login_attempts", ["ip_address", "created_at"])
        _add_index(bind, "ix_login_user_created", "login_attempts", ["username", "created_at"])
        _add_index(bind, "ix_login_created", "login_attempts", ["created_at"])

    if not _has_table(bind, "notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("type", sa.String(64), nullable=False),
            sa.Column("title", sa.String(160), nullable=False),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("severity", sa.String(16), nullable=False, server_default="info"),
            sa.Column("payload", sa.Text(), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("target_type", sa.String(64), nullable=True),
            sa.Column("target_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        _add_index(
            bind,
            "ix_notifications_user_read",
            "notifications",
            ["user_id", "is_read", "created_at"],
        )


def downgrade() -> None:
    # Intentionally no destructive downgrade for production safety.
    pass
