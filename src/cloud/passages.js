import { requireSupabase } from '../lib/supabase.js'
import { normalizeReading, normalizeSecondsPerWord } from '../domain/model.js'
import { detectMissingColumn, dropKeys, probeMissingColumns, selectList } from './schemaFallback.js'

const passageFields = [
  'id',
  'teacher_id',
  'title',
  'source_label',
  'body',
  'image',
  'grade',
  'subject',
  'topic',
  'display_mode',
  'rsvp_seconds_per_word',
  'quiz_threshold',
  'show_passage_during_quiz',
  'questions',
  'created_at'
]

const optionalPassageFields = [
  'show_passage_during_quiz',
  'image',
  'display_mode',
  'rsvp_seconds_per_word'
]

const imageMigrationHint =
  'Metin görseli kaydedilemedi: veritabanında "image" kolonu yok. Supabase SQL Editor üzerinde ' +
  'supabase/migrations/20260911090000_reading_images.sql dosyasını çalıştırın.'

const rsvpMigrationHint =
  'Hızlı kelime akışı kaydedilemedi: veritabanında "display_mode" kolonu yok. Supabase SQL Editor ' +
  'üzerinde supabase/migrations/20261013120000_rsvp_reading_mode.sql dosyasını çalıştırın.'

const runTolerant = async (run) => {
  const omitted = []
  for (;;) {
    const result = await run(selectList(passageFields, omitted), omitted)
    if (!result.error) return { ...result, omitted }
    const missing = detectMissingColumn(result.error, optionalPassageFields)
    if (!missing || omitted.includes(missing)) return { ...result, omitted }
    omitted.push(missing)
  }
}

export const toPassage = (row) => ({
  id: row.id,
  teacherId: row.teacher_id,
  title: row.title,
  sourceLabel: row.source_label || '',
  body: row.body,
  image: row.image || '',
  grade: Number(row.grade),
  subject: row.subject,
  topic: row.topic || 'okuma-anlama',
  displayMode: row.display_mode === 'rsvp' ? 'rsvp' : 'static',
  rsvpSecondsPerWord: normalizeSecondsPerWord(row.rsvp_seconds_per_word),
  quizThreshold: Number(row.quiz_threshold ?? 60),
  showPassageDuringQuiz:
    row.display_mode === 'rsvp' ? false : row.show_passage_during_quiz !== false,
  questions: Array.isArray(row.questions) ? row.questions : [],
  createdAt: row.created_at
})

const missingPassageColumns = () =>
  probeMissingColumns({
    fields: passageFields,
    optional: optionalPassageFields,
    run: (fields) => requireSupabase().from('reading_passages').select(fields).limit(1)
  })

export const fetchTeacherPassages = async () => {
  const { data, error, omitted } = await runTolerant((fields) =>
    requireSupabase().from('reading_passages').select(fields).order('created_at', { ascending: false })
  )

  if (error) throw new Error(`Okuma kütüphanesi yüklenemedi: ${error.message}`)
  return { passages: (data || []).map(toPassage), missingColumns: omitted || [] }
}

export const createPassage = async ({ teacherId, passage }) => {
  const normalized = normalizeReading(passage)
  const row = {
    teacher_id: teacherId,
    title: normalized.title,
    source_label: normalized.sourceLabel || '',
    body: normalized.body,
    image: normalized.image,
    grade: normalized.grade,
    subject: normalized.subject,
    topic: normalized.topic,
    display_mode: normalized.displayMode,
    rsvp_seconds_per_word: normalized.rsvpSecondsPerWord,
    quiz_threshold: normalized.quizThreshold,
    show_passage_during_quiz: normalized.showPassageDuringQuiz !== false,
    questions: normalized.questions
  }

  // Görsel/akış modu kaydedilecekse kolonları ÖNCE doğrula, veri sessizce düşmesin.
  if (normalized.image || normalized.displayMode === 'rsvp') {
    const missing = await missingPassageColumns()
    if (normalized.image && missing.includes('image')) throw new Error(imageMigrationHint)
    if (normalized.displayMode === 'rsvp' && missing.includes('display_mode'))
      throw new Error(rsvpMigrationHint)
  }

  const inserted = await runTolerant((fields, dropped) =>
    requireSupabase().from('reading_passages').insert(dropKeys(row, dropped)).select(fields).single()
  )

  if (!inserted.error) return { passage: toPassage(inserted.data), updated: false }

  if (inserted.error.code !== '23505') {
    throw new Error(`Metin kaydedilemedi: ${inserted.error.message}`)
  }

  // Aynı başlıkla kayıtlı metin varsa içeriği tazele (görsel eklemek için yeniden kaydetmek yeterli).
  const refreshed = await runTolerant((fields, dropped) =>
    requireSupabase()
      .from('reading_passages')
      .update(dropKeys(row, dropped))
      .eq('teacher_id', teacherId)
      .eq('title', normalized.title)
      .select(fields)
      .single()
  )

  if (refreshed.error) throw new Error(`Metin güncellenemedi: ${refreshed.error.message}`)
  return { passage: toPassage(refreshed.data), updated: true }
}

export const deletePassage = async (id) => {
  const { error } = await requireSupabase().from('reading_passages').delete().eq('id', id)
  if (error) throw new Error(`Metin silinemedi: ${error.message}`)
}
