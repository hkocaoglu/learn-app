-- Puan & deneme hakkı işlevsel testi — stub'lu Supabase ortamında çalıştırılır.
-- Kurallar: eşik altı = 0 puan; eşik üstü = öğretmenin puanı × başarı oranı;
-- eşik geçilmişse tekrar deneme yok; eşik altında günde daily_attempts hak (gün değişince yenilenir).
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

-- 4 soruluk test (her doğru %25 → %25/50/75/100 üretilebilir)
insert into public.tests (id, teacher_id, title, grade, subject, questions) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Hazır Sınav', 5, 'matematik',
   '[{"id":"q1","text":"1+1?","options":["2","3","4","5"],"correctIndex":0,"topic":"toplama","subject":"matematik"},
     {"id":"q2","text":"2+2?","options":["3","4","5","6"],"correctIndex":1,"topic":"toplama","subject":"matematik"},
     {"id":"q3","text":"3+3?","options":["5","6","7","8"],"correctIndex":1,"topic":"toplama","subject":"matematik"},
     {"id":"q4","text":"4+4?","options":["6","7","8","9"],"correctIndex":2,"topic":"toplama","subject":"matematik"}]'::jsonb);

-- atama: 20 puan, eşik %60, günde 2 deneme
insert into public.assignments (id, teacher_id, class_id, test_id, published, points, pass_threshold, daily_attempts) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true, 20, 60, 2);

-- okuma: 10 puan, quiz eşiği %60 (20 kelime → gerekli dwell 30 sn)
insert into public.reading_assignments (id, teacher_id, class_id, title, source_label, body, grade, subject, topic, quiz_threshold, published, points, questions) values
  ('f0000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
   'Kırlangıç', 'Dergi',
   'Bir bahar günü kırlangıçlar göç yolculuğuna çıkar. Güneş göl kenarında parlar. Çocuklar koşarak oynar. Kuşlar yüksekten süzülür.',
   5, 'turkce', 'okuma-anlama', 60, true, 10, '[]'::jsonb);

-- sınıf bazlı ödül havuzları
insert into public.rewards (id, teacher_id, class_id, name, icon, cost, quantity, description) values
  ('f0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Kırmızı kalem', 'pen', 10, 2, 'İlk 10 öğrenci'),
  ('f0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Kutu oyunu', 'dice', 100, 1, 'Büyük ödül'),
  ('f0000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Silgi', 'eraser', 5, 5, 'Sadece 4. sınıf');

grant usage on schema auth to authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function auth.uid() to authenticated;

-- ============ TEST 1: başarı eşiği altı → HİÇ puan yok ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;

-- A: %50 (2/4 doğru) — eşik %60 → puan yok
insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
values ('f1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '[{"questionId":"q1","selected":0},{"questionId":"q2","selected":1},{"questionId":"q3","selected":0},{"questionId":"q4","selected":0}]'::jsonb,
        2, 4, 50, 30, false, now());
reset role;

do $$
declare v_count int;
begin
  select count(*) into v_count from point_transactions
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and ref_type = 'exam';
  if v_count is distinct from 0 then raise exception 'TEST FAIL: eşik altı sınav puan üretti (%)', v_count; end if;
  raise notice 'OK: eşik altı (%%50 < %%60) → hiç puan yok';
end $$;

-- ============ TEST 2: günlük 2 deneme hakkı, 3.'sü engelli ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
-- A: %25 (1/4) — 2. deneme, hâlâ eşik altı
insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
values ('f1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '[{"questionId":"q1","selected":0},{"questionId":"q2","selected":0},{"questionId":"q3","selected":0},{"questionId":"q4","selected":0}]'::jsonb,
        1, 4, 25, 30, false, now());

do $$
begin
  begin
    insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
    values ('f1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '[]'::jsonb, 0, 4, 0, 10, false, now());
    raise exception 'TEST FAIL: günlük hak dolduğu hâlde 3. deneme kabul edildi';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: günlük 2 hak doldu, 3. deneme reddedildi (%)', sqlerrm;
  end;
end $$;
reset role;

do $$
declare v_today int;
begin
  select count(*) into v_today from attempts
   where assignment_id = 'f0000000-0000-0000-0000-000000000001'
     and student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_today is distinct from 2 then raise exception 'TEST FAIL: bugünkü deneme 2 olmalı, çıktı %', v_today; end if;
  raise notice 'OK: iki başarısız deneme kaydedildi (bugün 2/2)';
end $$;

-- ============ TEST 3: gün değişince haklar yenilenir ============
update public.attempts set created_at = created_at - interval '1 day'
 where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
-- A: %75 (3/4) — yeni gün, eşiği geçer → 20 × %75 = 15 puan
insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
values ('f1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '[{"questionId":"q1","selected":0},{"questionId":"q2","selected":1},{"questionId":"q3","selected":1},{"questionId":"q4","selected":0}]'::jsonb,
        3, 4, 75, 30, false, now());
reset role;

do $$
declare v_amount int; v_label text; v_bal int;
begin
  select amount, label, balance_after into v_amount, v_label, v_bal from point_transactions
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and ref_type = 'exam';
  if v_amount is distinct from 15 then raise exception 'TEST FAIL: 20 puanın %%75''i 15 olmalı, çıktı: %', v_amount; end if;
  if v_label is distinct from 'Sınav: Hazır Sınav (%75)' then raise exception 'TEST FAIL: etiket: %', v_label; end if;
  if v_bal is distinct from 15 then raise exception 'TEST FAIL: balance_after: %', v_bal; end if;
  raise notice 'OK: gün yenilendi, eşik geçildi → 20 × %%75 = 15 puan';
end $$;

-- ============ TEST 4: eşik geçildikten sonra tekrar deneme yok ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
do $$
begin
  begin
    insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
    values ('f1000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '[]'::jsonb, 0, 4, 0, 10, false, now());
    raise exception 'TEST FAIL: eşik geçilmiş olmasına rağmen yeni deneme kabul edildi';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: sınav tamamlandıktan sonra tekrar deneme engellendi';
  end;
end $$;
reset role;

-- ============ TEST 5: sınır skorlar ve doğru eşik davranışı (B) ============
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
set role authenticated;
-- B: %100 → 20 puan
insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
values ('f1000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '[{"questionId":"q1","selected":0},{"questionId":"q2","selected":1},{"questionId":"q3","selected":1},{"questionId":"q4","selected":2}]'::jsonb,
        4, 4, 100, 60, false, now());
reset role;

do $$
declare v_amount int;
begin
  select amount into v_amount from point_transactions
   where student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and ref_type = 'exam';
  if v_amount is distinct from 20 then raise exception 'TEST FAIL: tam başarı 20 puan olmalı, çıktı: %', v_amount; end if;
  raise notice 'OK: tam başarı = tam puan (20)';
end $$;

-- ============ TEST 6: okuma puanı — tamamlanmayan 0, oranlı geçen puan ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
-- A: dwell 5 < 30 → tamamlanmadı → puan yok
insert into public.reading_attempts (id, teacher_id, reading_assignment_id, student_id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, submitted_at)
values ('f2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-00000000000f',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5, false, 0, 0, 0, false, 5, now());
reset role;

do $$
declare v_count int;
begin
  select count(*) into v_count from point_transactions
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and ref_type = 'reading';
  if v_count is distinct from 0 then raise exception 'TEST FAIL: tamamlanmayan okuma puan üretti'; end if;
  raise notice 'OK: tamamlanmayan okuma → 0 puan';
end $$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
set role authenticated;
-- B: dwell 45 + scroll + quiz %67 (eşik %60 geçildi?) → 10 × %67 = 7 puan
insert into public.reading_attempts (id, teacher_id, reading_assignment_id, student_id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, submitted_at)
values ('f2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-00000000000f',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 45, true, 0, 0, 67, true, 45, now());
reset role;

do $$
declare v_amount int; v_bal int;
begin
  select amount, balance_after into v_amount, v_bal from point_transactions
   where student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and ref_type = 'reading';
  if v_amount is distinct from 7 then raise exception 'TEST FAIL: 10 puanın %%67''si 7 olmalı, çıktı: %', v_amount; end if;
  if v_bal is distinct from 27 then raise exception 'TEST FAIL: B bakiye 27 olmalı (20+7), çıktı: %', v_bal; end if;
  raise notice 'OK: okuma oranlı puan (10 × %%67 = 7), B bakiyesi 27';
end $$;

-- ============ TEST 7: öğrenci ledger'a yazamaz ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
do $$
begin
  begin
    insert into point_transactions (teacher_id, student_id, kind, source, amount, label)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'earn', 'exam', 999, 'kendi kendine');
    raise exception 'TEST FAIL: istemci ledger''a yazabildi';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: öğrenci ledger''a yazamaz (%)', sqlerrm;
  end;
end $$;
reset role;

-- ============ TEST 8: harcama (bakiye/stok/sınıf) ============
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;
do $$
declare v_out jsonb; v_qty int;
begin
  -- A: 15 puan → kalem (10) → 5 kalır
  v_out := public.redeem_reward('f0000000-0000-0000-0000-000000000010');
  if (v_out ->> 'balance')::int is distinct from 5 then raise exception 'TEST FAIL: A bakiye 5 olmalı: %', v_out; end if;
  select quantity into v_qty from rewards where id = 'f0000000-0000-0000-0000-000000000010';
  if v_qty is distinct from 1 then raise exception 'TEST FAIL: stok 1 olmalı: %', v_qty; end if;

  -- A: 5 puan ile kutu oyunu (100) alamaz
  begin
    perform public.redeem_reward('f0000000-0000-0000-0000-000000000011');
    raise exception 'TEST FAIL: yetersiz bakiye ile alım kabul edildi';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: yetersiz bakiye reddedildi';
  end;

  -- A: 4. sınıf ödülü sınıf dışı
  begin
    perform public.redeem_reward('f0000000-0000-0000-0000-000000000012');
    raise exception 'TEST FAIL: sınıf dışı ödül alındı';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: sınıf dışı ödül reddedildi';
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
set role authenticated;
do $$
declare v_out jsonb; v_qty int;
begin
  v_out := public.redeem_reward('f0000000-0000-0000-0000-000000000010');
  if (v_out ->> 'balance')::int is distinct from 17 then raise exception 'TEST FAIL: B bakiye 17 olmalı: %', v_out; end if;
  select quantity into v_qty from rewards where id = 'f0000000-0000-0000-0000-000000000010';
  if v_qty is distinct from 0 then raise exception 'TEST FAIL: stok 0 olmalı: %', v_qty; end if;
  raise notice 'OK: ilk kazanır — son kalem B''ye gitti, stok 0';
end $$;
reset role;

-- ============ TEST 9: öğretmen düzeltmesi ve yabancı öğretmen ============
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$
declare v_row public.point_transactions%rowtype;
begin
  v_row := public.adjust_student_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 15, 'Telafi');
  if v_row.amount is distinct from 15 then raise exception 'TEST FAIL: düzeltme: %', v_row.amount; end if;
  raise notice 'OK: öğretmen +15 düzeltme (A bakiyesi 20)';
end $$;
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from point_transactions;
  if v_count is distinct from 0 then raise exception 'TEST FAIL: yabancı öğretmen ledger gördü'; end if;
  begin
    perform public.adjust_student_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -100, 'kötü niyet');
    raise exception 'TEST FAIL: yabancı öğretmen düzeltme yaptı';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: yabancı öğretmen veri görmez ve düzeltemez';
  end;
end $$;
reset role;

-- ============ TEST 10: yayından çekilen atamaya deneme yapılamaz ============
update public.assignments set published = false where id = 'f0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false);
set role authenticated;
do $$
begin
  begin
    insert into public.attempts (id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at)
    values ('f1000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', '[]'::jsonb, 0, 4, 0, 10, false, now());
    raise exception 'TEST FAIL: yayında olmayan atamaya deneme yazıldı';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'OK: yayında olmayan atamaya deneme reddedildi';
  end;
end $$;
reset role;

-- ============ TEST 11: bakiye zinciri ============
do $$
declare v_bal_a int; v_bal_b int;
begin
  select balance_after into v_bal_a from point_transactions where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' order by created_at desc limit 1;
  select balance_after into v_bal_b from point_transactions where student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' order by created_at desc limit 1;
  if v_bal_a is distinct from 20 then raise exception 'TEST FAIL: A bakiye 20 olmalı: %', v_bal_a; end if;
  if v_bal_b is distinct from 17 then raise exception 'TEST FAIL: B bakiye 17 olmalı: %', v_bal_b; end if;
  raise notice 'OK: bakiyeler — A: 15 (sınav) - 10 (harcama) + 15 (düzeltme) = 20 | B: 20 + 7 - 10 = 17';
end $$;

-- ============ TEST 12: admin de puan düzeltebilir, öğrenci düzelte(ME)z ============
insert into auth.users (id, raw_user_meta_data) values
  ('33333333-3333-3333-3333-333333333333', '{"role":"student"}'); -- profil otomatik oluşmasın
insert into public.profiles (id, role, full_name) values
  ('33333333-3333-3333-3333-333333333333', 'admin', 'Yönetici')
on conflict (id) do nothing;

-- öğrenci kendi puanını düzeltemez
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

-- admin düzeltebilir
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
set role authenticated;
do $$
declare v_row public.point_transactions%rowtype; v_bal int;
begin
  v_row := public.adjust_student_points('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -3, 'Admin düzeltmesi');
  if v_row.amount is distinct from -3 or v_row.kind is distinct from 'adjust' then
    raise exception 'TEST FAIL: admin düzeltme satırı: %/%', v_row.amount, v_row.kind;
  end if;
  -- Admin RLS gereği ledger'ı okuyamaz; doğrulama fonksiyonun döndürdüğü satırdan yapılır.
  if v_row.balance_after is distinct from 14 then
    raise exception 'TEST FAIL: B bakiye 14 olmalı: %', v_row.balance_after;
  end if;
  raise notice 'OK: admin hesabı da puan düzeltebiliyor (B: 17 → 14)';
end $$;
reset role;

-- admin ledger'ı okuyabilir mi (yeni RLS politikaları)
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
set role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from point_transactions;
  if v_count is distinct from 7 then raise exception 'TEST FAIL: admin ledger görmeli (7 satır), çıktı: %', v_count; end if;
  raise notice 'OK: admin ledger''ı okuyabiliyor (% satır)', v_count;
end $$;
reset role;

select 'TÜM PG TESTLER GEÇTİ' as sonuc;
