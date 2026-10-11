-- Hızlı kelime akışı (RSVP) okuma modu.
--
-- static → metin sabit; kanıt: dwell (süre) + kaydırma + quiz (mevcut davranış)
-- rsvp   → metin kelime kelime sabit hızda akar; kanıt: akışın sonuna kadar
--          izlenmesi + quiz. Hız öğretmen tarafından belirlenir:
--          rsvp_seconds_per_word = kelime başına ekranda kalma süresi (sn).
--
-- Akış modunda metin quiz sırasında gösterilmez ve kelime görseli (metin görseli)
-- çizilmez; ikisi de ölçümü bozar. Uygulama tarafı bunu normalizeReading'de zorlar.

alter table public.reading_assignments
  add column if not exists display_mode text not null default 'static'
    check (display_mode in ('static', 'rsvp'));

alter table public.reading_assignments
  add column if not exists rsvp_seconds_per_word numeric(4,2) not null default 0.80
    check (rsvp_seconds_per_word between 0.10 and 5.00);

alter table public.reading_passages
  add column if not exists display_mode text not null default 'static'
    check (display_mode in ('static', 'rsvp'));

alter table public.reading_passages
  add column if not exists rsvp_seconds_per_word numeric(4,2) not null default 0.80
    check (rsvp_seconds_per_word between 0.10 and 5.00);

-- Akış kaç kez izlendi: 1 = tek sefer (ölçüm en güçlü), >1 = öğrenci tekrar izledi.
alter table public.reading_attempts
  add column if not exists rsvp_plays integer not null default 0
    check (rsvp_plays >= 0);

-- Puan kapısı artık mod farkındalıklı. Akış modunda dwell süresi kelime sayısından
-- değil öğretmenin seçtiği hızdan gelir; required_dwell_seconds (150 kelime/dk)
-- uygulanırsa hızlı ayarlarda tamamlanmış okuma sessizce 0 puan kazanır.
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
  v_display_mode text;
  v_score integer;
  v_amount integer;
  v_balance integer;
  v_gate boolean;
begin
  if new.student_id is null then
    return new;
  end if;

  select r.quiz_threshold, r.title, r.body, coalesce(r.display_mode, 'static')
    into v_threshold, v_title, v_body, v_display_mode
    from public.reading_assignments r
   where r.id = new.reading_assignment_id;

  -- reading_attempts yanıtları saklamaz (answers kolonu yok) — quiz skoru kayıtlı
  -- değerdendir (BL-1 kapsamı); quizzesiz okumada istemci %100 yazar.
  v_score := coalesce(new.score_percent, 0);

  -- read kapısı domain evaluateReadingGates ile birebir.
  if v_display_mode = 'rsvp' then
    v_gate := new.scrolled_bottom = true and v_score >= coalesce(v_threshold, 60);
  else
    v_gate := new.dwell_seconds >= public.required_dwell_seconds(v_body)
      and new.scrolled_bottom = true
      and v_score >= coalesce(v_threshold, 60);
  end if;

  if not v_gate then
    return new; -- tamamlanmayan okuma puan kazanmaz
  end if;

  v_amount := least(12, greatest(1, 3 + round(v_score * 0.08)::integer));

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
