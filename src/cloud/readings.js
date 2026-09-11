import { requireSupabase } from '../lib/supabase.js'
import { normalizeReading, requiredDwellSeconds } from '../domain/model.js'
import { scoreAttempt } from '../domain/scoring.js'
import { detectMissingColumn, dropKeys, probeMissingColumns, selectList } from './schemaFallback.js'

const readingFields = [
  'id',
  'teacher_id',
  'class_id',
  'title',
  'source_label',
  'body',
  'grade',
  'subject',
  'topic',
  'min_dwell_seconds',
  'quiz_threshold',
  'show_passage_during_quiz',
  'image',
  'questions',
  'starts_at',
  'ends_at',
  'published',
  'created_at'
]

// Henüz uygulanmamış migration'lara ait kolonlar: sorgu bunlarsız tekrarlanır.
const optionalReadingFields = ['show_passage_during_quiz', 'image']

const imageMigrationHint =
  'Metin görseli kaydedilemedi: veritabanında "image" kolonu yok. Supabase SQL Editor üzerinde ' +
  'supabase/migrations/20260911090000_reading_images.sql dosyasını çalıştırın.'

// Opsiyonel kolonlar eksikse isteği onlarsız tekrarlar.
const runTolerant = async (run) => {
  const omitted = []
  for (;;) {
    const result = await run(selectList(readingFields, omitted), omitted)
    if (!result.error) return { ...result, omitted }
    const missing = detectMissingColumn(result.error, optionalReadingFields)
    if (!missing || omitted.includes(missing)) return { ...result, omitted }
    omitted.push(missing)
  }
}

// Yazma öncesi: hangi opsiyonel kolonlar yok? (Veri sessizce düşmesin.)
const missingReadingColumns = () =>
  probeMissingColumns({
    fields: readingFields,
    optional: optionalReadingFields,
    run: (fields) => requireSupabase().from('reading_assignments').select(fields).limit(1)
  })

export const toReading = (row, classesById) => {
  const classRow = classesById?.get(row.class_id)
  return {
    id: row.id,
    teacherId: row.teacher_id,
    classId: row.class_id,
    className: classRow?.name || '',
    title: row.title,
    sourceLabel: row.source_label || '',
    body: row.body,
    image: row.image || '',
    grade: Number(row.grade),
    subject: row.subject,
    topic: row.topic || 'okuma-anlama',
    minDwellSeconds: row.min_dwell_seconds ?? null,
    quizThreshold: Number(row.quiz_threshold ?? 60),
    showPassageDuringQuiz: row.show_passage_during_quiz !== false,
    questions: Array.isArray(row.questions) ? row.questions : [],
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    published: Boolean(row.published),
    createdAt: row.created_at
  }
}

const readRows = async () => {
  const client = requireSupabase()
  const [readingResult, classResult] = await Promise.all([
    runTolerant((fields) =>
      client.from('reading_assignments').select(fields).order('created_at', { ascending: false })
    ),
    client.from('classes').select('id, name, grade').order('name')
  ])

  if (readingResult.error) throw new Error(`Okuma ödevleri yüklenemedi: ${readingResult.error.message}`)
  if (classResult.error) throw new Error(`Okuma sınıfları yüklenemedi: ${classResult.error.message}`)

  const classesById = new Map((classResult.data || []).map((item) => [item.id, item]))

  return {
    readings: (readingResult.data || []).map((row) => toReading(row, classesById)),
    classes: classResult.data || [],
    missingColumns: readingResult.omitted || []
  }
}


export const fetchTeacherReadings = async () => readRows()

export const createReading = async ({ teacherId, classId, reading, startsAt, endsAt, published = true }) => {
  if (endsAt && startsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error('Bitiş tarihi başlangıçtan sonra olmalı.')
  }
  const normalized = normalizeReading(reading)
  const baseRow = {
    teacher_id: teacherId,
    class_id: classId,
    title: normalized.title,
    source_label: normalized.sourceLabel || '',
    body: normalized.body,
    image: normalized.image,
    grade: normalized.grade,
    subject: normalized.subject,
    topic: normalized.topic,
    min_dwell_seconds: normalized.minDwellSeconds,
    quiz_threshold: normalized.quizThreshold,
    show_passage_during_quiz: normalized.showPassageDuringQuiz !== false,
    questions: normalized.questions,
    starts_at: startsAt || null,
    ends_at: endsAt || null,
    published: Boolean(published)
  }

  // Görsel gönderilecekse kolonun varlığını ÖNCE doğrula: aksi halde görsel sessizce
  // düşer ve öğrenci görseli hiç görmez.
  if (normalized.image && (await missingReadingColumns()).includes('image')) {
    throw new Error(imageMigrationHint)
  }

  const inserted = await runTolerant((fields, dropped) =>
    requireSupabase()
      .from('reading_assignments')
      .insert(dropKeys(baseRow, dropped))
      .select(fields)
      .single()
  )

  if (!inserted.error) return { reading: inserted.data, updated: false }

  if (inserted.error.code !== '23505') {
    throw new Error(`Okuma atanamadı: ${inserted.error.message}`)
  }

  // Aynı sınıfa aynı başlıkla atama zaten var: içeriği (görsel/quiz dâhil) tazele.
  // Silip yeniden göndermek öğrenci kanıtlarını cascade ile silerdi.
  const refreshed = await runTolerant((fields, dropped) =>
    requireSupabase()
      .from('reading_assignments')
      .update(dropKeys(baseRow, dropped))
      .eq('class_id', classId)
      .eq('title', normalized.title)
      .select(fields)
      .single()
  )

  if (refreshed.error) throw new Error(`Okuma güncellenemedi: ${refreshed.error.message}`)
  return { reading: refreshed.data, updated: true }
}

export const updateReading = async ({ id, published, startsAt, endsAt }) => {
  const payload = {
    published: Boolean(published),
    starts_at: startsAt || null,
    ends_at: endsAt || null
  }
  const { data, error } = await runTolerant((fields) =>
    requireSupabase().from('reading_assignments').update(payload).eq('id', id).select(fields).single()
  )
  if (error) throw new Error(`Okuma güncellenemedi: ${error.message}`)
  return data
}

export const deleteReading = async (id) => {
  const { error } = await requireSupabase().from('reading_assignments').delete().eq('id', id)
  if (error) throw new Error(`Okuma silinemedi: ${error.message}`)
}

export const fetchStudentReadings = async (studentId) => {
  if (!studentId) throw new Error('Öğrenci kimliği bulunamadı.')
  const client = requireSupabase()
  const { data: readings, error: readingError } = await runTolerant((fields) =>
    client
      .from('reading_assignments')
      .select(fields)
      .eq('published', true)
      .order('created_at', { ascending: false })
  )

  if (readingError) throw new Error(`Atanan okumalar yüklenemedi: ${readingError.message}`)

  const { data: attempts, error: attemptError } = await client
    .from('reading_attempts')
    .select('id, reading_assignment_id, score_percent, dwell_seconds, scrolled_bottom, read, total_seconds, submitted_at, created_at')
    .eq('student_id', studentId)
  if (attemptError) throw new Error(`Okuma sonuçları yüklenemedi: ${attemptError.message}`)

  const attemptsByReading = new Map((attempts || []).map((item) => [item.reading_assignment_id, item]))
  const now = Date.now()

  return (readings || []).map((row) => {
    const isStarted = !row.starts_at || new Date(row.starts_at).getTime() <= now
    const isNotExpired = !row.ends_at || new Date(row.ends_at).getTime() >= now
    return {
      ...row,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      reading: {
        id: row.id,
        title: row.title,
        sourceLabel: row.source_label || '',
        body: row.body,
        image: row.image || '',
        grade: Number(row.grade),
        subject: row.subject,
        topic: row.topic || 'okuma-anlama',
        minDwellSeconds: row.min_dwell_seconds ?? null,
        quizThreshold: Number(row.quiz_threshold ?? 60),
        showPassageDuringQuiz: row.show_passage_during_quiz !== false,
        questions: Array.isArray(row.questions) ? row.questions : []
      },
      attempt: attemptsByReading.get(row.id) || null,
      available: Boolean(isStarted && isNotExpired)
    }
  })
}

export const fetchReadingAttempts = async (readingAssignmentId) => {
  if (!readingAssignmentId) throw new Error('Okuma kimliği bulunamadı.')
  const { data, error } = await requireSupabase()
    .from('reading_attempts')
    .select('id, student_id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, submitted_at')
    .eq('reading_assignment_id', readingAssignmentId)
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(`Okuma sonuçları yüklenemedi: ${error.message}`)
  return data || []
}

export const evaluateReadingGates = ({ reading, answers, dwellSeconds, scrolledBottom }) => {
  const required = requiredDwellSeconds(reading)
  const dwellOk = Number(dwellSeconds) >= required
  const scrollOk = scrolledBottom === true
  const questions = Array.isArray(reading?.questions) ? reading.questions : []
  const scored =
    questions.length === 0
      ? { correctCount: 0, totalCount: 0, scorePercent: 100, details: [], totalSeconds: 0, topicStats: [] }
      : scoreAttempt(
          { title: reading.title, grade: reading.grade, subject: reading.subject, questions },
          answers || {}
        )
  const threshold = Number(reading?.quizThreshold ?? 60)
  const quizOk = questions.length === 0 ? true : scored.scorePercent >= threshold
  return { required, dwellOk, scrollOk, quizOk, scored, read: dwellOk && scrollOk && quizOk }
}

export const submitReadingAttempt = async ({
  student,
  readingAssignment,
  reading,
  answers,
  dwellSeconds,
  scrolledBottom,
  totalSeconds,
  startedAt
}) => {
  const gates = evaluateReadingGates({ reading, answers, dwellSeconds, scrolledBottom })
  const attemptAnswers = gates.scored.details.map((detail) => ({
    questionId: detail.question.id,
    questionText: detail.question.text,
    options: detail.question.options,
    image: detail.question.image || '',
    subject: reading.subject,
    topic: detail.topic,
    selected: detail.selected,
    correctIndex: detail.question.correctIndex,
    correct: detail.correct,
    seconds: detail.seconds
  }))

  const { data, error } = await requireSupabase()
    .from('reading_attempts')
    .insert({
      teacher_id: student.teacherId,
      reading_assignment_id: readingAssignment.id,
      student_id: student.id,
      dwell_seconds: Math.max(0, Math.round(Number(dwellSeconds) || 0)),
      scrolled_bottom: Boolean(scrolledBottom),
      correct_count: gates.scored.correctCount,
      total_count: gates.scored.totalCount,
      score_percent: gates.scored.scorePercent,
      read: gates.read,
      total_seconds: Math.max(0, Math.round(Number(totalSeconds) || 0)),
      started_at: new Date(startedAt).toISOString(),
      submitted_at: new Date().toISOString()
    })
    .select('id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, submitted_at, created_at')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Bu okuma için zaten kaydınız var.')
    throw new Error(`Okuma sonucu kaydedilemedi: ${error.message}`)
  }

  return {
    id: data.id,
    readingAssignmentId: readingAssignment.id,
    studentId: student.id,
    dwellSeconds: data.dwell_seconds,
    scrolledBottom: Boolean(data.scrolled_bottom),
    correctCount: data.correct_count,
    totalCount: data.total_count,
    scorePercent: data.score_percent,
    read: Boolean(data.read),
    totalSeconds: data.total_seconds,
    answers: attemptAnswers,
    gates: { dwellOk: gates.dwellOk, scrollOk: gates.scrollOk, quizOk: gates.quizOk, required: gates.required }
  }
}
