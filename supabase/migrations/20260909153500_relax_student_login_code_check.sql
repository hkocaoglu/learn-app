-- Student login codes are generated from the school number and name initials.
-- Existing projects created with the initial schema need the same constraint update.

alter table public.students
  drop constraint if exists students_login_code_check;

alter table public.students
  add constraint students_login_code_check
  check (char_length(trim(login_code)) between 3 and 80);
