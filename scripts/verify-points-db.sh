#!/bin/bash
#
# Summary: Puan sistemi SQL doğrulaması (migration + RLS + tetikleyiciler + RPC)
#
# Usage: {cmd}
#
# Sıfırdan bir scratch veritabanı kurar, Supabase için auth stub'ları oluşturur,
# supabase/migrations/ altındaki TÜM migration'ları sırayla uygular ve
# scripts/verify-points.sql işlevsel testlerini koşturur (17 doğrulama).
# Gereksinim: yerel PostgreSQL 14+ (psql/createdb/dropdb PATH'te olmalı).
# Not: Bu test npm test'ten bağımsızdır; yalnızca veritabanı değişikliklerinde çalıştırın.

set -e
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
cd "$(dirname "$0")/.."

dropdb --if-exists learn_pts_test
createdb learn_pts_test

psql -d learn_pts_test -v ON_ERROR_STOP=1 -q <<'EOF'
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;
EOF

for f in supabase/migrations/*.sql; do
  psql -d learn_pts_test -v ON_ERROR_STOP=1 -q -f "$f" 2>/dev/null || { echo "MIGRATION FAILED: $f"; exit 1; }
done
echo "== all migrations OK =="

psql -d learn_pts_test -v ON_ERROR_STOP=1 -q -f scripts/verify-points.sql
