"""row level security (deny all) on every table; shared rate-limit counter

Revision ID: a7e3c91d4b05
Revises: f6d2b8a4c1e7
Create Date: 2026-10-02 12:00:00

Hand-written.

Supabase exposes every `public` table through its auto-generated Data API,
reachable with the (public) anon key. Enabling RLS with no policies makes the
tables unreadable and unwritable through that API. The backend and the
Next.js server connect as the `postgres` role, which bypasses RLS, so nothing
else changes. New tables created later need the same ALTER (see
documents/25-SUPABASE-MIGRATION-PLAN.md).

rate_limit_hits/hit_rate_limit() replace the in-process limiter so limits hold
across serverless instances. Fixed window per (key, window), one atomic upsert.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "a7e3c91d4b05"
down_revision: Union[str, None] = "f6d2b8a4c1e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE rate_limit_hits (
            key text NOT NULL,
            window_start timestamptz NOT NULL,
            hits integer NOT NULL DEFAULT 0,
            PRIMARY KEY (key, window_start)
        )
        """
    )
    op.execute(
        """
        CREATE FUNCTION hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
        RETURNS boolean
        LANGUAGE plpgsql
        AS $$
        DECLARE
            w timestamptz := to_timestamp(
                floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
            );
            h integer;
        BEGIN
            INSERT INTO rate_limit_hits AS r (key, window_start, hits)
            VALUES (p_key, w, 1)
            ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
            RETURNING r.hits INTO h;

            -- Opportunistic cleanup keeps the table small without a cron job.
            IF random() < 0.01 THEN
                DELETE FROM rate_limit_hits WHERE window_start < now() - interval '1 day';
            END IF;
            RETURN h <= p_limit;
        END
        $$
        """
    )
    op.execute(
        """
        DO $$
        DECLARE t record;
        BEGIN
            FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
            END LOOP;

            -- Supabase-only roles; absent on a plain local Postgres.
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                REVOKE EXECUTE ON FUNCTION hit_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
            END IF;
        END
        $$
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE t record;
        BEGIN
            FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
                EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
            END LOOP;
        END
        $$
        """
    )
    op.execute("DROP FUNCTION hit_rate_limit(text, integer, integer)")
    op.execute("DROP TABLE rate_limit_hits")
