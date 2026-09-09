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

const previewResponseText = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > 240 ? `${text.slice(0, 240)}…` : text
}

const getResponseContentType = (response) => response.headers.get('content-type') || 'yok'

const readProvisionResponse = async (response) => {
  const contentType = getResponseContentType(response)
  const rawText = await response.text()
  const trimmed = rawText.trim()

  if (!trimmed) {
    return { contentType, rawText, body: null, isJson: false }
  }

  try {
    return { contentType, rawText, body: JSON.parse(rawText), isJson: true }
  } catch {
    return { contentType, rawText, body: null, isJson: false }
  }
}

const buildProvisionError = (response, contentType, rawText, body) => {
  const status = response.status
  const contentTypeLabel = contentType || 'yok'
  const preview = previewResponseText(rawText)

  if (body && typeof body === 'object') {
    const detail =
      typeof body.error === 'string' && body.error.trim()
        ? body.error.trim()
        : typeof body.message === 'string' && body.message.trim()
          ? body.message.trim()
          : ''

    if (detail) {
      return `Öğrenci servisi hata döndürdü (HTTP ${status}, content-type: ${contentTypeLabel}): ${detail}`
    }

    return `Öğrenci servisi beklenmedik bir JSON yanıtı döndürdü (HTTP ${status}, content-type: ${contentTypeLabel}).`
  }

  return `Öğrenci servisi geçerli bir JSON yanıtı döndürmedi (HTTP ${status}, content-type: ${contentTypeLabel}).${preview ? ` Yanıtın ilk kısmı: ${preview}` : ''}`
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

  const { contentType, rawText, body, isJson } = await readProvisionResponse(response)
  if (!isJson && !body) {
    throw new Error(buildProvisionError(response, contentType, rawText, null))
  }

  if (!response.ok) {
    throw new Error(buildProvisionError(response, contentType, rawText, body))
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(buildProvisionError(response, contentType, rawText, body))
  }

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
