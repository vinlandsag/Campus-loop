-- Migration: 20260910225000_phase5_add_waitlist_status_enum.sql
-- Description: Phase 5 enum expansion: commit waitlisted and checked_in status values before dependent schema objects are created.

-- In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be executed in the same transaction block
-- as queries, indexes, or functions that reference the new enum value.
-- This migration runs in its own transaction block and commits the new enum values first.

ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'waitlisted';
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'checked_in';
