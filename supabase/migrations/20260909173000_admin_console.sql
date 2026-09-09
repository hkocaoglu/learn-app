-- Admin rolü, admin görünürlüğü ve rol yükseltme koruması.
-- Önce bir Auth hesabı oluşturup aşağıdaki README adımlarıyla profiles.role = 'admin' yapın.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('teacher', 'admin'));

alter table public.profiles
  add column if not exists email text;

update public.profiles as profiles
set email = auth_users.email
from auth.users as auth_users
where profiles.id = auth_users.id
  and (profiles.email is null or profiles.email <> auth_users.email);

create index if not exists profiles_role_idx on public.profiles (role);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role not in ('teacher', 'admin') then
    raise exception 'Profile role is invalid';
  end if;

  -- Authenticated clients cannot promote themselves or another account.
  -- SQL Editor/service-role migrations have no auth.uid() and may perform promotion.
  if old.role is distinct from new.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change profile roles';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Student Auth accounts are represented in students, not profiles.
  -- Every other account starts as a teacher; admin promotion is an explicit
  -- SQL/service-role operation and cannot be requested from public signup metadata.
  if coalesce(new.raw_user_meta_data ->> 'role', 'teacher') <> 'student' then
    insert into public.profiles (id, role, email, full_name, school_name)
    values (
      new.id,
      'teacher',
      new.email,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Öğretmen'),
      nullif(trim(new.raw_user_meta_data ->> 'school_name'), '')
    )
    on conflict (id) do update
      set email = excluded.email;
  end if;
  return new;
end;
$$;

drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles
for select using (public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists classes_admin_select on public.classes;
create policy classes_admin_select on public.classes
for select using (public.is_admin());

drop policy if exists students_admin_select on public.students;
create policy students_admin_select on public.students
for select using (public.is_admin());

drop policy if exists question_bank_admin_select on public.question_bank;
create policy question_bank_admin_select on public.question_bank
for select using (public.is_admin());

drop policy if exists tests_admin_select on public.tests;
create policy tests_admin_select on public.tests
for select using (public.is_admin());

drop policy if exists assignments_admin_select on public.assignments;
create policy assignments_admin_select on public.assignments
for select using (public.is_admin());

drop policy if exists attempts_admin_select on public.attempts;
create policy attempts_admin_select on public.attempts
for select using (public.is_admin());
