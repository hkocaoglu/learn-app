import { requireSupabase } from '../lib/supabase.js'
import { normalizeReading, normalizeSecondsPerWord } from '../domain/model.js'
// Kapı mantığı saf domain modülünde yaşar (src/domain/readingGates.js) — testler aynı kodu çalıştırır.
import { evaluateReadingGates } from '../domain/readingGates.js'
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
  'display_mode',
  'rsvp_seconds_per_word',
  'min_dwell_seconds',
  'quiz_threshold',
  'points',
  'show_passage_during_quiz',
  'image',
  'questions',
  'starts_at',
  'ends_at',
  'published',
  'created_at'
]

// Henüz uygulanmamış migration'lara ait kolonlar: sorgu bunlarsız tekrarlanır.
const optionalReadingFields = [
  'show_passage_during_quiz',
  'image',
  'display_mode',
  'rsvp_seconds_per_word',
  'points'
]

const rsvpMigrationHint =
  'Hızlı kelime akışı kaydedilemedi: veritabanında "display_mode" kolonu yok. Supabase SQL Editor ' +
  'üzerinde supabase/migrations/20261013120000_rsvp_reading_mode.sql dosyasını çalıştırın.'

const imageMigrationHint =
  'Metin görseli kaydedilemedi: veritabanında "image" kolonu yok. Supabase SQL Editor üzerinde ' +
  'supabase/migrations/20260911090000_reading_images.sql dosyasını çalıştırın.'

// Okuma denemesi kolonları: rsvp_plays yalnızca akış modu migration'ı ile gelir.
const attemptFields = [
  'id',
  'reading_assignment_id',
  'student_id',
  'dwell_seconds',
  'scrolled_bottom',
  'correct_count',
  'total_count',
  'score_percent',
  'read',
  'total_seconds',
  'rsvp_plays',
  'submitted_at',
  'created_at'
]

const optionalAttemptFields = ['rsvp_plays']

// Opsiyonel kolonlar eksikse isteği onlarsız tekrarlar.
const runTolerant = async (
  run,
  { fields = readingFields, optional = optionalReadingFields } = {}
) => {
  const omitted = []
  for (;;) {
    const result = await run(selectList(fields, omitted), omitted)
    if (!result.error) return { ...result, omitted }
    const missing = detectMissingColumn(result.error, optional)
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
  const displayMode = row.display_mode === 'rsvp' ? 'rsvp' : 'static'
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
    displayMode,
    rsvpSecondsPerWord: normalizeSecondsPerWord(row.rsvp_seconds_per_word),
    minDwellSeconds: row.min_dwell_seconds ?? null,
    quizThreshold: Number(row.quiz_threshold ?? 60),
    points: Number(row.points ?? 10),
    // Akış modunda metin quiz sırasında ASLA görünmez (ölçümü bozar).
    showPassageDuringQuiz: displayMode === 'rsvp' ? false : row.show_passage_during_quiz !== false,
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

export const createReading = async ({ teacherId, classId, reading, startsAt, endsAt, published = true, points = 10 }) => {
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
    display_mode: normalized.displayMode,
    rsvp_seconds_per_word: normalized.rsvpSecondsPerWord,
    min_dwell_seconds: normalized.minDwellSeconds,
    quiz_threshold: normalized.quizThreshold,
    points: Number(points),
    show_passage_during_quiz: normalized.showPassageDuringQuiz !== false,
    questions: normalized.questions,
    starts_at: startsAt || null,
    ends_at: endsAt || null,
    published: Boolean(published)
  }

  // Görsel ya da akış modu gönderilecekse kolonların varlığını ÖNCE doğrula: aksi halde
  // veri sessizce düşer (görsel kaybolur, akış modu 'static' olarak kaydedilir).
  if (normalized.image || normalized.displayMode === 'rsvp') {
    const missing = await missingReadingColumns()
    if (normalized.image && missing.includes('image')) throw new Error(imageMigrationHint)
    if (normalized.displayMode === 'rsvp' && missing.includes('display_mode'))
      throw new Error(rsvpMigrationHint)
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

export const updateReading = async ({ id, published, startsAt, endsAt, points }) => {
  const payload = {
    published: Boolean(published),
    starts_at: startsAt || null,
    ends_at: endsAt || null
  }
  if (points !== undefined) payload.points = Number(points)
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

  const { data: attempts, error: attemptError } = await runTolerant(
    (fields) => client.from('reading_attempts').select(fields).eq('student_id', studentId),
    { fields: attemptFields, optional: optionalAttemptFields }
  )
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
        displayMode: row.display_mode === 'rsvp' ? 'rsvp' : 'static',
        rsvpSecondsPerWord: normalizeSecondsPerWord(row.rsvp_seconds_per_word),
        minDwellSeconds: row.min_dwell_seconds ?? null,
        quizThreshold: Number(row.quiz_threshold ?? 60),
        points: Number(row.points ?? 10),
        showPassageDuringQuiz:
          row.display_mode === 'rsvp' ? false : row.show_passage_during_quiz !== false,
        questions: Array.isArray(row.questions) ? row.questions : []
      },
      attempt: attemptsByReading.get(row.id) || null,
      available: Boolean(isStarted && isNotExpired)
    }
  })
}

export const fetchReadingAttempts = async (readingAssignmentId) => {
  if (!readingAssignmentId) throw new Error('Okuma kimliği bulunamadı.')
  const { data, error } = await runTolerant(
    (fields) =>
      requireSupabase()
        .from('reading_attempts')
        .select(fields)
        .eq('reading_assignment_id', readingAssignmentId)
        .order('submitted_at', { ascending: false }),
    { fields: attemptFields, optional: optionalAttemptFields }
  )

  if (error) throw new Error(`Okuma sonuçları yüklenemedi: ${error.message}`)
  return data || []
}

export const submitReadingAttempt = async ({
  student,
  readingAssignment,
  reading,
  answers,
  dwellSeconds,
  scrolledBottom,
  flowCompleted,
  rsvpPlays,
  totalSeconds,
  startedAt
}) => {
  const gates = evaluateReadingGates({ reading, answers, dwellSeconds, scrolledBottom, flowCompleted })
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

  const plays = Math.max(0, Math.round(Number(rsvpPlays) || 0))
  const row = {
    teacher_id: student.teacherId,
    reading_assignment_id: readingAssignment.id,
    student_id: student.id,
    dwell_seconds: Math.max(0, Math.round(Number(dwellSeconds) || 0)),
    // Akış modunda kalıcı kanıt "sonuna kadar izlendi"dir; static modda kaydırma.
    scrolled_bottom: gates.rsvp ? gates.flowOk : Boolean(scrolledBottom),
    correct_count: gates.scored.correctCount,
    total_count: gates.scored.totalCount,
    score_percent: gates.scored.scorePercent,
    read: gates.read,
    total_seconds: Math.max(0, Math.round(Number(totalSeconds) || 0)),
    started_at: new Date(startedAt).toISOString(),
    submitted_at: new Date().toISOString()
  }
  // rsvp_plays kolonu migration ile gelir; 0 varsayılanına güvenip boşuna göndermeyiz.
  if (plays > 0) row.rsvp_plays = plays

  const selectAttempt = () =>
    requireSupabase()
      .from('reading_attempts')
      .insert(row)
      .select('id, dwell_seconds, scrolled_bottom, correct_count, total_count, score_percent, read, total_seconds, submitted_at, created_at')
      .single()

  let { data, error } = await selectAttempt()
  // Kolon yoksa gönderimi düşürme: izleme sayısı kaybolur ama öğrenci sonucu kaydedilir.
  if (error && row.rsvp_plays !== undefined && detectMissingColumn(error, ['rsvp_plays'])) {
    delete row.rsvp_plays
    ;({ data, error } = await selectAttempt())
  }

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
    gates: {
      rsvp: gates.rsvp,
      flowOk: gates.flowOk,
      dwellOk: gates.dwellOk,
      scrollOk: gates.scrollOk,
      quizOk: gates.quizOk,
      required: gates.required
    }
  }
}
