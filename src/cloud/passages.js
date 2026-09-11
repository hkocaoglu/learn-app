import { requireSupabase } from '../lib/supabase.js'
import { normalizeReading } from '../domain/model.js'
import { detectMissingColumn, dropKeys, selectList } from './schemaFallback.js'

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
  'quiz_threshold',
  'show_passage_during_quiz',
  'questions',
  'created_at'
]

const optionalPassageFields = ['show_passage_during_quiz', 'image']

const imageMigrationHint =
  'Metin görseli kaydedilemedi: veritabanında "image" kolonu yok. Supabase SQL Editor üzerinde ' +
  'supabase/migrations/20260911090000_reading_images.sql dosyasını çalıştırın.'

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
  quizThreshold: Number(row.quiz_threshold ?? 60),
  showPassageDuringQuiz: row.show_passage_during_quiz !== false,
  questions: Array.isArray(row.questions) ? row.questions : [],
  createdAt: row.created_at
})

export const fetchTeacherPassages = async () => {
  const { data, error } = await runTolerant((fields) =>
    requireSupabase().from('reading_passages').select(fields).order('created_at', { ascending: false })
  )

  if (error) throw new Error(`Okuma kütüphanesi yüklenemedi: ${error.message}`)
  return (data || []).map(toPassage)
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
    quiz_threshold: normalized.quizThreshold,
    show_passage_during_quiz: normalized.showPassageDuringQuiz !== false,
    questions: normalized.questions
  }

  const { data, error, omitted } = await runTolerant((fields, dropped) =>
    requireSupabase().from('reading_passages').insert(dropKeys(row, dropped)).select(fields).single()
  )

  if (error) {
    if (omitted.includes('image') && normalized.image) throw new Error(imageMigrationHint)
    if (error.code === '23505') throw new Error('Bu başlıkla bir metin zaten kayıtlı.')
    throw new Error(`Metin kaydedilemedi: ${error.message}`)
  }

  return toPassage(data)
}

export const deletePassage = async (id) => {
  const { error } = await requireSupabase().from('reading_passages').delete().eq('id', id)
  if (error) throw new Error(`Metin silinemedi: ${error.message}`)
}
