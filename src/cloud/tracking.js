// Sınıf bazlı takip verisi: öğrenciler + okuma/test atamaları + denemeler.
// RLS öğretmenin kendi sınıf/öğrencileriyle sınırlar.
import { requireSupabase } from '../lib/supabase.js'

const readingFields = 'id, title, subject, grade, points, quiz_threshold, published, starts_at, ends_at, created_at'
const assignmentFields = 'id, test_id, published, starts_at, ends_at, created_at'

export const fetchClassTracking = async (classId) => {
  if (!classId) throw new Error('Sınıf seçilmedi.')
  const client = requireSupabase()

  const [studentResult, readingResult, assignmentResult] = await Promise.all([
    client
      .from('students')
      .select('id, first_name, last_name, school_number, class_id, status')
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('school_number'),
    client.from('reading_assignments').select(readingFields).eq('class_id', classId).order('created_at', { ascending: true }),
    client.from('assignments').select(assignmentFields).eq('class_id', classId).order('created_at', { ascending: true })
  ])

  if (studentResult.error) throw new Error(`Öğrenciler yüklenemedi: ${studentResult.error.message}`)
  if (readingResult.error) throw new Error(`Okumalar yüklenemedi: ${readingResult.error.message}`)
  if (assignmentResult.error) throw new Error(`Test atamaları yüklenemedi: ${assignmentResult.error.message}`)

  const students = (studentResult.data || []).map((row) => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    schoolNumber: row.school_number
  }))

  const readings = (readingResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject,
    grade: Number(row.grade),
    points: Number(row.points ?? 10),
    passThreshold: Number(row.quiz_threshold ?? 60),
    published: Boolean(row.published),
    startsAt: row.starts_at,
    endsAt: row.ends_at
  }))

  const readingIds = readings.map((item) => item.id)
  const assignmentIds = (assignmentResult.data || []).map((row) => row.id)
  const testIds = [...new Set((assignmentResult.data || []).map((row) => row.test_id))]

  const [readingAttemptResult, attemptResult, testResult] = await Promise.all([
    readingIds.length
      ? client
          .from('reading_attempts')
          .select('id, reading_assignment_id, student_id, read, score_percent, dwell_seconds, submitted_at')
          .in('reading_assignment_id', readingIds)
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? client
          .from('attempts')
          .select('id, assignment_id, student_id, score_percent, correct_count, total_count, submitted_at')
          .in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [], error: null }),
    testIds.length
      ? client.from('tests').select('id, title, subject, grade').in('id', testIds)
      : Promise.resolve({ data: [], error: null })
  ])

  if (readingAttemptResult.error) throw new Error(`Okuma sonuçları yüklenemedi: ${readingAttemptResult.error.message}`)
  if (attemptResult.error) throw new Error(`Test sonuçları yüklenemedi: ${attemptResult.error.message}`)
  if (testResult.error) throw new Error(`Test başlıkları yüklenemedi: ${testResult.error.message}`)

  const testsById = new Map((testResult.data || []).map((row) => [row.id, row]))

  const exams = (assignmentResult.data || []).map((row) => {
    const test = testsById.get(row.test_id)
    return {
      id: row.id,
      testId: row.test_id,
      title: test?.title || 'Test',
      subject: test?.subject || null,
      grade: test?.grade ? Number(test.grade) : null,
      published: Boolean(row.published),
      startsAt: row.starts_at,
      endsAt: row.ends_at
    }
  })

  return {
    students,
    readings,
    exams,
    readingAttempts: (readingAttemptResult.data || []).map((row) => ({
      id: row.id,
      itemId: row.reading_assignment_id,
      studentId: row.student_id,
      read: Boolean(row.read),
      scorePercent: Number(row.score_percent ?? 0),
      date: row.submitted_at
    })),
    examAttempts: (attemptResult.data || []).map((row) => ({
      id: row.id,
      itemId: row.assignment_id,
      studentId: row.student_id,
      scorePercent: Number(row.score_percent ?? 0),
      date: row.submitted_at
    }))
  }
}
