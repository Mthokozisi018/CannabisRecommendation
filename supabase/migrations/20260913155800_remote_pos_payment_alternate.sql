-- Applied in production before this checkout. Its tender fields, constraint,
-- v3 sale function, and indexes overlap 20260909122435. That earlier local
-- migration now reconciles the missing payment_status column idempotently.
-- This marker preserves the authoritative remote version without replaying it.
select 1;
