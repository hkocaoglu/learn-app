// localStorage tabanlı veri katmanı: yerel modda ortak, cloud modda kullanıcı kapsamlı anahtar kullanır.
import { SEED_QUESTIONS } from '../data/seedQuestions.js'
import { normalizeTest, normalizeQuestion, normalizeReading, nowIso, uid, GRADES, SUBJECTS } from '../domain/model.js'

const DB_KEY = 'learn_app_db_v1'
const META_KEY = 'learn_app_meta_v1'

const scopedKey = (key, scope = '') => {
  const normalizedScope = String(scope || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
  return normalizedScope ? `${key}_${normalizedScope}` : key
}

const emptyDB = () => ({
  version: 1,
  students: [],
  tests: [],
  bank: [], // soru bankası (sınıf + ders + konu etiketli)
  attempts: [],
  readings: [],
  readingAttempts: [],
  aiReports: {} // studentId -> AI rapor metinleri listesi
})

// ---------- okuma/yazma ----------
export function loadDB(scope = '') {
  try {
    const raw = localStorage.getItem(scopedKey(DB_KEY, scope))
    if (!raw) return null
    const db = JSON.parse(raw)
    return { ...emptyDB(), ...db }
  } catch (e) {
    console.error('Veri yüklenemedi:', e)
    return null
  }
}

export function saveDB(db, scope = '') {
  try {
    localStorage.setItem(scopedKey(DB_KEY, scope), JSON.stringify(db))
    localStorage.setItem(scopedKey(META_KEY, scope), JSON.stringify({ savedAt: nowIso() }))
  } catch (e) {
    console.error('Veri kaydedilemedi:', e)
    throw new Error('Tarayıcı deposu dolu veya erişilemiyor. Veri kaydedilemedi.')
  }
}

// ---------- seed ----------
export function buildSeed() {
  const db = emptyDB()
  const bank = SEED_QUESTIONS.map((q) => ({
    id: uid('q'),
    grade: q.grade,
    subject: q.subject,
    topic: q.topic,
    text: q.text,
    options: [...q.options],
    correctIndex: q.correctIndex,
    explanation: q.explanation || ''
  }))
  db.bank = bank

  // Her (sınıf, ders) çifti için hazır bir test (ilk 6 soru seçilerek)
  for (const grade of GRADES) {
    for (const subject of SUBJECTS) {
      const qs = bank.filter((q) => q.grade === grade && q.subject === subject).slice(0, 6)
      if (!qs.length) continue
      db.tests.push({
        id: uid('t'),
        title: `${grade}. Sınıf ${subject === 'turkce' ? 'Türkçe' : subject === 'matematik' ? 'Matematik' : 'Geometri'} — Hazır Test`,
        grade,
        subject,
        createdAt: nowIso(),
        questions: qs.map((q) => ({ ...q })) // snapshot kopya
      })
    }
  }
  return db
}

export function seedIfEmpty(scope = '') {
  const existing = loadDB(scope)
  if (existing && existing.version) {
    return existing // veri zaten var
  }
  const seeded = buildSeed()
  saveDB(seeded, scope)
  return seeded
}

export function resetToSeed(scope = '') {
  const seeded = buildSeed()
  saveDB(seeded, scope)
  return seeded
}

// ---------- yedekleme (export/import) ----------
export function exportBackup(db) {
  return JSON.stringify(
    {
      version: 1,
      kind: 'backup',
      exportedAt: nowIso(),
      data: {
        students: db.students,
        tests: db.tests,
        bank: db.bank,
        attempts: db.attempts,
        readings: db.readings || [],
        readingAttempts: db.readingAttempts || [],
        aiReports: db.aiReports
      }
    },
    null,
    2
  )
}

export function importBackup(json, scope = '') {
  const parsed = JSON.parse(json)
  if (!parsed || parsed.kind !== 'backup' || !parsed.data)
    throw new Error('Geçersiz yedek dosyası: kind "backup" olmalı.')
  const data = parsed.data
  const next = emptyDB()
  if (Array.isArray(data.students)) next.students = data.students
  if (Array.isArray(data.tests)) next.tests = data.tests.map((t) => normalizeTest(t))
  if (Array.isArray(data.bank))
    next.bank = data.bank.map((q) => normalizeQuestion(q, q.grade, q.subject))
  if (Array.isArray(data.attempts)) next.attempts = data.attempts
  if (Array.isArray(data.readings)) next.readings = data.readings.map((r) => normalizeReading(r))
  if (Array.isArray(data.readingAttempts)) next.readingAttempts = data.readingAttempts
  if (data.aiReports && typeof data.aiReports === 'object') next.aiReports = data.aiReports
  saveDB(next, scope)
  return next
}

// ---------- yardımcılar ----------
export const storageKey = (scope = '') => scopedKey(DB_KEY, scope)
export const downloadJSON = (filename, json) => {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
