import { requireSupabase } from '../lib/supabase.js'

const TEST_ID_MAP_KEY = 'learn_app_cloud_test_ids_v1'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const newUuid = () => {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  throw new Error('Tarayıcı UUID üretimini desteklemiyor.')
}

const readIdMap = () => {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(TEST_ID_MAP_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    console.error('Cloud test kimlik eşlemesi okunamadı:', error)
    return {}
  }
}

const writeIdMap = (map) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(TEST_ID_MAP_KEY, JSON.stringify(map))
  } catch (error) {
    console.error('Cloud test kimlik eşlemesi kaydedilemedi:', error)
  }
}

const mapTest = (row) => ({
  id: row.id,
  title: row.title,
  grade: Number(row.grade),
  subject: row.subject,
  durationMinutes: row.duration_minutes ?? null,
  questions: Array.isArray(row.questions) ? row.questions : [],
  createdAt: row.created_at
})

export const ensureCloudTest = async ({ teacherId, test }) => {
  if (!teacherId) throw new Error('Öğretmen oturumu bulunamadı.')
  if (!test?.title || !Array.isArray(test.questions)) throw new Error('Test verisi geçersiz.')
  if (test.questions.length === 0) throw new Error('Soru içermeyen testler öğrencilere atanamaz.')

  const idMap = readIdMap()
  const teacherMap = idMap[teacherId] || {}
  const cloudId = teacherMap[test.id] || (uuidPattern.test(test.id) ? test.id : newUuid())

  const { data, error } = await requireSupabase()
    .from('tests')
    .upsert(
      {
        id: cloudId,
        teacher_id: teacherId,
        title: String(test.title).trim(),
        grade: Number(test.grade),
        subject: test.subject,
        duration_minutes: test.durationMinutes ?? null,
        questions: test.questions
      },
      { onConflict: 'id' }
    )
    .select('id, title, grade, subject, duration_minutes, questions, created_at')
    .single()

  if (error) throw new Error(`Test cloud'a aktarılamadı: ${error.message}`)

  idMap[teacherId] = { ...teacherMap, [test.id]: data.id }
  writeIdMap(idMap)
  return mapTest(data)
}

export const fetchCloudTests = async () => {
  const { data, error } = await requireSupabase()
    .from('tests')
    .select('id, title, grade, subject, duration_minutes, questions, created_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Cloud testleri yüklenemedi: ${error.message}`)
  return (data || []).map(mapTest)
}
