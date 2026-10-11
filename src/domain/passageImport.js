// Çoklu metin içe aktarımı: her kaynak ayrı ayrı doğrulanır, hatalılar diğerlerini engellemez.
// Tek kaynak davranışı importPassages ile aynıdır (kind: reading-passage | reading-passage-collection).
import { importPassages } from './model.js'

// Tek kaynağı ayrıştırır; asla fırlatmaz, hatayı metin olarak döndürür.
export const parsePassageSource = (text, label = 'JSON') => {
  if (!String(text ?? '').trim()) return { passages: [], error: `${label}: içerik boş.` }
  try {
    return { passages: importPassages(text), error: '' }
  } catch (error) {
    return { passages: [], error: `${label}: ${error.message}` }
  }
}

// Kaynak listesi → geçerli metinler + hata/uyarı raporu (kısmi aktarım destekli).
export const collectPassageSources = (sources = []) => {
  const byTitle = new Map()
  const errors = []
  const warnings = []

  for (const source of sources) {
    const name = source?.name || 'JSON'
    const { passages, error } = parsePassageSource(source?.text, name)
    if (error) {
      errors.push(error)
      continue
    }
    for (const passage of passages) {
      const title = String(passage?.title || '').trim()
      if (byTitle.has(title)) {
        warnings.push(`${name}: "${title}" aynı pakette tekrar ediyor, son sürüm kullanılacak.`)
      }
      byTitle.set(title, passage)
    }
  }

  return { passages: [...byTitle.values()], errors, warnings }
}

// Önizleme özeti: metin/soru/kelime sayısı ve sınıf dağılımı.
export const summarizePassages = (passages = []) => {
  const byGrade = {}
  let questions = 0
  let words = 0
  for (const passage of passages) {
    const grade = Number(passage?.grade)
    if (Number.isFinite(grade)) byGrade[grade] = (byGrade[grade] || 0) + 1
    questions += Array.isArray(passage?.questions) ? passage.questions.length : 0
    words += String(passage?.body || '')
      .split(/\s+/)
      .filter(Boolean).length
  }
  return { count: passages.length, questions, words, byGrade }
}
