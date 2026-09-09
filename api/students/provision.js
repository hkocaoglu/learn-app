import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { studentAuthEmail, studentCodeBase } from '../../src/domain/studentAuth.js'

const sendJson = (res, status, body) => {
  res.status(status).json(body)
}

const readBody = (body) => {
  if (!body) return null
  if (typeof body === 'object') return body
  if (typeof body !== 'string') return null

  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

const getBearerToken = (req) => {
  const header = String(req.headers?.authorization || '')
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

const newPin = () => String(randomInt(1000, 10000))

const serializeStudent = (student) => ({
  id: student.id,
  classId: student.class_id,
  authUserId: student.auth_user_id,
  schoolNumber: student.school_number,
  firstName: student.first_name,
  lastName: student.last_name,
  name: `${student.first_name} ${student.last_name}`.trim(),
  loginCode: student.login_code,
  status: student.status,
  createdAt: student.created_at
})

const createStudent = async (admin, teacher, body) => {
  const classId = String(body.classId || '').trim()
  const schoolNumber = String(body.schoolNumber || '').trim()
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()

  if (!classId || !schoolNumber || !firstName || !lastName) {
    return { status: 400, body: { error: 'classId, schoolNumber, firstName ve lastName zorunludur.' } }
  }

  const { data: classRow, error: classError } = await admin
    .from('classes')
    .select('id, grade, teacher_id')
    .eq('id', classId)
    .eq('teacher_id', teacher.id)
    .maybeSingle()

  if (classError) return { status: 500, body: { error: `Sınıf doğrulanamadı: ${classError.message}` } }
  if (!classRow) return { status: 404, body: { error: 'Sınıf bulunamadı veya bu sınıfa erişim yok.' } }

  const { data: existingStudent, error: existingError } = await admin
    .from('students')
    .select('id')
    .eq('teacher_id', teacher.id)
    .eq('school_number', schoolNumber)
    .maybeSingle()

  if (existingError) return { status: 500, body: { error: `Öğrenci kontrol edilemedi: ${existingError.message}` } }
  if (existingStudent) return { status: 409, body: { error: 'Bu okul numarasıyla kayıtlı bir öğrenci zaten var.' } }

  const baseCode = studentCodeBase(schoolNumber, firstName, lastName)
  if (baseCode.length < 3) {
    return {
      status: 400,
      body: { error: 'Öğrenci kodu oluşturulamadı. Okul numarası ve ad-soyad baş harfleri en az üç karakter üretmelidir.' }
    }
  }

  const { data: matchingCodes, error: codeError } = await admin
    .from('students')
    .select('login_code')
    .ilike('login_code', `${baseCode}%`)

  if (codeError) return { status: 500, body: { error: `Öğrenci kodu kontrol edilemedi: ${codeError.message}` } }

  const takenCodes = new Set((matchingCodes || []).map((row) => String(row.login_code).toLowerCase()))
  let loginCode = baseCode
  let suffix = 2
  while (takenCodes.has(loginCode.toLowerCase())) {
    loginCode = `${baseCode}${suffix}`
    suffix += 1
  }

  const pin = newPin()
  const authResult = await admin.auth.admin.createUser({
    email: studentAuthEmail(loginCode),
    password: pin,
    email_confirm: true,
    user_metadata: {
      role: 'student',
      login_code: loginCode
    }
  })

  if (authResult.error || !authResult.data?.user) {
    return {
      status: 502,
      body: { error: `Öğrenci hesabı oluşturulamadı: ${authResult.error?.message || 'Auth kullanıcı yanıtı eksik.'}` }
    }
  }

  const { data: student, error: studentError } = await admin
    .from('students')
    .insert({
      teacher_id: teacher.id,
      class_id: classId,
      auth_user_id: authResult.data.user.id,
      school_number: schoolNumber,
      first_name: firstName,
      last_name: lastName,
      login_code: loginCode
    })
    .select('id, class_id, auth_user_id, school_number, first_name, last_name, login_code, status, created_at')
    .single()

  if (studentError || !student) {
    const cleanup = await admin.auth.admin.deleteUser(authResult.data.user.id)
    const cleanupDetail = cleanup.error ? ` Auth temizliği de başarısız: ${cleanup.error.message}` : ''
    return {
      status: 500,
      body: { error: `Öğrenci kaydı oluşturulamadı: ${studentError?.message || 'Kayıt yanıtı eksik.'}${cleanupDetail}` }
    }
  }

  return {
    status: 201,
    body: {
      ok: true,
      student: serializeStudent(student),
      credentials: { loginCode, pin }
    }
  }
}

const resetStudentPin = async (admin, teacher, body) => {
  const studentId = String(body.studentId || '').trim()
  if (!studentId) return { status: 400, body: { error: 'studentId zorunludur.' } }

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id, class_id, auth_user_id, school_number, first_name, last_name, login_code, status, created_at')
    .eq('id', studentId)
    .eq('teacher_id', teacher.id)
    .maybeSingle()

  if (studentError) return { status: 500, body: { error: `Öğrenci yüklenemedi: ${studentError.message}` } }
  if (!student) return { status: 404, body: { error: 'Öğrenci bulunamadı.' } }
  if (!student.auth_user_id) return { status: 409, body: { error: 'Öğrencinin Auth hesabı bulunamadı.' } }

  const pin = newPin()
  const { error: authError } = await admin.auth.admin.updateUserById(student.auth_user_id, { password: pin })
  if (authError) return { status: 502, body: { error: `PIN yenilenemedi: ${authError.message}` } }

  return {
    status: 200,
    body: {
      ok: true,
      student: serializeStudent(student),
      credentials: { loginCode: student.login_code, pin }
    }
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return sendJson(res, 204, {})
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return sendJson(res, 405, { error: 'Yalnızca POST istekleri desteklenir.' })
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || '').trim()
  if (!supabaseUrl || !secretKey) {
    return sendJson(res, 503, { error: 'SUPABASE_URL ve SUPABASE_SECRET_KEY ortam değişkenleri tanımlanmalıdır.' })
  }

  const token = getBearerToken(req)
  if (!token) return sendJson(res, 401, { error: 'Öğretmen oturumu gerekli.' })

  const body = readBody(req.body)
  if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'Geçerli bir JSON gövdesi gönderin.' })

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData?.user) return sendJson(res, 401, { error: 'Öğretmen oturumu geçersiz veya süresi dolmuş.' })

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError) return sendJson(res, 500, { error: `Öğretmen profili doğrulanamadı: ${profileError.message}` })
  if (!profile || profile.role !== 'teacher') return sendJson(res, 403, { error: 'Bu işlem yalnızca öğretmen hesapları içindir.' })

  const result = body.action === 'reset_pin'
    ? await resetStudentPin(admin, authData.user, body)
    : await createStudent(admin, authData.user, body)

  return sendJson(res, result.status, result.body)
}
