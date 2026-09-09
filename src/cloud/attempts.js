import { requireSupabase } from '../lib/supabase.js'
import { scoreAttempt } from '../domain/scoring.js'

const mapAttempt = (row, test, assignmentId, studentId) => ({
  id: row.id,
  assignmentId,
  studentId,
  testId: test.id,
  testTitle: test.title,
  subject: test.subject,
  grade: test.grade,
  date: row.submitted_at || row.created_at,
  correctCount: row.correct_count,
  totalCount: row.total_count,
  scorePercent: row.score_percent,
  totalSeconds: row.total_seconds,
  timeUp: Boolean(row.time_up),
  answers: Array.isArray(row.answers) ? row.answers : []
})

export const submitStudentAttempt = async ({
  student,
  assignment,
  test,
  answers,
  timeByQid,
  totalSeconds,
  timeUp,
  startedAt
}) => {
  const scored = scoreAttempt(test, answers, { timeByQid })
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

  const { data, error } = await requireSupabase()
    .from('attempts')
    .insert({
      teacher_id: student.teacherId,
      assignment_id: assignment.id,
      student_id: student.id,
      answers: attemptAnswers,
      correct_count: scored.correctCount,
      total_count: scored.totalCount,
      score_percent: scored.scorePercent,
      total_seconds: Math.max(0, Math.round(Number(totalSeconds) || scored.totalSeconds)),
      time_up: Boolean(timeUp),
      started_at: new Date(startedAt).toISOString(),
      submitted_at: new Date().toISOString()
    })
    .select('id, answers, correct_count, total_count, score_percent, total_seconds, time_up, submitted_at, created_at')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Bu test için zaten tamamlanmış bir denemeniz var.')
    throw new Error(`Sınav sonucu kaydedilemedi: ${error.message}`)
  }

  return mapAttempt(data, test, assignment.id, student.id)
}
