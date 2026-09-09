-- Prevent publishing or creating assignments for tests without questions.

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
