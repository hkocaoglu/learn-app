-- Allow teachers to share question-bank entries without granting edit/delete access.

alter table public.question_bank
  add column if not exists is_shared boolean not null default false;

drop policy if exists question_bank_teacher_all on public.question_bank;
create policy question_bank_teacher_all on public.question_bank
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists question_bank_shared_read on public.question_bank;
create policy question_bank_shared_read on public.question_bank
for select using (is_shared = true and public.is_teacher());

drop policy if exists attempts_teacher_insert on public.attempts;
create policy attempts_teacher_insert on public.attempts
for insert with check (
  teacher_id = auth.uid()
  and public.is_teacher()
);

drop policy if exists attempts_teacher_delete on public.attempts;
create policy attempts_teacher_delete on public.attempts
for delete using (teacher_id = auth.uid() and public.is_teacher());
