-- Atama bazlı puan ve başarı eşiği + günlük deneme hakkı.
--
-- Kararlar (kullanıcı, 2026-10-11):
--   1) Öğretmen, yayınlarken her testin/okumanın KAÇ PUAN olduğunu belirler.
--   2) Başarı eşiği geçilemezse HİÇ puan alınmaz (eşik altı = 0).
--   3) Eşiği geçen öğrenci, öğretmenin verdiği puanın başarısı oranında kısmını alır:
--        puan = max(1, round(puan × skor / 100))
--   4) Sınav tamamlandıktan sonra TEKRAR DENEME YOK. Yalnızca başarı eşiğinin ALTINDA
--      kalan sınavlarda günde daily_attempts (varsayılan 2) deneme hakkı vardır; bu
--      haklar her yeni günde (Europe/Istanbul) yeniden aktif olur.
--   5) Okumalarda tek deneme kuralı korunur (reading_attempts unique); eşik zaten var.

-- ---------- 1) kolonlar ----------
alter table public.assignments
  add column if not exists points integer not null default 20
    check (points between 1 and 100),
  add column if not exists pass_threshold integer not null default 60
    check (pass_threshold between 0 and 100),
  add column if not exists daily_attempts smallint not null default 2
    check (daily_attempts between 1 and 5);

comment on column public.assignments.points is 'Testin toplam puanı (eşik geçilirse oranlı verilir).';
comment on column public.assignments.pass_threshold is 'Başarı eşiği (%). Altında puan verilmez.';
comment on column public.assignments.daily_attempts is 'Eşik altında kalırken günde kaç deneme hakkı.';

alter table public.reading_assignments
  add column if not exists points integer not null default 10
    check (points between 1 and 100);

comment on column public.reading_assignments.points is 'Okumanın toplam puanı (quiz eşiği geçilirse oranlı).';

-- ---------- 2) ikinci denemeye izin ver: tek deneme kısıtını kaldır ----------
do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'public.attempts'::regclass
     and contype = 'u'
     and conname = 'attempts_assignment_id_student_id_key';
  if v_name is not null then
    execute format('alter table public.attempts drop constraint %I', v_name);
    raise notice 'attempts tek-deneme kısıtı kaldırıldı: %', v_name;
  end if;
end $$;

create index if not exists attempts_assignment_student_idx
  on public.attempts (assignment_id, student_id, created_at desc);

-- ---------- 3) deneme hakkı denetimi (RLS bunu kullanır) ----------
-- Kural: yayınlanmış + kendi sınıfı + eşik henüz geçilmemiş + günlük kota dolmamış.
create or replace function public.attempt_allowed(p_assignment_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student uuid := public.current_student_id();
  v_class uuid;
  v_published boolean;
  v_threshold integer;
  v_daily integer;
  v_today integer;
begin
  if v_student is null then
    return false;
  end if;

  select a.class_id, a.published, a.pass_threshold, a.daily_attempts
    into v_class, v_published, v_threshold, v_daily
    from public.assignments a
   where a.id = p_assignment_id;

  if v_class is null or v_published is not true then
    return false;
  end if;

  -- öğrenci bu sınıfın aktif öğrencisi mi
  if not exists (
    select 1 from public.students s
     where s.id = v_student and s.class_id = v_class and s.status = 'active'
  ) then
    return false;
  end if;

  -- başarı eşiği geçildiyse yeni deneme hakkı yok
  if exists (
    select 1 from public.attempts at
     where at.assignment_id = p_assignment_id
       and at.student_id = v_student
       and at.score_percent >= coalesce(v_threshold, 60)
  ) then
    return false;
  end if;

  -- bugün kullanılan deneme sayısı (Europe/Istanbul günü)
  select count(*) into v_today
    from public.attempts at
   where at.assignment_id = p_assignment_id
     and at.student_id = v_student
     and (at.created_at at time zone 'Europe/Istanbul')::date
         = (now() at time zone 'Europe/Istanbul')::date;

  return v_today < coalesce(v_daily, 2);
end;
$$;

-- ---------- 4) RLS: deneme hakkı sunucuda denetlenir ----------
drop policy if exists attempts_student_insert on public.attempts;
create policy attempts_student_insert on public.attempts
for insert with check (
  student_id = public.current_student_id()
  and public.attempt_allowed(assignment_id)
);

-- ---------- 5) sınav kazanımı: eşik + oranlı puan ----------
create or replace function public.award_attempt_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
  v_questions jsonb;
  v_title text;
  v_points integer;
  v_threshold integer;
  v_score integer;
  v_amount integer;
  v_balance integer;
begin
  if new.student_id is null then
    return new;
  end if;

  select t.id, t.questions, t.title, a.points, a.pass_threshold
    into v_test_id, v_questions, v_title, v_points, v_threshold
    from public.assignments a
    join public.tests t on t.id = a.test_id
   where a.id = new.assignment_id;

  -- atama silinmişse kayıtlı değere düşülür; puan varsayılanları korunur
  v_points := coalesce(v_points, 20);
  v_threshold := coalesce(v_threshold, 60);

  if v_questions is null then
    v_score := new.score_percent;
  else
    v_score := coalesce(public.recompute_attempt_score(v_questions, new.answers), 0);
  end if;

  -- Başarı eşiği geçilemediyse hiç puan verilmez.
  if v_score < v_threshold then
    return new;
  end if;

  -- Öğretmenin verdiği puanın, başarı oranındaki kısmı.
  v_amount := greatest(1, round(v_points * v_score / 100.0)::integer);

  -- Aynı öğrencinin eşzamanlı puan yazımlarını sırala (bakiye tutarlılığı).
  perform 1 from public.students where id = new.student_id for update;

  if exists (
    select 1 from public.point_transactions
     where student_id = new.student_id
       and ref_type = 'exam'
       and ref_id = coalesce(v_test_id, new.assignment_id)
  ) then
    return new; -- idempotent: aynı test ikinci kez puanlanmaz
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.point_transactions
   where student_id = new.student_id;

  insert into public.point_transactions
    (teacher_id, student_id, kind, source, ref_type, ref_id, amount, label, balance_after)
  values
    (new.teacher_id, new.student_id, 'earn', 'exam', 'exam', coalesce(v_test_id, new.assignment_id),
     v_amount, 'Sınav: ' || coalesce(v_title, 'Test') || ' (%' || v_score || ')', v_balance + v_amount);

  return new;
end;
$$;

drop trigger if exists attempts_award_points on public.attempts;
create trigger attempts_award_points
after insert on public.attempts
for each row execute function public.award_attempt_points();

-- ---------- 6) okuma kazanımı: eşik (quiz_threshold) + oranlı puan ----------
create or replace function public.award_reading_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_threshold integer;
  v_title text;
  v_body text;
  v_points integer;
  v_display_mode text;
  v_score integer;
  v_amount integer;
  v_balance integer;
  v_gate boolean;
begin
  if new.student_id is null then
    return new;
  end if;

  select r.quiz_threshold, r.title, r.body, coalesce(r.points, 10), coalesce(r.display_mode, 'static')
    into v_threshold, v_title, v_body, v_points, v_display_mode
    from public.reading_assignments r
   where r.id = new.reading_assignment_id;

  v_points := coalesce(v_points, 10);
  v_threshold := coalesce(v_threshold, 60);

  -- reading_attempts yanıtları saklamaz (answers kolonu yok) — quiz skoru kayıtlı
  -- değerdendir (BL-1 kapsamı); quizzesiz okumada istemci %100 yazar.
  v_score := coalesce(new.score_percent, 0);

  -- read kapısı domain evaluateReadingGates ile birebir.
  if v_display_mode = 'rsvp' then
    v_gate := new.scrolled_bottom = true and v_score >= v_threshold;
  else
    v_gate := new.dwell_seconds >= public.required_dwell_seconds(v_body)
      and new.scrolled_bottom = true
      and v_score >= v_threshold;
  end if;

  if not v_gate then
    return new; -- tamamlanmayan/eşik altı okuma puan kazanmaz
  end if;

  v_amount := greatest(1, round(v_points * v_score / 100.0)::integer);

  perform 1 from public.students where id = new.student_id for update;

  if exists (
    select 1 from public.point_transactions
     where student_id = new.student_id
       and ref_type = 'reading'
       and ref_id = new.reading_assignment_id
  ) then
    return new; -- idempotent
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.point_transactions
   where student_id = new.student_id;

  insert into public.point_transactions
    (teacher_id, student_id, kind, source, ref_type, ref_id, amount, label, balance_after)
  values
    (new.teacher_id, new.student_id, 'earn', 'reading', 'reading', new.reading_assignment_id,
     v_amount, 'Okuma: ' || coalesce(v_title, 'Okuma'), v_balance + v_amount);

  return new;
end;
$$;

drop trigger if exists reading_attempts_award_points on public.reading_attempts;
create trigger reading_attempts_award_points
after insert on public.reading_attempts
for each row execute function public.award_reading_points();
