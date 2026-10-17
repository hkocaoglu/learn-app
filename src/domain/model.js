// Alan modeli sabitleri, doğrulama ve yardımcılar (Türkçe UI desteği)

export const GRADES = [1, 2, 3, 4, 5, 6]

export const gradeLabel = (g) => (GRADES.includes(Number(g)) ? `${Number(g)}. Sınıf` : '—')

export const SUBJECTS = [
  'matematik',
  'geometri',
  'turkce',
  'hayat-bilgisi',
  'fen-bilimleri',
  'sosyal-bilgiler',
  'din-kulturu',
  'yabanci-dil',
  'bilisim'
]

export const SUBJECT_LABELS = {
  matematik: 'Matematik',
  geometri: 'Geometri',
  turkce: 'Türkçe',
  'hayat-bilgisi': 'Hayat Bilgisi',
  'fen-bilimleri': 'Fen Bilimleri',
  'sosyal-bilgiler': 'Sosyal Bilgiler',
  'din-kulturu': 'Din Kültürü ve Ahlak Bilgisi',
  'yabanci-dil': 'Yabancı Dil',
  bilisim: 'Bilişim Teknolojileri ve Yazılım'
}

// MEB haftalık ders çizelgesine göre dersin okutulduğu sınıflar.
export const SUBJECT_GRADES = {
  turkce: GRADES,
  matematik: GRADES,
  geometri: GRADES,
  'hayat-bilgisi': [1, 2, 3],
  'fen-bilimleri': [3, 4, 5, 6],
  'sosyal-bilgiler': [4, 5, 6],
  'din-kulturu': [4, 5, 6],
  'yabanci-dil': [2, 3, 4, 5, 6],
  bilisim: [5, 6]
}

// Seçilen sınıfta okutulan dersler (sınıf bilinmiyorsa tüm dersler).
export const subjectsForGrade = (grade) => {
  const g = Number(grade)
  if (!GRADES.includes(g)) return SUBJECTS
  return SUBJECTS.filter((subject) => (SUBJECT_GRADES[subject] || GRADES).includes(g))
}

export const subjectLabel = (s) => SUBJECT_LABELS[s] || s

// Her ders için önerilen konu etiketleri (serbest metin de kullanılabilir)
export const SUBJECT_TOPICS = {
  matematik: ['toplama', 'çıkarma', 'çarpma', 'bölme', 'problemler', 'sayılar'],
  geometri: ['şekiller', 'simetri', 'uzunluk', 'alan', 'açılar', 'hacim'],
  turkce: ['okuma-anlama', 'dil bilgisi', 'yazım kuralları', 'eş ve zıt anlam', 'noktalama', 'hece bilgisi'],
  'hayat-bilgisi': ['okul ve çevrem', 'aile ve toplum', 'doğa ve çevre', 'sağlıklı yaşam', 'güvenlik', 'ülkemiz'],
  'fen-bilimleri': ['canlılar', 'madde ve doğası', 'kuvvet ve hareket', 'ışık ve ses', 'dünya ve evren', 'elektrik'],
  'sosyal-bilgiler': ['birey ve toplum', 'kültür ve miras', 'insan ve çevre', 'bilim ve teknoloji', 'üretim ve tüketim'],
  'din-kulturu': ['din ve ahlak', 'ibadetler', 'peygamberler', 'kutsal kitaplar', 'ahlaki değerler'],
  'yabanci-dil': ['kelime bilgisi', 'dil bilgisi', 'okuma', 'dinleme', 'konuşma'],
  bilisim: ['bilgisayar sistemleri', 'algoritma', 'blok kodlama', 'internet güvenliği', 'dijital ürün']
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

// ---------- Hızlı kelime akışı (RSVP) ----------
// Metin ekranda kelime kelime akar; hızı öğretmen belirler (sn/kelime).
export const DISPLAY_MODES = ['static', 'rsvp']

export const DISPLAY_MODE_LABELS = {
  static: 'Normal okuma (kaydırma + süre)',
  rsvp: 'Hızlı kelime akışı'
}

export const displayModeLabel = (mode) => DISPLAY_MODE_LABELS[mode] || DISPLAY_MODE_LABELS.static

// Akış modunda ezber/ayrıntı ölçümü kısa tutulur: en fazla 3 anlama sorusu.
export const RSVP_QUESTION_COUNT = 3
export const RSVP_MIN_SECONDS_PER_WORD = 0.1
export const RSVP_MAX_SECONDS_PER_WORD = 5
export const RSVP_DEFAULT_SECONDS_PER_WORD = 0.8

// Süreyi sınırlar içine çeker; geçersiz/boş değerde varsayılana döner (2 ondalık).
export const normalizeSecondsPerWord = (value) => {
  if (value === undefined || value === null || value === '') return RSVP_DEFAULT_SECONDS_PER_WORD
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return RSVP_DEFAULT_SECONDS_PER_WORD
  const clamped = Math.min(RSVP_MAX_SECONDS_PER_WORD, Math.max(RSVP_MIN_SECONDS_PER_WORD, n))
  return Math.round(clamped * 100) / 100
}

// ---------- Okuma ödevi ----------
// minDwellSeconds boşsa requiredDwellSeconds kelime sayısından türetir (150 wpm, 30-600 sn).
export const validateReading = (r) => {
  const errors = []
  if (!r) return ['Okuma verisi eksik']
  const displayMode = r.displayMode === 'rsvp' ? 'rsvp' : 'static'
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
  if (r.displayMode !== undefined && r.displayMode !== null && !DISPLAY_MODES.includes(r.displayMode))
    errors.push('Gösterim modu geçersiz (static veya rsvp)')
  if (r.rsvpSecondsPerWord !== undefined && r.rsvpSecondsPerWord !== null && r.rsvpSecondsPerWord !== '') {
    const rate = Number(r.rsvpSecondsPerWord)
    if (!Number.isFinite(rate) || rate < RSVP_MIN_SECONDS_PER_WORD || rate > RSVP_MAX_SECONDS_PER_WORD)
      errors.push(
        `Kelime hızı ${RSVP_MIN_SECONDS_PER_WORD}-${RSVP_MAX_SECONDS_PER_WORD} sn/kelime arasında olmalı`
      )
  }
  if (r.questions !== undefined && r.questions !== null) {
    const limit = displayMode === 'rsvp' ? RSVP_QUESTION_COUNT : 6
    if (!Array.isArray(r.questions)) errors.push('Sorular listesi eksik')
    else if (r.questions.length > limit)
      errors.push(
        displayMode === 'rsvp'
          ? `Hızlı kelime akışında en fazla ${limit} soru olabilir`
          : `Okuma sorusu en fazla ${limit} olabilir`
      )
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
  // Akış modunda metin quiz sırasında gösterilmez: metni normal hızda okumak ölçümü bozar.
  displayMode: DISPLAY_MODES.includes(r.displayMode) ? r.displayMode : 'static',
  rsvpSecondsPerWord: normalizeSecondsPerWord(r.rsvpSecondsPerWord),
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
    r.displayMode === 'rsvp'
      ? false
      : r.showPassageDuringQuiz === undefined || r.showPassageDuringQuiz === null
        ? true
        : Boolean(r.showPassageDuringQuiz),
  image: r.image ? String(r.image) : '',
  questions: (r.questions || []).map((q) => normalizeQuestion(q, r.grade, r.subject)),
  createdAt: r.createdAt || nowIso()
})

// ---------- Okuma metni aktarımı (JSON dosya paylaşımı) ----------
export const exportPassage = (passage) => {
  const normalized = normalizeReading(passage)
  return JSON.stringify(
    {
      version: 1,
      kind: 'reading-passage',
      exportedAt: nowIso(),
      passage: {
        title: normalized.title,
        sourceLabel: normalized.sourceLabel,
        body: normalized.body,
        grade: normalized.grade,
        subject: normalized.subject,
        topic: normalized.topic,
        displayMode: normalized.displayMode,
        rsvpSecondsPerWord: normalized.rsvpSecondsPerWord,
        quizThreshold: normalized.quizThreshold,
        showPassageDuringQuiz: normalized.showPassageDuringQuiz,
        image: normalized.image,
        questions: normalized.questions
      }
    },
    null,
    2
  )
}

export const importPassage = (json) => {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json
  if (!parsed || parsed.kind !== 'reading-passage' || !parsed.passage)
    throw new Error('Geçersiz metin dosyası: kind "reading-passage" olmalı.')
  const errors = validateReading(parsed.passage)
  if (errors.length > 0) throw new Error(`Geçersiz metin: ${errors[0]}`)
  return normalizeReading(parsed.passage)
}

// Toplu içe aktarım: tek metin ya da koleksiyon dosyası → passage[].
// Koleksiyon formatı: { version, kind: 'reading-passage-collection', passages: [passage, ...] }
export const importPassages = (json) => {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json
  if (!parsed) throw new Error('Geçersiz dosya: JSON okunamadı.')
  if (parsed.kind === 'reading-passage' && parsed.passage) return [importPassage(parsed)]
  if (parsed.kind === 'reading-passage-collection' && Array.isArray(parsed.passages)) {
    if (parsed.passages.length === 0) throw new Error('Geçersiz dosya: koleksiyonda metin yok.')
    return parsed.passages.map((passage, index) => {
      const errors = validateReading(passage)
      if (errors.length > 0)
        throw new Error(`Metin ${index + 1} ("${passage?.title || 'başlıksız'}"): ${errors[0]}`)
      return normalizeReading(passage)
    })
  }
  throw new Error('Geçersiz dosya: kind "reading-passage" veya "reading-passage-collection" olmalı.')
}

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
