-- Extensions required by kg-core.
-- citext: case-insensitive text for emails.
-- pgcrypto: gen_random_uuid() (core in PG13+, extension kept for parity with hosted Supabase).
create extension if not exists citext;
create extension if not exists pgcrypto;
