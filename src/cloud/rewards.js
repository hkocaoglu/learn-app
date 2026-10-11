// Puan & ödül cloud katmanı: öğretmen CRUD + öğrenci mağazası + harcama RPC.
// Ledger satırları istemci tarafından yazılamaz (RLS yok); kazanım DB trigger'ı,
// harcama `redeem_reward` RPC tarafından yapılır — bkz. docs/points-system.md.
import { requireSupabase } from '../lib/supabase.js'
import { balanceOf } from '../domain/points.js'

const rewardFields =
  'id, teacher_id, class_id, name, icon, cost, description, active, quantity, redemption_count, created_at'
const txFields = 'id, teacher_id, student_id, kind, source, ref_type, ref_id, amount, label, created_at'
const redemptionFields = 'id, teacher_id, student_id, reward_id, cost, redeemed_at'
const goalFields = 'id, student_id, reward_id, created_at'

export const toReward = (row) => ({
  id: row.id,
  teacherId: row.teacher_id,
  classKey: row.class_id, // domain'de classKey; cloud'da class_id
  name: row.name,
  icon: row.icon || 'star',
  cost: Number(row.cost),
  quantity: Number(row.quantity ?? 0),
  description: row.description || '',
  active: Boolean(row.active),
  redemptionCount: Number(row.redemption_count || 0),
  createdAt: row.created_at
})

export const toTransaction = (row) => ({
  id: row.id,
  teacherId: row.teacher_id,
  studentId: row.student_id,
  kind: row.kind,
  source: row.source,
  refType: row.ref_type,
  refId: row.ref_id,
  amount: Number(row.amount),
  label: row.label || '',
  date: row.created_at
})

export const toRedemption = (row) => ({
  id: row.id,
  teacherId: row.teacher_id,
  studentId: row.student_id,
  rewardId: row.reward_id,
  cost: Number(row.cost),
  date: row.redeemed_at
})

export const toSaveGoal = (row) => ({ id: row.id, studentId: row.student_id, rewardId: row.reward_id })

// ---------- öğretmen ----------
export const fetchTeacherRewards = async () => {
  const client = requireSupabase()
  const [rewardResult, txResult, redemptionResult, goalResult] = await Promise.all([
    client.from('rewards').select(rewardFields).order('cost', { ascending: true }),
    client.from('point_transactions').select(txFields).order('created_at', { ascending: false }).limit(1000),
    client.from('reward_redemptions').select(redemptionFields).order('redeemed_at', { ascending: false }).limit(500),
    client.from('save_goals').select(goalFields)
  ])
  if (rewardResult.error) throw new Error(`Ödül havuzu yüklenemedi: ${rewardResult.error.message}`)
  if (txResult.error) throw new Error(`Puan hareketleri yüklenemedi: ${txResult.error.message}`)
  if (redemptionResult.error) throw new Error(`Harcamalar yüklenemedi: ${redemptionResult.error.message}`)
  if (goalResult.error) throw new Error(`Biriktirme hedefleri yüklenemedi: ${goalResult.error.message}`)
  return {
    rewards: (rewardResult.data || []).map(toReward),
    pointTransactions: (txResult.data || []).map(toTransaction),
    redemptions: (redemptionResult.data || []).map(toRedemption),
    saveGoals: (goalResult.data || []).map(toSaveGoal)
  }
}

export const createReward = async ({ teacherId, classKey, name, icon, cost, quantity, description }) => {
  const { data, error } = await requireSupabase()
    .from('rewards')
    .insert({
      teacher_id: teacherId,
      class_id: classKey,
      name: String(name).trim(),
      icon: icon || 'star',
      cost: Number(cost),
      quantity: Number(quantity),
      description: String(description || ''),
      active: true
    })
    .select(rewardFields)
    .single()
  if (error) throw new Error(`Ödül eklenemedi: ${error.message}`)
  return toReward(data)
}

export const updateReward = async (id, patch) => {
  const payload = {}
  if (patch.name !== undefined) payload.name = String(patch.name).trim()
  if (patch.icon !== undefined) payload.icon = patch.icon
  if (patch.cost !== undefined) payload.cost = Number(patch.cost)
  if (patch.quantity !== undefined) payload.quantity = Number(patch.quantity)
  if (patch.description !== undefined) payload.description = String(patch.description || '')
  if (patch.active !== undefined) payload.active = Boolean(patch.active)
  const { data, error } = await requireSupabase().from('rewards').update(payload).eq('id', id).select(rewardFields).single()
  if (error) throw new Error(`Ödül güncellenemedi: ${error.message}`)
  return toReward(data)
}

export const deleteReward = async (id) => {
  const { error } = await requireSupabase().from('rewards').delete().eq('id', id)
  if (error) throw new Error(`Ödül silinemedi: ${error.message}`)
  return true
}

// ---------- öğrenci ----------
export const fetchStudentShop = async (student) => {
  const client = requireSupabase()
  const [rewardResult, txResult, goalResult] = await Promise.all([
    client.from('rewards').select(rewardFields).eq('class_id', student.classId).order('cost', { ascending: true }),
    client
      .from('point_transactions')
      .select(txFields)
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(200),
    client.from('save_goals').select(goalFields).eq('student_id', student.id)
  ])
  if (rewardResult.error) throw new Error(`Ödül havuzu yüklenemedi: ${rewardResult.error.message}`)
  if (txResult.error) throw new Error(`Puan bakiyeniz yüklenemedi: ${txResult.error.message}`)
  if (goalResult.error) throw new Error(`Hedefleriniz yüklenemedi: ${goalResult.error.message}`)
  const transactions = (txResult.data || []).map(toTransaction)
  return {
    rewards: (rewardResult.data || []).map(toReward),
    transactions,
    balance: balanceOf(transactions),
    saveGoals: (goalResult.data || []).map(toSaveGoal)
  }
}

// Tek bir kazanım satırını okur (sınav/okuma sonrası "+N puan" göstergesi için).
export const fetchEarnedFor = async (studentId, refType, refId) => {
  const { data, error } = await requireSupabase()
    .from('point_transactions')
    .select('amount, label')
    .eq('student_id', studentId)
    .eq('kind', 'earn')
    .eq('ref_type', refType)
    .eq('ref_id', refId)
    .maybeSingle()
  if (error) throw new Error(`Puan bilgisi okunamadı: ${error.message}`)
  return data ? Number(data.amount) : 0
}

// Harcama: sunucu RPC'si bakiye + stok denetimini atomik yapar (first-come-first-served).
export const redeemReward = async (rewardId) => {
  const { data, error } = await requireSupabase().rpc('redeem_reward', { p_reward_id: rewardId })
  if (error) {
    // RPC içindeki raise exception Türkçe mesajları birebir döner.
    throw new Error(error.message)
  }
  return data // { redemption_id, balance }
}

// En güncel bakiye: ledger'daki son satırın balance_after değeri (trigger/RPC tarafından yazılır).
export const fetchStudentBalance = async (studentId) => {
  const { data, error } = await requireSupabase()
    .from('point_transactions')
    .select('balance_after')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Puan bakiyeniz yüklenemedi: ${error.message}`)
  return data?.balance_after != null ? Number(data.balance_after) : 0
}

export const setSaveGoal = async (studentId, rewardId) => {
  const { error } = await requireSupabase()
    .from('save_goals')
    .insert({ student_id: studentId, reward_id: rewardId })
  if (error && error.code !== '23505') throw new Error(`Hedef kaydedilemedi: ${error.message}`)
  return true
}

export const clearSaveGoal = async (studentId, rewardId) => {
  const { error } = await requireSupabase()
    .from('save_goals')
    .delete()
    .eq('student_id', studentId)
    .eq('reward_id', rewardId)
  if (error) throw new Error(`Hedef kaldırılamadı: ${error.message}`)
  return true
}
