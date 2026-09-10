-- Okuma ödevleri: öğretmen sınıfa metin + quiz atar, öğrenci dwell+scroll+quiz ile kanıtlar.
create table if not exists public.reading_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  source_label text not null default '',
  body text not null check (char_length(trim(body)) between 50 and 20000),
  grade smallint not null check (grade between 1 and 4),
  subject text not null check (subject in ('matematik', 'geometri', 'turkce')),
  topic text not null default 'okuma-anlama' check (char_length(trim(topic)) > 0),
  quiz_threshold integer not null default 60 check (quiz_threshold between 0 and 100),
  show_passage_during_quiz boolean not null default true,
  questions jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(questions) = 'array'),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  unique (class_id, title)
);

create table if not exists public.reading_attempts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  reading_assignment_id uuid not null references public.reading_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  dwell_seconds integer not null default 0 check (dwell_seconds >= 0),
  scrolled_bottom boolean not null default false,
  correct_count integer not null default 0 check (correct_count >= 0),
  total_count integer not null default 0 check (total_count >= 0),
  score_percent integer not null default 0 check (score_percent between 0 and 100),
  read boolean not null default false,
  total_seconds integer not null default 0 check (total_seconds >= 0),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reading_assignment_id, student_id)
);

create index if not exists reading_assignments_teacher_id_idx on public.reading_assignments (teacher_id);
create index if not exists reading_assignments_class_id_idx on public.reading_assignments (class_id);
create index if not exists reading_attempts_teacher_id_idx on public.reading_attempts (teacher_id);
create index if not exists reading_attempts_student_id_idx on public.reading_attempts (student_id);
create index if not exists reading_attempts_assignment_id_idx on public.reading_attempts (reading_assignment_id);

create or replace function public.validate_reading_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.classes
    where id = new.class_id and teacher_id = new.teacher_id
  ) then
    raise exception 'Reading class must belong to the same teacher';
  end if;
  return new;
end;
$$;

drop trigger if exists reading_assignments_validate_owner on public.reading_assignments;
create trigger reading_assignments_validate_owner
before insert or update on public.reading_assignments
for each row execute function public.validate_reading_owner();

create or replace function public.validate_reading_attempt_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.reading_assignments a
    join public.students s on s.class_id = a.class_id
    where a.id = new.reading_assignment_id
      and a.teacher_id = new.teacher_id
      and s.id = new.student_id
      and s.teacher_id = new.teacher_id
  ) then
    raise exception 'Reading attempt assignment and student ownership do not match';
  end if;
  return new;
end;
$$;

drop trigger if exists reading_attempts_validate_owner on public.reading_attempts;
create trigger reading_attempts_validate_owner
before insert or update on public.reading_attempts
for each row execute function public.validate_reading_attempt_owner();

alter table public.reading_assignments enable row level security;
alter table public.reading_attempts enable row level security;

drop policy if exists reading_assignments_teacher_all on public.reading_assignments;
create policy reading_assignments_teacher_all on public.reading_assignments
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists reading_assignments_student_read_assigned on public.reading_assignments;
create policy reading_assignments_student_read_assigned on public.reading_assignments
for select using (
  published = true
  and class_id in (
    select class_id from public.students where auth_user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists reading_attempts_teacher_read on public.reading_attempts;
create policy reading_attempts_teacher_read on public.reading_attempts
for select using (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists reading_attempts_teacher_insert on public.reading_attempts;
create policy reading_attempts_teacher_insert on public.reading_attempts
for insert with check (
  teacher_id = auth.uid()
  and public.is_teacher()
);

drop policy if exists reading_attempts_teacher_delete on public.reading_attempts;
create policy reading_attempts_teacher_delete on public.reading_attempts
for delete using (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists reading_attempts_student_own on public.reading_attempts;
create policy reading_attempts_student_own on public.reading_attempts
for select using (student_id = public.current_student_id());

drop policy if exists reading_attempts_student_insert on public.reading_attempts;
create policy reading_attempts_student_insert on public.reading_attempts
for insert with check (
  student_id = public.current_student_id()
  and exists (
    select 1
    from public.reading_assignments a
    where a.id = reading_assignment_id
      and a.published = true
      and a.class_id in (
        select class_id from public.students where id = public.current_student_id()
      )
  )
);
