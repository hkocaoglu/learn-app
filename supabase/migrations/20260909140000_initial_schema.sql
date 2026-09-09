-- Sınıf Test cloud schema.
-- Run this migration in Supabase SQL Editor or with the Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role = 'teacher'),
  full_name text not null,
  school_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  grade smallint not null check (grade between 1 and 4),
  school_year text,
  created_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  school_number text not null check (char_length(trim(school_number)) between 1 and 40),
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  login_code text not null check (char_length(trim(login_code)) between 3 and 80),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, school_number)
);

create unique index if not exists students_login_code_lower_idx
  on public.students (lower(login_code));

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  grade smallint not null check (grade between 1 and 4),
  subject text not null check (subject in ('matematik', 'geometri', 'turkce')),
  topic text not null check (char_length(trim(topic)) > 0),
  text text not null check (char_length(trim(text)) > 0),
  options jsonb not null default '[]'::jsonb,
  correct_index integer not null check (correct_index >= 0),
  explanation text not null default '',
  image text not null default '',
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array')
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  grade smallint not null check (grade between 1 and 4),
  subject text not null check (subject in ('matematik', 'geometri', 'turkce')),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 240),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(questions) = 'array')
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  max_attempts smallint not null default 1 check (max_attempts between 1 and 3),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  unique (class_id, test_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  correct_count integer not null default 0 check (correct_count >= 0),
  total_count integer not null default 0 check (total_count >= 0),
  score_percent integer not null default 0 check (score_percent between 0 and 100),
  total_seconds integer not null default 0 check (total_seconds >= 0),
  time_up boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index if not exists classes_teacher_id_idx on public.classes (teacher_id);
create index if not exists students_teacher_id_idx on public.students (teacher_id);
create index if not exists students_class_id_idx on public.students (class_id);
create index if not exists question_bank_teacher_id_idx on public.question_bank (teacher_id);
create index if not exists tests_teacher_id_idx on public.tests (teacher_id);
create index if not exists assignments_teacher_id_idx on public.assignments (teacher_id);
create index if not exists assignments_class_id_idx on public.assignments (class_id);
create index if not exists attempts_teacher_id_idx on public.attempts (teacher_id);
create index if not exists attempts_student_id_idx on public.attempts (student_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists question_bank_set_updated_at on public.question_bank;
create trigger question_bank_set_updated_at
before update on public.question_bank
for each row execute function public.set_updated_at();

drop trigger if exists tests_set_updated_at on public.tests;
create trigger tests_set_updated_at
before update on public.tests
for each row execute function public.set_updated_at();

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.students
  where auth_user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.validate_student_class_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.classes
    where id = new.class_id and teacher_id = new.teacher_id
  ) then
    raise exception 'Student class must belong to the same teacher';
  end if;
  return new;
end;
$$;

drop trigger if exists students_validate_class_owner on public.students;
create trigger students_validate_class_owner
before insert or update on public.students
for each row execute function public.validate_student_class_owner();

create or replace function public.validate_assignment_owner()
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
    raise exception 'Assignment class must belong to the same teacher';
  end if;

  if not exists (
    select 1 from public.tests
    where id = new.test_id and teacher_id = new.teacher_id
  ) then
    raise exception 'Assignment test must belong to the same teacher';
  end if;

  if not exists (
    select 1
    from public.tests
    where id = new.test_id
      and jsonb_typeof(questions) = 'array'
      and jsonb_array_length(questions) > 0
  ) then
    raise exception 'Assignment test must contain at least one question';
  end if;

  return new;
end;
$$;

drop trigger if exists assignments_validate_owner on public.assignments;
create trigger assignments_validate_owner
before insert or update on public.assignments
for each row execute function public.validate_assignment_owner();

create or replace function public.validate_attempt_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.assignments a
    join public.students s on s.class_id = a.class_id
    where a.id = new.assignment_id
      and a.teacher_id = new.teacher_id
      and s.id = new.student_id
      and s.teacher_id = new.teacher_id
  ) then
    raise exception 'Attempt assignment and student ownership do not match';
  end if;
  return new;
end;
$$;

drop trigger if exists attempts_validate_owner on public.attempts;
create trigger attempts_validate_owner
before insert or update on public.attempts
for each row execute function public.validate_attempt_owner();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'role', 'teacher') = 'teacher' then
    insert into public.profiles (id, full_name, school_name)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Öğretmen'),
      nullif(trim(new.raw_user_meta_data ->> 'school_name'), '')
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.question_bank enable row level security;
alter table public.tests enable row level security;
alter table public.assignments enable row level security;
alter table public.attempts enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists classes_teacher_all on public.classes;
create policy classes_teacher_all on public.classes
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists classes_student_read on public.classes;
create policy classes_student_read on public.classes
for select using (
  id in (
    select class_id from public.students where auth_user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists students_teacher_all on public.students;
create policy students_teacher_all on public.students
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists students_student_read_own on public.students;
create policy students_student_read_own on public.students
for select using (auth_user_id = auth.uid());

drop policy if exists question_bank_teacher_all on public.question_bank;
create policy question_bank_teacher_all on public.question_bank
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists question_bank_shared_read on public.question_bank;
create policy question_bank_shared_read on public.question_bank
for select using (is_shared = true and public.is_teacher());

drop policy if exists tests_teacher_all on public.tests;
create policy tests_teacher_all on public.tests
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists tests_student_read_assigned on public.tests;
create policy tests_student_read_assigned on public.tests
for select using (
  exists (
    select 1
    from public.assignments a
    where a.test_id = tests.id
      and a.published = true
      and a.class_id in (
        select class_id from public.students where auth_user_id = auth.uid() and status = 'active'
      )
  )
);

drop policy if exists assignments_teacher_all on public.assignments;
create policy assignments_teacher_all on public.assignments
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists assignments_student_read_assigned on public.assignments;
create policy assignments_student_read_assigned on public.assignments
for select using (
  published = true
  and class_id in (
    select class_id from public.students where auth_user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists attempts_teacher_read on public.attempts;
create policy attempts_teacher_read on public.attempts
for select using (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists attempts_teacher_insert on public.attempts;
create policy attempts_teacher_insert on public.attempts
for insert with check (
  teacher_id = auth.uid()
  and public.is_teacher()
);

drop policy if exists attempts_teacher_delete on public.attempts;
create policy attempts_teacher_delete on public.attempts
for delete using (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists attempts_student_own on public.attempts;
create policy attempts_student_own on public.attempts
for select using (student_id = public.current_student_id());

drop policy if exists attempts_student_insert on public.attempts;
create policy attempts_student_insert on public.attempts
for insert with check (
  student_id = public.current_student_id()
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.published = true
      and a.class_id in (
        select class_id from public.students where id = public.current_student_id()
      )
  )
);
