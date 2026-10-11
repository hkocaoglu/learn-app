-- Puan & ödül sistemi — bkz. docs/points-system.md
-- Kilitlenmiş kararlar: kazanım yalnızca sunucuda (trigger), harcama atomik RPC,
-- sınıf bazlı ödül havuzları, sınırlı stok (ilk kazanır), bakiye yıllar arası taşınır,
-- harcamada öğretmen onayı yoktur.
--
-- Puan formülü domain/points.js ile AYNI kalmalıdır (verify.mjs tarafını test eder):
--   sınav : clamp(5 + round(score * 0.15) + (time_up ? 0 : 5), 1, 30)
--   okuma : read ise clamp(3 + round(score * 0.08), 1, 12), aksi halde 0
-- Not: attempts.score_percent istemciden gelmeye devam eder (BACKLOG BL-1); SINAV
-- puanları bu migration'da yetkili sorulardan YENİDEN hesaplanır. reading_attempts
-- answers kolonu tutmadığı için OKUMA quiz skoru kayıtlı score_percent'ten alınır;
-- her ikisinde de puan yazımı yine yalnızca sunucudadır (trigger).

-- ---------- tablolar ----------

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade, -- sınıf bazlı havuz
  name text not null check (char_length(trim(name)) between 1 and 120),
  icon text not null default 'star' check (char_length(icon) between 1 and 16),
  cost integer not null check (cost >= 1),
  description text not null default '' check (char_length(description) <= 300),
  active boolean not null default true,
  quantity integer not null default 1 check (quantity >= 0), -- KALAN stok (asla sınırsız değil)
  redemption_count integer not null default 0 check (redemption_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists rewards_class_idx on public.rewards (class_id) where active = true;

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null check (kind in ('earn', 'spend', 'adjust')),
  source text not null check (source in ('exam', 'reading', 'catalog', 'manual')),
  ref_type text check (ref_type in ('exam', 'reading', 'catalog')),
  ref_id uuid,
  amount integer not null, -- kazanım >0, harcama <0, düzeltme işaretli
  label text not null default '',
  balance_after integer, -- denormalize koşan toplam; trigger tarafından doğrulanır
  created_at timestamptz not null default now()
);

-- İdempotent kazanım: bir kaynak (sınav/okuma) yalnızca bir kez puanlanır.
create unique index if not exists point_transactions_source_uidx
  on public.point_transactions (student_id, ref_type, ref_id)
  where ref_type is not null and ref_id is not null;

create index if not exists point_transactions_student_idx
  on public.point_transactions (student_id, created_at desc);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  reward_id uuid references public.rewards(id) on delete set null,
  cost integer not null check (cost >= 1), -- anlık maliyet anlık görüntüsü
  redeemed_at timestamptz not null default now()
);

create index if not exists reward_redemptions_student_idx on public.reward_redemptions (student_id, redeemed_at desc);
create index if not exists reward_redemptions_reward_idx on public.reward_redemptions (reward_id);

create table if not exists public.save_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, reward_id)
);

-- ---------- sahiplik doğrulama (mevcut kalıpla aynı) ----------

create or replace function public.validate_reward_owner()
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
    raise exception 'Reward class must belong to the same teacher';
  end if;
  return new;
end;
$$;

drop trigger if exists rewards_validate_owner on public.rewards;
create trigger rewards_validate_owner
before insert or update on public.rewards
for each row execute function public.validate_reward_owner();

-- ---------- puan hesabı yardımcıları ----------

-- Soruları (tests.questions / reading_assignments.questions, camelCase jsonb) ve
-- yanıtları (answers: [{questionId, selected}]) alıp yetkili yüzdelik üretir.
create or replace function public.recompute_attempt_score(p_questions jsonb, p_answers jsonb)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_correct integer := 0;
  v_total integer := 0;
  v_q jsonb;
  v_selected text;
begin
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    return null;
  end if;
  for v_q in select * from jsonb_array_elements(p_questions) loop
    v_total := v_total + 1;
    select e.value ->> 'selected' into v_selected
      from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) e
     where e.value ->> 'questionId' = v_q ->> 'id'
     limit 1;
    if v_selected is not null
      and v_selected ~ '^-?[0-9]+$'
      and coalesce(v_q ->> 'correctIndex', '') ~ '^[0-9]+$'
      and v_selected::integer = (v_q ->> 'correctIndex')::integer then
      v_correct := v_correct + 1;
    end if;
  end loop;
  if v_total = 0 then
    return 0;
  end if;
  return round(v_correct::numeric * 100 / v_total)::integer;
end;
$$;

-- domain/model.js requiredDwellSeconds ile birebir (150 wpm, 30-600 sn arası).
create or replace function public.required_dwell_seconds(p_body text)
returns integer
language sql
immutable
set search_path = public
as $$
  select least(
    600,
    greatest(
      30,
      ceil(
        (case when btrim(coalesce(p_body, '')) = '' then 0
              else array_length(regexp_split_to_array(btrim(p_body), '\s+'), 1) end)
        / 150.0 * 60
      )::integer
    )
  );
$$;

-- ---------- kazanım trigger'ları (sunucu tarafı) ----------

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
  v_score integer;
  v_amount integer;
  v_balance integer;
begin
  if new.student_id is null then
    return new;
  end if;

  select t.id, t.questions, t.title into v_test_id, v_questions, v_title
    from public.assignments a
    join public.tests t on t.id = a.test_id
   where a.id = new.assignment_id;

  if v_questions is null then
    v_score := new.score_percent; -- atama silinmişse kayıt altına düşülür
  else
    v_score := coalesce(public.recompute_attempt_score(v_questions, new.answers), 0);
  end if;

  -- Yetkili skordan puan: 5 + %15 kalite + süre dolmadıysa 5 dikkat, 1..30 arası.
  v_amount := least(
    30,
    greatest(1, 5 + round(v_score * 0.15)::integer + case when new.time_up then 0 else 5 end)
  );

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
  v_score integer;
  v_amount integer;
  v_balance integer;
begin
  if new.student_id is null then
    return new;
  end if;

  select r.quiz_threshold, r.title, r.body
    into v_threshold, v_title, v_body
    from public.reading_assignments r
   where r.id = new.reading_assignment_id;

  -- reading_attempts yanıtları saklamaz (answers kolonu yok) — quiz skoru kayıtlı
  -- değerdendir (BL-1 kapsamı); quizzesiz okumada istemci %100 yazar.
  v_score := coalesce(new.score_percent, 0);

  -- read kapısı: dwell + scroll + quiz — domain evaluateReadingGates ile birebir.
  if not (
    new.dwell_seconds >= public.required_dwell_seconds(v_body)
    and new.scrolled_bottom = true
    and v_score >= coalesce(v_threshold, 60)
  ) then
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

drop trigger if exists reading_attempts_award_points on public.reading_attempts;
create trigger reading_attempts_award_points
after insert on public.reading_attempts
for each row execute function public.award_reading_points();

-- ---------- harcama: atomik, ilk kazanır (redeem_reward) ----------

create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := public.current_student_id();
  v_reward public.rewards%rowtype;
  v_balance integer;
  v_redemption uuid;
begin
  if v_student is null then
    raise exception 'Öğrenci oturumu bulunamadı.';
  end if;

  -- 1) Ödülü kilitle: eşzamanlı talepler sıraya girer (stok asla -1 olmaz).
  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found then
    raise exception 'Ödül bulunamadı.';
  end if;

  if not exists (
    select 1 from public.students
     where id = v_student and class_id = v_reward.class_id and status = 'active'
  ) then
    raise exception 'Bu ödül sınıfınıza ait değil.';
  end if;

  if not v_reward.active then
    raise exception 'Bu ödül artık aktif değil.';
  end if;

  if v_reward.quantity < 1 then
    raise exception 'Bu ödül tükenmiş. İlk kazanan alır — şansınızı bir sonrakinde deneyin.';
  end if;

  -- 2) Öğrenciyi kilitle, sonra bakiyeyi oku: iki sekme yarışı güvenli.
  perform 1 from public.students where id = v_student for update;

  select coalesce(sum(amount), 0) into v_balance
    from public.point_transactions
   where student_id = v_student;

  if v_balance < v_reward.cost then
    raise exception 'Yetersiz puan. Biriktirmeye devam edin (mevcut: %, gerekli: %).', v_balance, v_reward.cost;
  end if;

  -- 3) Hareketler: harcama kaydı → stok düşümü → negatif ledger satırı.
  insert into public.reward_redemptions (teacher_id, student_id, reward_id, cost)
  values (v_reward.teacher_id, v_student, v_reward.id, v_reward.cost)
  returning id into v_redemption;

  update public.rewards
     set quantity = quantity - 1,
         redemption_count = redemption_count + 1
   where id = v_reward.id;

  insert into public.point_transactions
    (teacher_id, student_id, kind, source, ref_type, ref_id, amount, label, balance_after)
  values
    (v_reward.teacher_id, v_student, 'spend', 'catalog', 'catalog', v_redemption,
     -v_reward.cost, 'Ödül: ' || v_reward.name, v_balance - v_reward.cost);

  return jsonb_build_object('redemption_id', v_redemption, 'balance', v_balance - v_reward.cost);
end;
$$;

-- ---------- öğretmen puan düzeltmesi (adjust) ----------

create or replace function public.adjust_student_points(
  p_student_id uuid,
  p_amount integer,
  p_label text default 'Öğretmen düzeltmesi'
)
returns public.point_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher uuid := auth.uid();
  v_balance integer;
  v_row public.point_transactions%rowtype;
begin
  if v_teacher is null or not public.is_teacher() then
    raise exception 'Bu işlem yalnızca öğretmenler içindir.';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'Puan miktarı 0 olamaz.';
  end if;
  if not exists (
    select 1 from public.students where id = p_student_id and teacher_id = v_teacher
  ) then
    raise exception 'Öğrenci size ait değil.';
  end if;

  perform 1 from public.students where id = p_student_id for update;

  select coalesce(sum(amount), 0) into v_balance
    from public.point_transactions
   where student_id = p_student_id;

  insert into public.point_transactions
    (teacher_id, student_id, kind, source, ref_type, ref_id, amount, label, balance_after)
  values
    (v_teacher, p_student_id, 'adjust', 'manual', null, null, p_amount,
     coalesce(nullif(trim(p_label), ''), 'Öğretmen düzeltmesi'), v_balance + p_amount)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------- RLS ----------

alter table public.rewards enable row level security;
alter table public.point_transactions enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.save_goals enable row level security;

-- rewards: öğretmen kendi havuzunu yönetir; öğrenci yalnızca kendi sınıfının aktif ödülünü okur.
drop policy if exists rewards_teacher_all on public.rewards;
create policy rewards_teacher_all on public.rewards
for all using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists rewards_student_read_own_class on public.rewards;
create policy rewards_student_read_own_class on public.rewards
for select using (
  active = true
  and class_id in (
    select class_id from public.students where auth_user_id = auth.uid() and status = 'active'
  )
);

-- point_transactions: salt okunur (yazım yalnızca trigger/RPC — security definer).
drop policy if exists point_transactions_teacher_read on public.point_transactions;
create policy point_transactions_teacher_read on public.point_transactions
for select using (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists point_transactions_student_own on public.point_transactions;
create policy point_transactions_student_own on public.point_transactions
for select using (student_id = public.current_student_id());

-- reward_redemptions: öğretmen kendi öğrencilerini, öğrenci kendi geçmişini okur.
drop policy if exists reward_redemptions_teacher_read on public.reward_redemptions;
create policy reward_redemptions_teacher_read on public.reward_redemptions
for select using (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists reward_redemptions_student_own on public.reward_redemptions;
create policy reward_redemptions_student_own on public.reward_redemptions
for select using (student_id = public.current_student_id());

-- save_goals: öğrenci kendi hedefini yönetir (hedef ödül kendi sınıfından olmalı);
-- öğretmen öğrencilerinin hedeflerini okur.
drop policy if exists save_goals_student_own on public.save_goals;
create policy save_goals_student_own on public.save_goals
for all using (student_id = public.current_student_id())
with check (
  student_id = public.current_student_id()
  and exists (
    select 1 from public.rewards r
     where r.id = reward_id
       and r.class_id in (
         select class_id from public.students where id = public.current_student_id()
       )
  )
);

drop policy if exists save_goals_teacher_read on public.save_goals;
create policy save_goals_teacher_read on public.save_goals
for select using (
  student_id in (select id from public.students where teacher_id = auth.uid() and public.is_teacher())
);
