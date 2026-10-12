-- Puan düzeltmesi: admin hesabı da yapabilir (tüm öğrenciler üzerinde).
--
-- Önceden yalnızca `is_teacher()` kabul ediliyordu; profiles.role = 'admin' olan
-- hesaplar "Bu işlem yalnızca öğretmenler içindir." hatası alıyordu. Admin konsolu
-- tüm öğrencileri görebildiği için düzeltme yetkisi de verildi.
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
  v_actor uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_balance integer;
  v_row public.point_transactions%rowtype;
begin
  if v_actor is null or not (public.is_teacher() or v_admin) then
    raise exception 'Bu işlem yalnızca öğretmen veya admin içindir.';
  end if;

  if p_amount is null or p_amount = 0 then
    raise exception 'Puan miktarı 0 olamaz.';
  end if;

  if v_admin then
    -- Admin herhangi bir öğrenciyi düzeltebilir.
    if not exists (select 1 from public.students where id = p_student_id) then
      raise exception 'Öğrenci bulunamadı.';
    end if;
  elsif not exists (
    select 1 from public.students where id = p_student_id and teacher_id = v_actor
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
    (v_actor, p_student_id, 'adjust', 'manual', null, null, p_amount,
     coalesce(nullif(trim(p_label), ''), 'Öğretmen düzeltmesi'), v_balance + p_amount)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------- admin için okuma politikaları ----------
-- Admin konsolu diğer tabloları görebiliyor; puan tabloları da görünmeli ki
-- Ödüller ekranındaki bakiyeler/hareketler admin için boş görünmesin.
drop policy if exists point_transactions_admin_read on public.point_transactions;
create policy point_transactions_admin_read on public.point_transactions
for select using (public.is_admin());

drop policy if exists rewards_admin_read on public.rewards;
create policy rewards_admin_read on public.rewards
for select using (public.is_admin());

drop policy if exists reward_redemptions_admin_read on public.reward_redemptions;
create policy reward_redemptions_admin_read on public.reward_redemptions
for select using (public.is_admin());

drop policy if exists save_goals_admin_read on public.save_goals;
create policy save_goals_admin_read on public.save_goals
for select using (public.is_admin());
