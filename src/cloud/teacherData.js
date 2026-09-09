import { requireSupabase } from '../lib/supabase.js'
import { scoreAttempt } from '../domain/scoring.js'
import { fetchStudents } from './students.js'

const questionFields =
  'id, teacher_id, grade, subject, topic, text, options, correct_index, explanation, image, is_shared, created_at, updated_at'
const testFields = 'id, teacher_id, title, grade, subject, duration_minutes, questions, created_at, updated_at'
const attemptFields =
  'id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, started_at, submitted_at, created_at'

const mapQuestion = (row) => ({
  id: row.id,
  teacherId: row.teacher_id,
  grade: Number(row.grade),
  subject: row.subject,
  topic: row.topic,
  text: row.text,
  options: Array.isArray(row.options) ? row.options : [],
  correctIndex: Number(row.correct_index),
  explanation: row.explanation || '',
  image: row.image || '',
  isShared: Boolean(row.is_shared),
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mapTest = (row) => ({
  id: row.id,
  teacherId: row.teacher_id,
  title: row.title,
  grade: Number(row.grade),
  subject: row.subject,
  durationMinutes: row.duration_minutes ?? null,
  questions: Array.isArray(row.questions) ? row.questions : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const topicStatsFromAnswers = (answers, fallbackSubject = '') => {
  const topics = new Map()
  for (const answer of Array.isArray(answers) ? answers : []) {
    const subject = String(answer.subject || fallbackSubject)
    const topic = String(answer.topic || 'genel')
    const key = `${subject}::${topic}`
    if (!topics.has(key)) topics.set(key, { subject, topic, correct: 0, total: 0, seconds: 0 })
    const current = topics.get(key)
    current.total += 1
    current.seconds += Math.max(0, Number(answer.seconds) || 0)
    if (answer.correct === true || (answer.correct !== false && answer.selected === answer.correctIndex)) {
      current.correct += 1
    }
  }
  return [...topics.values()]
}

const mapAttempt = (row, assignmentsById, testsById) => {
  const assignment = assignmentsById.get(row.assignment_id)
  const test = assignment ? testsById.get(assignment.test_id) : null
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    testId: assignment?.test_id || '',
    testTitle: test?.title || 'Bilinmeyen test',
    subject: test?.subject || '',
    grade: test?.grade || null,
    date: row.submitted_at || row.created_at,
    correctCount: Number(row.correct_count || 0),
    totalCount: Number(row.total_count || 0),
    scorePercent: Number(row.score_percent || 0),
    topicStats: topicStatsFromAnswers(row.answers, test?.subject),
    durationMinutes: test?.durationMinutes ?? null,
    totalSeconds: Number(row.total_seconds || 0),
    timeUp: Boolean(row.time_up),
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    answers: Array.isArray(row.answers) ? row.answers : []
  }
}

const readError = (prefix, error) => {
  if (!error) return new Error(prefix)
  if (/is_shared|question_bank/i.test(error.message || '') && /column|schema|does not exist/i.test(error.message || '')) {
    return new Error(`${prefix}: Supabase soru bankası migration'ı eksik. 20260909160000_shared_question_bank.sql dosyasını çalıştırın.`)
  }
  return new Error(`${prefix}: ${error.message}`)
}

export const fetchTeacherData = async () => {
  const client = requireSupabase()
  const [bankResult, testResult, assignmentResult, attemptResult, students] = await Promise.all([
    client.from('question_bank').select(questionFields).order('created_at', { ascending: false }),
    client.from('tests').select(testFields).order('created_at', { ascending: false }),
    client.from('assignments').select('id, test_id'),
    client.from('attempts').select(attemptFields).order('created_at', { ascending: false }),
    fetchStudents()
  ])

  if (bankResult.error) throw readError('Soru bankası yüklenemedi', bankResult.error)
  if (testResult.error) throw readError('Testler yüklenemedi', testResult.error)
  if (assignmentResult.error) throw readError('Test atamaları yüklenemedi', assignmentResult.error)
  if (attemptResult.error) throw readError('Sonuçlar yüklenemedi', attemptResult.error)

  const tests = (testResult.data || []).map(mapTest)
  const testsById = new Map(tests.map((test) => [test.id, test]))
  const assignmentsById = new Map((assignmentResult.data || []).map((assignment) => [assignment.id, assignment]))

  return {
    version: 1,
    students,
    tests,
    bank: (bankResult.data || []).map(mapQuestion),
    attempts: (attemptResult.data || []).map((attempt) => mapAttempt(attempt, assignmentsById, testsById)),
    aiReports: {}
  }
}

const questionPayload = (teacherId, question) => ({
  teacher_id: teacherId,
  grade: Number(question.grade),
  subject: question.subject,
  topic: String(question.topic || '').trim(),
  text: String(question.text || '').trim(),
  options: Array.isArray(question.options) ? question.options : [],
  correct_index: Number(question.correctIndex),
  explanation: String(question.explanation || ''),
  image: String(question.image || ''),
  is_shared: Boolean(question.isShared)
})

export const createCloudQuestions = async (teacherId, questions) => {
  const rows = (questions || []).map((question) => questionPayload(teacherId, question))
  if (!rows.length) return []

  const { data, error } = await requireSupabase()
    .from('question_bank')
    .insert(rows)
    .select(questionFields)
  if (error) throw readError("Sorular cloud'a kaydedilemedi", error)
  return (data || []).map(mapQuestion)
}

export const updateCloudQuestion = async (id, patch) => {
  const payload = {}
  if (patch.grade !== undefined) payload.grade = Number(patch.grade)
  if (patch.subject !== undefined) payload.subject = patch.subject
  if (patch.topic !== undefined) payload.topic = String(patch.topic || '').trim()
  if (patch.text !== undefined) payload.text = String(patch.text || '').trim()
  if (patch.options !== undefined) payload.options = Array.isArray(patch.options) ? patch.options : []
  if (patch.correctIndex !== undefined) payload.correct_index = Number(patch.correctIndex)
  if (patch.explanation !== undefined) payload.explanation = String(patch.explanation || '')
  if (patch.image !== undefined) payload.image = String(patch.image || '')
  if (patch.isShared !== undefined) payload.is_shared = Boolean(patch.isShared)

  const { data, error } = await requireSupabase()
    .from('question_bank')
    .update(payload)
    .eq('id', id)
    .select(questionFields)
    .single()
  if (error) throw readError('Soru güncellenemedi', error)
  return mapQuestion(data)
}

export const deleteCloudQuestion = async (id) => {
  const { error } = await requireSupabase().from('question_bank').delete().eq('id', id)
  if (error) throw readError('Soru silinemedi', error)
}

export const createCloudTest = async (teacherId, test) => {
  const { data, error } = await requireSupabase()
    .from('tests')
    .insert({
      teacher_id: teacherId,
      title: String(test.title || '').trim(),
      grade: Number(test.grade),
      subject: test.subject,
      duration_minutes: test.durationMinutes ?? null,
      questions: Array.isArray(test.questions) ? test.questions : []
    })
    .select(testFields)
    .single()
  if (error) throw readError("Test cloud'a kaydedilemedi", error)
  return mapTest(data)
}

export const updateCloudTest = async (id, patch) => {
  const { data, error } = await requireSupabase()
    .from('tests')
    .update({
      title: String(patch.title || '').trim(),
      duration_minutes: patch.durationMinutes ?? null,
      questions: Array.isArray(patch.questions) ? patch.questions : []
    })
    .eq('id', id)
    .select(testFields)
    .single()
  if (error) throw readError('Test güncellenemedi', error)
  return mapTest(data)
}

export const deleteCloudTest = async (id) => {
  const { error } = await requireSupabase().from('tests').delete().eq('id', id)
  if (error) throw readError('Test silinemedi', error)
}

const resolveTeacherAssignment = async ({ teacherId, testId, studentId, assignmentId }) => {
  if (assignmentId) return assignmentId

  const client = requireSupabase()
  const { data: student, error: studentError } = await client
    .from('students')
    .select('id, class_id')
    .eq('id', studentId)
    .eq('teacher_id', teacherId)
    .single()
  if (studentError || !student) {
    throw readError('Sınav öğrencisi doğrulanamadı', studentError)
  }

  const { data: existing, error: existingError } = await client
    .from('assignments')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('class_id', student.class_id)
    .eq('test_id', testId)
    .maybeSingle()
  if (existingError) throw readError('Sınav ataması doğrulanamadı', existingError)
  if (existing?.id) return existing.id

  const { data: created, error: createError } = await client
    .from('assignments')
    .insert({
      teacher_id: teacherId,
      class_id: student.class_id,
      test_id: testId,
      max_attempts: 1,
      published: false
    })
    .select('id')
    .single()

  if (!createError && created?.id) return created.id
  if (createError?.code === '23505') {
    const { data: concurrentAssignment, error: concurrentError } = await client
      .from('assignments')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('class_id', student.class_id)
      .eq('test_id', testId)
      .single()
    if (!concurrentError && concurrentAssignment?.id) return concurrentAssignment.id
  }
  throw readError('Sınav ataması oluşturulamadı', createError)
}

export const createTeacherAttempt = async ({ teacherId, test, studentId, answers, timing = {} }) => {
  const scored = scoreAttempt(test, answers, { timeByQid: timing.timeByQid })
  const attemptAnswers = scored.details.map((detail) => ({
    questionId: detail.question.id,
    questionText: detail.question.text,
    options: detail.question.options,
    image: detail.question.image || '',
    subject: test.subject,
    topic: detail.topic,
    selected: detail.selected,
    correctIndex: detail.question.correctIndex,
    correct: detail.correct,
    seconds: detail.seconds
  }))
  const totalSeconds = Math.max(0, Math.round(Number(timing.totalSeconds) || scored.totalSeconds))
  const startedAt = timing.startedAt
    ? new Date(timing.startedAt).toISOString()
    : new Date(Date.now() - totalSeconds * 1000).toISOString()
  const assignmentId = await resolveTeacherAssignment({
    teacherId,
    testId: test.id,
    studentId,
    assignmentId: timing.assignmentId
  })

  const { data, error } = await requireSupabase()
    .from('attempts')
    .insert({
      teacher_id: teacherId,
      assignment_id: assignmentId,
      student_id: studentId,
      answers: attemptAnswers,
      correct_count: scored.correctCount,
      total_count: scored.totalCount,
      score_percent: scored.scorePercent,
      total_seconds: totalSeconds,
      time_up: Boolean(timing.timeUp),
      started_at: startedAt,
      submitted_at: new Date().toISOString()
    })
    .select(attemptFields)
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Bu öğrenci için bu testte zaten tamamlanmış bir deneme var.')
    throw readError("Sonuç cloud'a kaydedilemedi", error)
  }
  const assignments = new Map([[assignmentId, { test_id: test.id }]])
  const tests = new Map([[test.id, test]])
  return mapAttempt(data, assignments, tests)
}

export const deleteTeacherAttempt = async (id) => {
  const { error } = await requireSupabase().from('attempts').delete().eq('id', id)
  if (error) throw readError('Sonuç silinemedi', error)
}
