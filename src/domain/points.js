// Puan sistemi salt mantığı: kazanım (earn), bakiye (balance), harcama (spend).
// Sunucu tarafı kazanım (BACKLOG BL-1) bu formüllerin SQL aynısını çalıştırır;
// buradaki sürüm yerel mod + verify.mjs testleri içindir. İki taraf eşit kalmalı.
import { uid } from './model.js'

// Puan ekonomisi ayarları — öğretmen/ileride admin tarafından ayarlanabilir.
export const POINTS = {
  exam: { base: 5, qualityWeight: 0.15, carefulBonus: 5, min: 1, max: 30 },
  reading: { base: 3, qualityWeight: 0.08, min: 1, max: 12 }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const toScore = (v) => (Number.isFinite(Number(v)) ? clamp(Math.round(Number(v)), 0, 100) : 0)

// Sınav: katılım baz + sonuç kalitesi + (süre dolmadıysa) dikkat bonusu.
export const earnForExam = ({ scorePercent, timeUp = false } = {}) => {
  const score = toScore(scorePercent)
  const raw =
    POINTS.exam.base + Math.round(score * POINTS.exam.qualityWeight) + (timeUp ? 0 : POINTS.exam.carefulBonus)
  return clamp(raw, POINTS.exam.min, POINTS.exam.max)
}

// Okuma: yalnızca tamamlandıysa (read=true) quiz kalitesine göre puan verir.
export const earnForReading = ({ read, scorePercent } = {}) => {
  if (!read) return 0
  const score = toScore(scorePercent)
  const raw = POINTS.reading.base + Math.round(score * POINTS.reading.qualityWeight)
  return clamp(raw, POINTS.reading.min, POINTS.reading.max)
}

// ---------- ledger ----------
export const balanceOf = (transactions = []) =>
  transactions.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0)

export const studentBalance = (transactions = [], studentId) =>
  balanceOf(transactions.filter((t) => t?.studentId === studentId))

// Aynı kaynak (sınav/okuma) ikinci kez puan üretmez — idempotent kazanım.
export const earnedAlready = (transactions = [], refType, refId) =>
  transactions.some((t) => t?.kind === 'earn' && t?.refType === refType && String(t?.refId) === String(refId))

const baseTransaction = ({ teacherId, studentId, kind, source, refType = null, refId = null, amount, label, date }) => ({
  id: uid('p'),
  teacherId: teacherId ?? null,
  studentId,
  kind,
  source,
  refType,
  refId,
  amount: Math.round(Number(amount) || 0),
  label: String(label || ''),
  date: date || new Date().toISOString()
})

export const examEarnLabel = (testTitle, scorePercent) =>
  `Sınav: ${testTitle || 'Test'} (%${toScore(scorePercent)})`
export const readingEarnLabel = (readingTitle) => `Okuma: ${readingTitle || 'Okuma'}`
export const redeemLabel = (rewardName) => `Ödül: ${rewardName}`

export const earnTransaction = ({ teacherId, studentId, source, refType, refId, amount, label, date }) =>
  baseTransaction({ teacherId, studentId, kind: 'earn', source, refType, refId, amount, label, date })

export const spendTransaction = ({ teacherId, studentId, refId, amount, label, date }) =>
  baseTransaction({
    teacherId,
    studentId,
    kind: 'spend',
    source: 'catalog',
    refType: 'catalog',
    refId,
    amount: -Math.abs(Number(amount) || 0),
    label,
    date
  })

export const adjustTransaction = ({ teacherId, studentId, amount, label, date }) =>
  baseTransaction({ teacherId, studentId, kind: 'adjust', source: 'manual', amount, label, date })

// ---------- harcama / katalog ----------
export const canAfford = (balance, cost) => Number(balance) >= Number(cost)

// Öğrencinin gördüğü ödül durumu: 'inactive' | 'sold_out' | 'unaffordable' | 'affordable'
export const redeemState = (reward, balance) => {
  if (!reward || reward.active === false) return 'inactive'
  if (Number(reward.quantity ?? 0) < 1) return 'sold_out'
  return canAfford(balance, reward.cost) ? 'affordable' : 'unaffordable'
}

// "Bunun için biriktir" hedefi: yüzde 0-100 arası ilerleme.
export const progressToward = (reward, balance) => {
  const cost = Number(reward?.cost) || 0
  if (cost <= 0) return 100
  return clamp(Math.round(((Number(balance) || 0) / cost) * 100), 0, 100)
}

// Sınıf (havuz) bazlı katalog: classKey yerelde "grade:N", cloud'da class_id.
export const catalogForClass = (rewards = [], classKey) =>
  rewards
    .filter((r) => r && r.active !== false && String(r.classKey) === String(classKey))
    .sort((a, b) => Number(a.cost) - Number(b.cost) || String(a.name).localeCompare(String(b.name), 'tr'))
