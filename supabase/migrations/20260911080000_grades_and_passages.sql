-- 5-6. sınıf desteği: mevcut kurulu DB'lerdeki grade check'lerini ada bakmadan genişlet.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.oid, n.nspname AS schema_name, t.relname AS table_name, c.conname AS con_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'c'
      AND n.nspname = 'public'
      AND t.relname IN ('classes', 'question_bank', 'tests', 'reading_assignments')
      AND pg_get_constraintdef(c.oid) ILIKE '%grade%between 1 and 4%'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.schema_name, r.table_name, r.con_name);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (grade BETWEEN 1 AND 6)', r.schema_name, r.table_name, r.con_name);
  END LOOP;
END $$;

-- Okuma kütüphanesi: öğretmen metni bir kez kaydeder, atamalarda anlık kopyasını gönderir.
create table if not exists public.reading_passages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  source_label text not null default '',
  image text not null default '',
  body text not null check (char_length(trim(body)) between 50 and 20000),
  grade smallint not null check (grade between 1 and 6),
  subject text not null check (subject in ('matematik', 'geometri', 'turkce')),
  topic text not null default 'okuma-anlama' check (char_length(trim(topic)) > 0),
  quiz_threshold integer not null default 60 check (quiz_threshold between 0 and 100),
  show_passage_during_quiz boolean not null default true,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(questions) = 'array'),
  unique (teacher_id, title)
);

create index if not exists reading_passages_teacher_id_idx on public.reading_passages (teacher_id);

alter table public.reading_passages enable row level security;

drop policy if exists reading_passages_teacher_all on public.reading_passages;
create policy reading_passages_teacher_all on public.reading_passages
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());
