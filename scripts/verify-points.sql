-- Puan sistemi işlevsel testi — stub'lu Supabase ortamında çalıştırılır.
-- Her OK satarı bir doğrulamadır; herhangi bir başarısızlık exception fırlatır.
\set ON_ERROR_STOP on

-- ============ veri kurulumu (superuser, RLS bypass) ============
insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '{"role":"teacher","full_name":"Öğretmen Bir"}'),
  ('22222222-2222-2222-2222-222222222222', '{"role":"teacher","full_name":"Öğretmen İki"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"role":"student"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"role":"student"}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '{"role":"student"}');

insert into public.classes (id, teacher_id, name, grade) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '5-A', 5),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '4-A', 4);

insert into public.students (id, teacher_id, class_id, school_number, first_name, last_name, login_code, auth_user_id, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '101', 'Ayşe', 'A', '101a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '102', 'Bora', 'B', '102b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', '201', 'Derya', 'D', '201d', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'active');

insert into public.tests (id, teacher_id, title, grade, subject, questions) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Hazır Sınav', 5, 'matematik',
   '[{"id":"q1","text":"1+1?","options":["2","3"],"correctIndex":0,"topic":"toplama","subject":"matematik"},
     {"id":"q2","text":"2+2?","options":["5","4"],"correctIndex":1,"topic":"toplama","subject":"matematik"}]'::jsonb);

insert into public.assignments (id, teacher_id, class_id, test_id, published) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);

insert into public.reading_assignments (id, teacher_id, class_id, title, source_label, body, grade, subject, topic, quiz_threshold, published, questions) values
  ('f0000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
   'Kırlangıç', 'Dergi',
   'Bir bahar günü kırlangıçlar göç yolculuğuna çıkar. Güneş göl kenarında parlar. Çocuklar koşarak oynar. Kuşlar yüksekten süzülür. Rüzgar saçları okşar.',
   5, 'turkce', 'okuma-anlama', 60, true,
   '[{"id":"rq1","text":"Kuşlar nereye gider?","options":["Göç","Uyku"],"correctIndex":0},
     {"id":"rq2","text":"Mevsim nedir?","options":["Kış","Bahar"],"correctIndex":1}]'::jsonb);

-- sınıf bazlı ödül havuzları
insert into public.rewards (id, teacher_id, class_id, name, icon, cost, quantity, description) values
  ('f0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Kırmızı kalem', 'pen', 10, 2, 'İlk 10 öğrenci'),
  ('f0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Kutu oyunu', 'dice', 100, 1, 'Büyük ödül'),
  ('f0000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Silgi', 'eraser', 5, 5, 'Sadece 4. sınıf');

-- Supabase varsayılan yetkileri (PostgREST authenticated rolü)
grant usage on schema auth to authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function auth.uid() to authenticated;

-- ============ TEST 1: yetkili skorlama (tamat: istemci 100 dese de puan yanlıştan) ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;

-- A: SAHTE %100 (tüm cevaplar yanlış), süre dolmadı → yetkili skor %0 → 5+0+5 = 10 puan
insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
values ('f1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '[{"questionId":"q1","selected":1},{"questionId":"q2","selected":0}]'::jsonb,
        10, 2, 100, 30, false, now());

do $$
declare v_amount int; v_label text; v_bal int;
begin
  select amount, label, balance_after into v_amount, v_label, v_bal
    from point_transactions where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and ref_type = 'exam';
  if v_amount is distinct from 10 then raise exception 'TEST FAIL: sahte %%100 için yetkili puan 10 olmalı, çıktı: %', v_amount; end if;
  if v_label is distinct from 'Sınav: Hazır Sınav (%0)' then raise exception 'TEST FAIL: etiket: %', v_label; end if;
  if v_bal is distinct from 10 then raise exception 'TEST FAIL: balance_after: %', v_bal; end if;
  raise notice 'OK: yetkili skorlama — sahte %%100 istemciye rağmen 10 puan (%%0) verildi';
end $$;

-- istemci ledger'a doğrudan yazamaz
do $$
begin
  begin
    insert into point_transactions (teacher_id, student_id, kind, source, amount, label)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'earn', 'exam', 999, 'kendi kendine');
    raise exception 'TEST FAIL: istemci point_transactions yazabildi';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: istemci point_transactions''a yazamaz (%)', sqlerrm;
  end;
end $$;
reset role;

-- ============ TEST 2: idempotent kazanım (sil + yeniden deneme puan üretmez) ============
delete from public.attempts where id = 'f1000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
values ('f1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '[{"questionId":"q1","selected":1},{"questionId":"q2","selected":0}]'::jsonb,
        10, 2, 100, 30, false, now());
reset role;

do $$
declare v_count int;
begin
  select count(*) into v_count from point_transactions
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and ref_type = 'exam';
  if v_count is distinct from 1 then raise exception 'TEST FAIL: ikinci deneme puan üretti (%)', v_count; end if;
  raise notice 'OK: idempotent kazanım — silinip yeniden çözülen sınav ikinci kez puan vermedi';
end $$;

-- ============ TEST 3: doğru cevaplayan öğrenci tam puan alır ============
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
set role authenticated;
insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
values ('f1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '[{"questionId":"q1","selected":0},{"questionId":"q2","selected":1}]'::jsonb,
        2, 2, 100, 60, false, now());
reset role;

do $$
declare v_amount int; v_bal int;
begin
  select amount, balance_after into v_amount, v_bal
    from point_transactions where student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and ref_type = 'exam';
  if v_amount is distinct from 25 then raise exception 'TEST FAIL: tam+puanlı sınav 25 olmalı, çıktı: %', v_amount; end if;
  if v_bal is distinct from 25 then raise exception 'TEST FAIL: B balance_after: %', v_bal; end if;
  raise notice 'OK: tam+dikkatli sınav = 25 puan (5+15+5)';
end $$;

-- ============ TEST 4: okuma kapıları (dwell) ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
-- A: dwell 10sn < gerekli 30sn → puan yok
insert into public.reading_attempts (id, teacher_id, reading_assignment_id, student_id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, submitted_at)
values ('f2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-00000000000f',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 10, false, 0, 2, 0, false, 10, now());
reset role;

do $$
declare v_count int;
begin
  select count(*) into v_count from point_transactions
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and ref_type = 'reading';
  if v_count is distinct from 0 then raise exception 'TEST FAIL: tamamlanmayan okuma puan üretti (%)', v_count; end if;
  raise notice 'OK: tamamlanmayan okuma (dwell eksik) puan üretmez';
end $$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
set role authenticated;
-- B: dwell 45sn + scroll + quiz %100 → 3+8 = 11 puan
insert into public.reading_attempts (id, teacher_id, reading_assignment_id, student_id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, submitted_at)
values ('f2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-00000000000f',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 45, true, 2, 2, 100, true, 45, now());
reset role;

do $$
declare v_amount int; v_bal int;
begin
  select amount, balance_after into v_amount, v_bal
    from point_transactions where student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and ref_type = 'reading';
  if v_amount is distinct from 11 then raise exception 'TEST FAIL: okuma puanı 11 olmalı, çıktı: %', v_amount; end if;
  if v_bal is distinct from 36 then raise exception 'TEST FAIL: B bakiye 36 olmalı, çıktı: %', v_bal; end if;
  raise notice 'OK: tamamlanan okuma = 11 puan, B bakiyesi 36';
end $$;

-- ============ TEST 5: harcama — bakiye, stok, sınıf sınırı ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
do $$
declare v_out jsonb; v_qty int; v_cnt int; v_bal int; v_amt int;
begin
  -- A: tam bakiye (10) ile kalem (10) alır
  v_out := public.redeem_reward('f0000000-0000-0000-0000-000000000010');
  if (v_out ->> 'balance')::int is distinct from 0 then raise exception 'TEST FAIL: A bakiye 0 olmalı: %', v_out; end if;
  select quantity, redemption_count into v_qty, v_cnt from rewards where id = 'f0000000-0000-0000-0000-000000000010';
  if v_qty is distinct from 1 or v_cnt is distinct from 1 then raise exception 'TEST FAIL: stok 1/kayıt 1 olmalı: %/%', v_qty, v_cnt; end if;
  select amount, balance_after into v_amt, v_bal from point_transactions
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and kind = 'spend';
  if v_amt is distinct from -10 or v_bal is distinct from 0 then raise exception 'TEST FAIL: spend satırı -10/balance 0: %/%', v_amt, v_bal; end if;
  raise notice 'OK: harcama — bakiye 10→0, stok 2→1, ledger -10';

  -- A: bakiye 0 ile tekrar alamaz
  begin
    perform public.redeem_reward('f0000000-0000-0000-0000-000000000010');
    raise exception 'TEST FAIL: bakiyesiz harcama kabul edildi';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: yetersiz bakiye reddedildi (%)', sqlerrm;
  end;

  -- A: 4. sınıf ödülünü göremez/satın alamaz
  begin
    perform public.redeem_reward('f0000000-0000-0000-0000-000000000012');
    raise exception 'TEST FAIL: farklı sınıf ödülü satılabilir oldu';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: farklı sınıf ödülü reddedildi (%)', sqlerrm;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
set role authenticated;
do $$
declare v_out jsonb; v_qty int;
begin
  -- B: son kalemi alır (stok biter)
  v_out := public.redeem_reward('f0000000-0000-0000-0000-000000000010');
  if (v_out ->> 'balance')::int is distinct from 26 then raise exception 'TEST FAIL: B bakiye 26 olmalı: %', v_out; end if;
  select quantity into v_qty from rewards where id = 'f0000000-0000-0000-0000-000000000010';
  if v_qty is distinct from 0 then raise exception 'TEST FAIL: stok 0 olmalı: %', v_qty; end if;
  raise notice 'OK: B son kalemi aldı — bakiye 36→26, stok 1→0 (ilk kazanır)';

  -- B: tükenen ödül
  begin
    perform public.redeem_reward('f0000000-0000-0000-0000-000000000010');
    raise exception 'TEST FAIL: tükenen ödül satılabilir oldu';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: tükenen ödül reddedildi (%)', sqlerrm;
  end;
end $$;
reset role;

-- ============ TEST 6: RLS — öğrenci başkasının verisini göremez ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
do $$
declare v_count int; v_bal int;
begin
  -- A yalnızca KENDİ ledger satırlarını görür (kazanım 1 + harcama 1)
  select count(*) into v_count from point_transactions where student_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_count is distinct from 0 then raise exception 'TEST FAIL: A başkasının ledger''ını gördü (%)', v_count; end if;
  -- bakiye çipi sorgusu (son satırın balance_after)
  select balance_after into v_bal from point_transactions order by created_at desc limit 1;
  if v_bal is distinct from 0 then raise exception 'TEST FAIL: A çip bakiyesi 0 olmalı: %', v_bal; end if;
  -- yalnızca kendi sınıfının aktif ödül havuzunu görür
  select count(*) into v_count from rewards;
  if v_count is distinct from 2 then raise exception 'TEST FAIL: A 2 ödül görmeli (kendi sınıfı), çıktı: %', v_count; end if;
  -- başkasının harcamasını göremez
  select count(*) into v_count from reward_redemptions where student_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_count is distinct from 0 then raise exception 'TEST FAIL: A başkasının harcamasını gördü';
  end if;
  -- farklı sınıf ödül hedefi koyamaz
  begin
    insert into save_goals (student_id, reward_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f0000000-0000-0000-0000-000000000012');
    raise exception 'TEST FAIL: farklı sınıf hedefi kabul edildi';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: farklı sınıf ödül hedefi reddedildi';
  end;
  -- kendi hedefini koyabilir
  insert into save_goals (student_id, reward_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f0000000-0000-0000-0000-000000000011');
  raise notice 'OK: RLS — A yalnızca kendi verisini görür/kullanır, kendi sınıfının havuzunu okur';
end $$;
reset role;

-- öğrenci puan düzeltemez
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
do $$
begin
  begin
    perform public.adjust_student_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 500, 'hile');
    raise exception 'TEST FAIL: öğrenci kendi puanını düzeltti';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: öğrenci puan düzeltme reddedildi (%)', sqlerrm;
  end;
end $$;
reset role;

-- ============ TEST 7: öğretmen düzeltmesi + yabancı öğretmen ============
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$
declare v_row public.point_transactions%rowtype;
begin
  v_row := public.adjust_student_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 15, 'Kitap ödülü telafisi');
  if v_row.amount is distinct from 15 or v_row.kind is distinct from 'adjust' then
    raise exception 'TEST FAIL: düzeltme satırı: %/%', v_row.amount, v_row.kind;
  end if;
  raise notice 'OK: öğretmen +15 düzeltme yaptı (A bakiyesi 15)';
end $$;
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$
declare v_count int;
begin
  -- yabancı öğretmen t1'in verisini göremez
  select count(*) into v_count from point_transactions;
  if v_count is distinct from 0 then raise exception 'TEST FAIL: t2 yabancı ledger gördü (%)', v_count; end if;
  select count(*) into v_count from rewards;
  if v_count is distinct from 0 then raise exception 'TEST FAIL: t2 yabancı havuz gördü (%)', v_count; end if;
  begin
    perform public.adjust_student_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -100, 'kötü niyet');
    raise exception 'TEST FAIL: t2 yabancı öğrenciyi düzeltti';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: t2 — yabancı veri görünmez ve düzeltme reddedildi (%)', sqlerrm;
  end;
  raise notice 'OK: RLS — t2 kendi ledger/havuzunu görmez (0 satır)';
end $$;
reset role;

-- ============ TEST 8: bakiye tükenme sonrası zincir ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
do $$
declare v_bal int;
begin
  select balance_after into v_bal from point_transactions order by created_at desc limit 1;
  if v_bal is distinct from 15 then raise exception 'TEST FAIL: A son bakiye 15 olmalı: %', v_bal; end if;
  raise notice 'OK: A zincir bakiyesi = 10 (kazanım) - 10 (harcama) + 15 (düzeltme) = 15';
end $$;
reset role;

-- ============ TEST 9: akış (rsvp) modu puan kapısı ============
-- Akış modunda kanıt "dwell süresi" değil "akışın tamamlanması"dır. Dwell formülü
-- (150 kelime/dk) uygulanırsa hızlı ayarda tamamlanan okuma sessizce 0 puan kazanır.
insert into public.reading_assignments (id, teacher_id, class_id, title, source_label, body, grade, subject, topic, quiz_threshold, published, questions, display_mode, rsvp_seconds_per_word) values
  ('f0000000-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Akış Metni', 'Dergi',
   'Sabah erkenden kalkan çocuk, pencereden dışarı baktı ve gökyüzünün masmavi olduğunu gördü. Kuşlar cıvıldıyordu.',
   4, 'turkce', 'okuma-anlama', 60, true,
   '[{"id":"rq1","text":"Çocuk ne zaman kalktı?","options":["Sabah","Akşam"],"correctIndex":0}]'::jsonb,
   'rsvp', 0.25);

insert into public.reading_assignments (id, teacher_id, class_id, title, source_label, body, grade, subject, topic, quiz_threshold, published, questions, display_mode) values
  ('f0000000-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Yarım Akış', 'Dergi',
   'Bu metnin akışı yarıda kesildi; öğrenci kelimelerin tamamını görmedi.',
   4, 'turkce', 'okuma-anlama', 60, true,
   '[{"id":"rq1","text":"Akış tamamlandı mı?","options":["Hayır","Evet"],"correctIndex":0}]'::jsonb,
   'rsvp');

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false);
set role authenticated;
-- A: dwell 1 sn (gerekli 30 sn'nin çok altında) ama akış tamamlandı + quiz %100 → puan VAR
insert into public.reading_attempts (id, teacher_id, reading_assignment_id, student_id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, rsvp_plays, submitted_at)
values ('f2000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000020',
        'dddddddd-dddd-dddd-dddd-dddddddddddd', 1, true, 1, 1, 100, true, 3, 1, now());
-- B: akış tamamlanmadı (scrolled_bottom=false) → puan YOK
insert into public.reading_attempts (id, teacher_id, reading_assignment_id, student_id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, rsvp_plays, submitted_at)
values ('f2000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000021',
        'dddddddd-dddd-dddd-dddd-dddddddddddd', 1, false, 0, 1, 0, false, 3, 2, now());
reset role;

do $$
declare v_count int; v_amount int; v_bal int; v_plays int;
begin
  select count(*) into v_count from point_transactions
   where student_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and ref_type = 'reading';
  if v_count is distinct from 1 then
    raise exception 'TEST FAIL: rsvp akışı 1 puan satırı üretmeli, çıktı: % (yarım akış puan üretmemeli)', v_count;
  end if;

  select amount, balance_after into v_amount, v_bal from point_transactions
   where student_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and ref_type = 'reading';
  if v_amount is distinct from 11 or v_bal is distinct from 11 then
    raise exception 'TEST FAIL: rsvp puanı 11 / bakiye 11 olmalı, çıktı: %/%', v_amount, v_bal;
  end if;

  select rsvp_plays into v_plays from reading_attempts where id = 'f2000000-0000-0000-0000-000000000010';
  if v_plays is distinct from 1 then raise exception 'TEST FAIL: rsvp_plays kaydedilmedi: %', v_plays; end if;

  raise notice 'OK: rsvp akışı dwell olmadan 11 puan kazandı, yarım akış 0 puan, rsvp_plays=1';
end $$;

select 'TÜM PG TESTLER GEÇTİ' as sonuc;
