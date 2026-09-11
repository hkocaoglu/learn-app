import { requireSupabase } from '../lib/supabase.js'
import { normalizeReading } from '../domain/model.js'

const passageFields =
  'id, teacher_id, title, source_label, body, grade, subject, topic, quiz_threshold, show_passage_during_quiz, questions, created_at'

export const toPassage = (row) => ({
  id: row.id,
  teacherId: row.teacher_id,
  title: row.title,
  sourceLabel: row.source_label || '',
  body: row.body,
  grade: Number(row.grade),
  subject: row.subject,
  topic: row.topic || 'okuma-anlama',
  quizThreshold: Number(row.quiz_threshold ?? 60),
  showPassageDuringQuiz: row.show_passage_during_quiz !== false,
  questions: Array.isArray(row.questions) ? row.questions : [],
  createdAt: row.created_at
})

export const fetchTeacherPassages = async () => {
  const { data, error } = await requireSupabase()
    .from('reading_passages')
    .select(passageFields)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Okuma kütüphanesi yüklenemedi: ${error.message}`)
  return (data || []).map(toPassage)
}

export const createPassage = async ({ teacherId, passage }) => {
  const normalized = normalizeReading(passage)
  const { data, error } = await requireSupabase()
    .from('reading_passages')
    .insert({
      teacher_id: teacherId,
      title: normalized.title,
      source_label: normalized.sourceLabel || '',
      body: normalized.body,
      grade: normalized.grade,
      subject: normalized.subject,
      topic: normalized.topic,
      quiz_threshold: normalized.quizThreshold,
      show_passage_during_quiz: normalized.showPassageDuringQuiz !== false,
      questions: normalized.questions
    })
    .select(passageFields)
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Bu başlıkla bir metin zaten kayıtlı.')
    throw new Error(`Metin kaydedilemedi: ${error.message}`)
  }

  return toPassage(data)
}

export const deletePassage = async (id) => {
  const { error } = await requireSupabase().from('reading_passages').delete().eq('id', id)
  if (error) throw new Error(`Metin silinemedi: ${error.message}`)
}
