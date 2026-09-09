import { requireSupabase } from '../lib/supabase.js'
import { fetchClasses } from './classes.js'

const studentFields =
  'id, class_id, auth_user_id, school_number, first_name, last_name, login_code, status, created_at'

const normalizeStudent = (row, classesById) => {
  const classInfo = classesById.get(row.class_id)
  return {
    id: row.id,
    classId: row.class_id,
    className: classInfo?.name || '',
    grade: classInfo?.grade || null,
    authUserId: row.auth_user_id,
    schoolNumber: row.school_number,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    loginCode: row.login_code,
    status: row.status,
    createdAt: row.created_at
  }
}

export const fetchStudents = async () => {
  const [studentResult, classes] = await Promise.all([
    requireSupabase().from('students').select(studentFields).order('created_at', { ascending: false }),
    fetchClasses()
  ])

  if (studentResult.error) throw new Error(`Öğrenciler yüklenemedi: ${studentResult.error.message}`)
  const classesById = new Map(classes.map((item) => [item.id, item]))
  return (studentResult.data || []).map((row) => normalizeStudent(row, classesById))
}

const callProvisionEndpoint = async (session, payload) => {
  if (!session?.access_token) throw new Error('Öğretmen oturumu bulunamadı.')

  const response = await fetch('/api/students/provision', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('Öğrenci servisi geçerli bir JSON yanıtı döndürmedi.')
  }

  if (!response.ok) throw new Error(body?.error || `Öğrenci servisi hata döndürdü (${response.status}).`)
  return body
}

export const provisionStudent = (session, input) =>
  callProvisionEndpoint(session, {
    action: 'create',
    classId: input.classId,
    schoolNumber: input.schoolNumber,
    firstName: input.firstName,
    lastName: input.lastName
  })

export const resetStudentPin = (session, studentId) =>
  callProvisionEndpoint(session, {
    action: 'reset_pin',
    studentId
  })
