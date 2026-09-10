-- Okuma quizinde metin görünürlüğü: öğretmen atama sırasında seçer.
alter table public.reading_assignments
  add column if not exists show_passage_during_quiz boolean not null default true;
