import { requireSupabase } from '../lib/supabase.js'
import { ensureCloudTest } from './tests.js'

const assignmentFields = 'id, teacher_id, class_id, test_id, starts_at, ends_at, max_attempts, published, created_at'

const toAssignment = (row, classesById, testsById) => {
  const test = testsById.get(row.test_id)
  return {
    id: row.id,
    teacherId: row.teacher_id,
    classId: row.class_id,
    className: classesById.get(row.class_id)?.name || 'Bilinmeyen sınıf',
    testId: row.test_id,
    testTitle: test?.title || 'Bilinmeyen test',
    test: test || null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    maxAttempts: Number(row.max_attempts || 1),
    published: Boolean(row.published),
    createdAt: row.created_at
  }
}

const readRows = async () => {
  const client = requireSupabase()
  const [assignmentResult, classResult, testResult] = await Promise.all([
    client.from('assignments').select(assignmentFields).order('created_at', { ascending: false }),
    client.from('classes').select('id, name, grade'),
    client.from('tests').select('id, title, grade, subject, duration_minutes, questions, created_at')
  ])

  if (assignmentResult.error) throw new Error(`Atamalar yüklenemedi: ${assignmentResult.error.message}`)
  if (classResult.error) throw new Error(`Atama sınıfları yüklenemedi: ${classResult.error.message}`)
  if (testResult.error) throw new Error(`Atama testleri yüklenemedi: ${testResult.error.message}`)

  const classesById = new Map((classResult.data || []).map((item) => [item.id, item]))
  const testsById = new Map(
    (testResult.data || []).map((item) => [
      item.id,
      {
        id: item.id,
        title: item.title,
        grade: Number(item.grade),
        subject: item.subject,
        durationMinutes: item.duration_minutes ?? null,
        questions: Array.isArray(item.questions) ? item.questions : [],
        createdAt: item.created_at
      }
    ])
  )

  return {
    assignments: (assignmentResult.data || []).map((row) => toAssignment(row, classesById, testsById)),
    classes: classResult.data || [],
    tests: [...testsById.values()]
  }
}

export const fetchTeacherAssignments = async () => readRows()

export const createAssignment = async ({ teacherId, classId, test, startsAt, endsAt, maxAttempts = 1, published = true }) => {
  if (!Array.isArray(test?.questions) || test.questions.length === 0) {
    throw new Error('Soru içermeyen testler öğrencilere atanamaz.')
  }
  const cloudTest = await ensureCloudTest({ teacherId, test })
  const { data, error } = await requireSupabase()
    .from('assignments')
    .insert({
      teacher_id: teacherId,
      class_id: classId,
      test_id: cloudTest.id,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      max_attempts: Number(maxAttempts),
      published: Boolean(published)
    })
    .select(assignmentFields)
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Bu test bu sınıfa zaten atanmış.')
    if (/Assignment test must contain at least one question/i.test(error.message || '')) {
      throw new Error('Soru içermeyen testler öğrencilere atanamaz.')
    }
    throw new Error(`Test atanamadı: ${error.message}`)
  }

  return { ...data, test: cloudTest }
}

export const updateAssignment = async ({ id, published, startsAt, endsAt, maxAttempts }) => {
  const { data, error } = await requireSupabase()
    .from('assignments')
    .update({
      published: Boolean(published),
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      max_attempts: Number(maxAttempts)
    })
    .eq('id', id)
    .select(assignmentFields)
    .single()

  if (error) throw new Error(`Atama güncellenemedi: ${error.message}`)
  return data
}

export const deleteAssignment = async (id) => {
  const { error } = await requireSupabase().from('assignments').delete().eq('id', id)
  if (error) throw new Error(`Atama silinemedi: ${error.message}`)
}

export const fetchStudentAssignments = async (studentId) => {
  if (!studentId) throw new Error('Öğrenci kimliği bulunamadı.')
  const client = requireSupabase()
  const { data: assignments, error: assignmentError } = await client
    .from('assignments')
    .select(assignmentFields)
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (assignmentError) throw new Error(`Atanan testler yüklenemedi: ${assignmentError.message}`)

  const testIds = [...new Set((assignments || []).map((item) => item.test_id))]
  const { data: tests, error: testError } = testIds.length
    ? await client.from('tests').select('id, title, grade, subject, duration_minutes, questions, created_at').in('id', testIds)
    : { data: [], error: null }
  if (testError) throw new Error(`Atanan test içerikleri yüklenemedi: ${testError.message}`)

  const { data: attempts, error: attemptError } = await client
    .from('attempts')
    .select('id, assignment_id, score_percent, correct_count, total_count, total_seconds, time_up, submitted_at, created_at')
    .eq('student_id', studentId)
  if (attemptError) throw new Error(`Öğrenci sonuçları yüklenemedi: ${attemptError.message}`)

  const testsById = new Map((tests || []).map((item) => [item.id, item]))
  const attemptsByAssignment = new Map((attempts || []).map((item) => [item.assignment_id, item]))
  const now = Date.now()

  return (assignments || []).map((row) => {
    const testRow = testsById.get(row.test_id)
    const startsAt = row.starts_at
    const endsAt = row.ends_at
    const isStarted = !startsAt || new Date(startsAt).getTime() <= now
    const isNotExpired = !endsAt || new Date(endsAt).getTime() >= now
    return {
      ...row,
      startsAt,
      endsAt,
      maxAttempts: Number(row.max_attempts || 1),
      test: testRow
        ? {
            id: testRow.id,
            title: testRow.title,
            grade: Number(testRow.grade),
            subject: testRow.subject,
            durationMinutes: testRow.duration_minutes ?? null,
            questions: Array.isArray(testRow.questions) ? testRow.questions : [],
            createdAt: testRow.created_at
          }
        : null,
      attempt: attemptsByAssignment.get(row.id) || null,
      available: Boolean(testRow && isStarted && isNotExpired)
    }
  }).filter((assignment) => assignment.test?.questions?.length > 0)
}

export const fetchCurrentStudent = async () => {
  const { data, error } = await requireSupabase()
    .from('students')
    .select('id, teacher_id, class_id, school_number, first_name, last_name, login_code, status')
    .maybeSingle()

  if (error) throw new Error(`Öğrenci profili yüklenemedi: ${error.message}`)
  if (!data) throw new Error('Bu Auth hesabına bağlı öğrenci kaydı bulunamadı.')
  return {
    id: data.id,
    teacherId: data.teacher_id,
    classId: data.class_id,
    schoolNumber: data.school_number,
    firstName: data.first_name,
    lastName: data.last_name,
    name: `${data.first_name} ${data.last_name}`.trim(),
    loginCode: data.login_code,
    status: data.status
  }
}
