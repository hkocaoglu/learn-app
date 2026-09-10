// Alan modeli sabitleri, doğrulama ve yardımcılar (Türkçe UI desteği)

export const GRADES = [1, 2, 3, 4]

export const gradeLabel = (g) => `${g}. Sınıf`

export const SUBJECTS = ['matematik', 'geometri', 'turkce']

export const SUBJECT_LABELS = {
  matematik: 'Matematik',
  geometri: 'Geometri',
  turkce: 'Türkçe'
}

export const subjectLabel = (s) => SUBJECT_LABELS[s] || s

// Her ders için önerilen konu etiketleri (serbest metin de kullanılabilir)
export const SUBJECT_TOPICS = {
  matematik: ['toplama', 'çıkarma', 'çarpma', 'bölme', 'problemler', 'sayılar'],
  geometri: ['şekiller', 'simetri', 'uzunluk', 'alan', 'açılar', 'hacim'],
  turkce: ['okuma-anlama', 'dil bilgisi', 'yazım kuralları', 'eş ve zıt anlam', 'noktalama', 'hece bilgisi']
}

export const TOPIC_LABELS = {
  toplama: 'Toplama',
  çıkarma: 'Çıkarma',
  çarpma: 'Çarpma',
  bölme: 'Bölme',
  problemler: 'Problemler',
  sayılar: 'Sayılar',
  şekiller: 'Şekiller',
  simetri: 'Simetri',
  uzunluk: 'Uzunluk',
  alan: 'Alan',
  açılar: 'Açılar',
  hacim: 'Hacim',
  'okuma-anlama': 'Okuma-Anlama',
  'dil bilgisi': 'Dil Bilgisi',
  'yazım kuralları': 'Yazım Kuralları',
  'eş ve zıt anlam': 'Eş ve Zıt Anlam',
  noktalama: 'Noktalama',
  'hece bilgisi': 'Hece Bilgisi'
}

export const topicLabel = (t) => TOPIC_LABELS[t] || t

// Konu listesine kullanıcının yazdığı özel etiketleri de ekleyerek döndürür
export const topicsForSubject = (subject, existingTopics = []) => {
  const base = SUBJECT_TOPICS[subject] || []
  const extra = (existingTopics || []).filter((t) => t && !base.includes(t))
  return [...base, ...extra]
}

let counter = 0
export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const nowIso = () => new Date().toISOString()

// ---------- Doğrulama ----------

export const isValidGrade = (g) => GRADES.includes(Number(g))
export const isValidSubject = (s) => SUBJECTS.includes(s)

export const validateQuestion = (q) => {
  const errors = []
  if (!q || typeof q.text !== 'string' || !q.text.trim()) errors.push('Soru metni boş')
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6)
    errors.push('Seçenek sayısı 2-6 arasında olmalı')
  else {
    q.options.forEach((o, i) => {
      if (typeof o !== 'string' || !o.trim()) errors.push(`${i + 1}. seçenek boş`)
    })
    const n = Number(q.correctIndex)
    if (!Number.isInteger(n) || n < 0 || n >= q.options.length)
      errors.push('Doğru cevap seçeneği geçersiz')
  }
  if (!isValidGrade(q.grade)) errors.push('Sınıf geçersiz')
  if (!isValidSubject(q.subject)) errors.push('Ders geçersiz')
  if (!q.topic || !String(q.topic).trim()) errors.push('Konu etiketi boş')
  return errors
}

export const validateTest = (test) => {
  const errors = []
  if (!test) return ['Test verisi eksik']
  if (!test.title || !String(test.title).trim()) errors.push('Test başlığı boş')
  if (!isValidGrade(test.grade)) errors.push('Test sınıfı geçersiz')
  if (!isValidSubject(test.subject)) errors.push('Test dersi geçersiz')
  if (test.durationMinutes !== undefined && test.durationMinutes !== null && test.durationMinutes !== '') {
    const d = Number(test.durationMinutes)
    if (!Number.isFinite(d) || d < 1 || d > 240) errors.push('Süre 1-240 dakika arasında olmalı')
  }
  if (!Array.isArray(test.questions)) errors.push('Sorular listesi eksik')
  else {
    test.questions.forEach((q, i) => {
      validateQuestion({ ...q, grade: test.grade, subject: test.subject }).forEach((e) =>
        errors.push(`Soru ${i + 1}: ${e}`)
      )
    })
  }
  return errors
}

// Test soruları her zaman ders/sınıfı testten alır (snapshot modeli)
export const normalizeQuestion = (q, grade, subject) => ({
  id: q.id || uid('q'),
  grade: Number(grade),
  subject,
  topic: String(q.topic || '').trim().toLowerCase() || 'genel',
  text: String(q.text || '').trim(),
  options: (q.options || []).map((o) => String(o).trim()),
  correctIndex: Number(q.correctIndex),
  explanation: q.explanation ? String(q.explanation).trim() : '',
  image: q.image || '' // base64 data URI veya https:// URL
})

export const normalizeTest = (t) => ({
  id: t.id || uid('t'),
  title: String(t.title || '').trim(),
  grade: Number(t.grade),
  subject: t.subject,
  createdAt: t.createdAt || nowIso(),
  durationMinutes:
    t.durationMinutes === undefined || t.durationMinutes === null || t.durationMinutes === ''
      ? null
      : Number(t.durationMinutes),
  questions: (t.questions || []).map((q) => normalizeQuestion(q, t.grade, t.subject))
})

// ---------- Okuma ödevi ----------
// minDwellSeconds boşsa requiredDwellSeconds kelime sayısından türetir (150 wpm, 30-600 sn).
export const validateReading = (r) => {
  const errors = []
  if (!r) return ['Okuma verisi eksik']
  if (!r.title || String(r.title).trim().length < 1 || String(r.title).trim().length > 200)
    errors.push('Okuma başlığı 1-200 karakter olmalı')
  const body = String(r.body || '')
  if (body.trim().length < 50 || body.length > 20000)
    errors.push('Okuma metni 50-20000 karakter olmalı')
  if (!isValidGrade(r.grade)) errors.push('Okuma sınıfı geçersiz')
  if (!isValidSubject(r.subject)) errors.push('Okuma dersi geçersiz')
  if (r.sourceLabel !== undefined && r.sourceLabel !== null && String(r.sourceLabel).length > 200)
    errors.push('Kaynak bilgisi 200 karakteri geçmemeli')
  if (r.minDwellSeconds !== undefined && r.minDwellSeconds !== null && r.minDwellSeconds !== '') {
    const d = Number(r.minDwellSeconds)
    if (!Number.isFinite(d) || d < 15 || d > 1800) errors.push('En az okuma süresi 15-1800 sn arasında olmalı')
  }
  if (r.quizThreshold !== undefined && r.quizThreshold !== null && r.quizThreshold !== '') {
    const q = Number(r.quizThreshold)
    if (!Number.isFinite(q) || q < 0 || q > 100) errors.push('Quiz eşiği 0-100 arasında olmalı')
  }
  if (r.showPassageDuringQuiz !== undefined && r.showPassageDuringQuiz !== null && typeof r.showPassageDuringQuiz !== 'boolean')
    errors.push('Metin görünürlüğü seçimi geçersiz')
  if (r.questions !== undefined && r.questions !== null) {
    if (!Array.isArray(r.questions)) errors.push('Sorular listesi eksik')
    else if (r.questions.length > 6) errors.push('Okuma sorusu en fazla 6 olabilir')
    else {
      r.questions.forEach((q, i) => {
        validateQuestion({ ...q, grade: r.grade, subject: r.subject }).forEach((e) =>
          errors.push(`Soru ${i + 1}: ${e}`)
        )
      })
    }
  }
  return errors
}

export const normalizeReading = (r) => ({
  id: r.id || uid('r_'),
  title: String(r.title || '').trim(),
  sourceLabel: r.sourceLabel ? String(r.sourceLabel).trim() : '',
  body: String(r.body || '').trim(),
  grade: Number(r.grade),
  subject: r.subject,
  topic: String(r.topic || '').trim().toLowerCase() || 'okuma-anlama',
  minDwellSeconds:
    r.minDwellSeconds === undefined || r.minDwellSeconds === null || r.minDwellSeconds === ''
      ? null
      : Number(r.minDwellSeconds),
  quizThreshold:
    r.quizThreshold === undefined || r.quizThreshold === null || r.quizThreshold === ''
      ? 60
      : Number(r.quizThreshold),
  showPassageDuringQuiz:
    r.showPassageDuringQuiz === undefined || r.showPassageDuringQuiz === null
      ? true
      : Boolean(r.showPassageDuringQuiz),
  questions: (r.questions || []).map((q) => normalizeQuestion(q, r.grade, r.subject)),
  createdAt: r.createdAt || nowIso()
})

export const readingWordCount = (body) => {
  const text = String(body || '').trim()
  if (!text) return 0
  return text.split(/\s+/).length
}

export const requiredDwellSeconds = (reading) => {
  const explicit = Number(reading?.minDwellSeconds)
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit)
  const words = readingWordCount(reading?.body)
  const derived = Math.ceil((words / 150) * 60)
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  return clamp(derived, 30, 600)
}

export const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

export const percent = (correct, total) => (total === 0 ? 0 : Math.round((correct / total) * 100))

// ---------- Soru görseli yardımcıları ----------
// Kabul edilen görsel dosya türleri
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
// Boyut sınırı: 800 KB (base64'i de veriyle birlikte saklanır)
export const MAX_IMAGE_BYTES = 800 * 1024

// Dosyayı data URI'ye çevirir; boyut/tür doğrulaması yapar. Hata olursa { error } döner.
export const fileToImageData = (file) =>
  new Promise((resolve) => {
    if (!file) return resolve({ error: 'Dosya seçilmedi' })
    if (!IMAGE_MIME_TYPES.includes(file.type))
      return resolve({ error: 'Desteklenmeyen format. JPEG, PNG, GIF veya WebP kullanın.' })
    if (file.size > MAX_IMAGE_BYTES)
      return resolve({ error: `Görsel çok büyük (en fazla ${Math.round(MAX_IMAGE_BYTES / 1024)} KB).` })
    const reader = new FileReader()
    reader.onload = () => resolve({ data: String(reader.result) })
    reader.onerror = () => resolve({ error: 'Dosya okunamadı' })
    reader.readAsDataURL(file)
  })

// Süre yardımcıları: saniye cinsinden süreleri okunur metne çevirir.
export const formatSeconds = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  if (s < 60) return `${s} sn`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} dk ${r} sn` : `${m} dk`
}

export const formatMinutesShort = (min) => `${Math.round(Number(min) || 0)} dk`
