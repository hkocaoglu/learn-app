// Puan sistemi salt mantığı: kazanım (earn), bakiye (balance), harcama (spend).
// Sunucu tarafı kazanım (BACKLOG BL-1) bu formüllerin SQL aynısını çalıştırır;
// buradaki sürüm yerel mod + verify.mjs testleri içindir. İki taraf eşit kalmalı.
import { uid } from './model.js'

// Puan ekonomisi ayarları — öğretmen/ileride admin tarafından ayarlanabilir.
// NOT: Bir sınavın/okumanın puanı ARTIK ATAMA BAZINDA belirlenir (assignments.points,
// reading_assignments.points). Buradakiler yalnızca varsayılan ve güvenlik sınırlarıdır.
export const POINTS = {
  exam: { defaultPoints: 20, defaultPassThreshold: 60, min: 1, max: 100 },
  reading: { defaultPoints: 10, min: 1, max: 100 }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const toScore = (v) => (Number.isFinite(Number(v)) ? clamp(Math.round(Number(v)), 0, 100) : 0)
const toPoints = (v, fallback) => clamp(Math.round(Number(v)) || fallback, POINTS.exam.min, POINTS.exam.max)

// Sınav: başarı eşiği geçilmediyse HİÇ puan yok; geçilirse öğretmenin verdiği
// puanın başarı oranındaki kısmı verilir.
export const earnForExam = ({ scorePercent, points, passThreshold } = {}) => {
  const score = toScore(scorePercent)
  const threshold = toScore(passThreshold ?? POINTS.exam.defaultPassThreshold)
  if (score < threshold) return 0
  const maxPoints = toPoints(points, POINTS.exam.defaultPoints)
  return clamp(Math.round((maxPoints * score) / 100), 1, POINTS.exam.max)
}

// Okuma: yalnızca tamamlandıysa (read=true) puan verir; quiz eşiği okuma
// kapılarında denetlenir. Puan = öğretmenin verdiği puan × quiz başarısı.
export const earnForReading = ({ read, scorePercent, points } = {}) => {
  if (!read) return 0
  const score = toScore(scorePercent)
  const maxPoints = toPoints(points, POINTS.reading.defaultPoints)
  return clamp(Math.round((maxPoints * score) / 100), 1, POINTS.reading.max)
}

// ---------- deneme hakkı (sunucudaki attempt_allowed kuralının aynısı) ----------
const dayKey = (date, timeZone = 'Europe/Istanbul') => {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// Sınav tamamlandıysa (eşik geçildiyse) yeni deneme YOK. Eşik altında kalındıysa
// günde `dailyAttempts` hak vardır; gün değişince haklar yenilenir.
export const attemptState = ({ passThreshold, dailyAttempts } = {}, attempts = [], now = new Date()) => {
  const threshold = toScore(passThreshold ?? POINTS.exam.defaultPassThreshold)
  const daily = clamp(Math.round(Number(dailyAttempts) || 2), 1, 5)
  const scoreOf = (a) => toScore(a?.scorePercent ?? a?.score_percent)
  const passed = attempts.some((a) => scoreOf(a) >= threshold)
  const bestScore = attempts.reduce((max, a) => Math.max(max, scoreOf(a)), 0)
  const today = dayKey(now)
  const usedToday = attempts.filter((a) => dayKey(a?.date ?? a?.createdAt ?? a?.created_at) === today).length
  const leftToday = Math.max(0, daily - usedToday)
  return {
    passed,
    bestScore,
    usedToday,
    daily,
    leftToday,
    canAttempt: !passed && leftToday > 0,
    reason: passed ? 'passed' : leftToday > 0 ? 'ok' : 'daily_limit'
  }
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
