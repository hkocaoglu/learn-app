import { requireSupabase } from '../lib/supabase.js'

const classFields = 'id, name, grade, school_year, created_at'

const readError = (prefix, error) => {
  if (!error) return new Error(prefix)
  return new Error(`${prefix}: ${error.message}`)
}

const normalizeClass = (row) => ({
  id: row.id,
  name: String(row.name || '').trim(),
  grade: Number(row.grade),
  schoolYear: String(row.school_year || '').trim(),
  createdAt: row.created_at
})

export const fetchClasses = async () => {
  const { data, error } = await requireSupabase()
    .from('classes')
    .select(classFields)
    .order('grade', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw readError('Sınıflar yüklenemedi', error)
  return (data || []).map(normalizeClass)
}

export const createClass = async ({ teacherId, name, grade, schoolYear }) => {
  const normalizedName = String(name || '').trim()
  const normalizedGrade = Number(grade)
  const normalizedSchoolYear = String(schoolYear || '').trim()

  if (!teacherId) throw new Error('Öğretmen oturumu bulunamadı.')
  if (!normalizedName) throw new Error('Sınıf adı gereklidir.')
  if (![1, 2, 3, 4].includes(normalizedGrade)) throw new Error('Sınıf seviyesi 1-4 arasında olmalıdır.')

  const { data, error } = await requireSupabase()
    .from('classes')
    .insert({
      teacher_id: teacherId,
      name: normalizedName,
      grade: normalizedGrade,
      school_year: normalizedSchoolYear || null
    })
    .select(classFields)
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Bu isimde bir sınıf zaten mevcut.')
    throw readError('Sınıf oluşturulamadı', error)
  }
  return normalizeClass(data)
}

export const updateClass = async ({ id, name, grade, schoolYear }) => {
  const normalizedName = String(name || '').trim()
  const normalizedGrade = Number(grade)

  if (!id) throw new Error('Sınıf kimliği bulunamadı.')
  if (!normalizedName) throw new Error('Sınıf adı gereklidir.')
  if (![1, 2, 3, 4].includes(normalizedGrade)) throw new Error('Sınıf seviyesi 1-4 arasında olmalıdır.')

  const { data, error } = await requireSupabase()
    .from('classes')
    .update({
      name: normalizedName,
      grade: normalizedGrade,
      school_year: String(schoolYear || '').trim() || null
    })
    .eq('id', id)
    .select(classFields)
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Bu isimde bir sınıf zaten mevcut.')
    throw readError('Sınıf güncellenemedi', error)
  }
  return normalizeClass(data)
}

export const deleteClass = async (id) => {
  if (!id) throw new Error('Sınıf kimliği bulunamadı.')

  const { error } = await requireSupabase().from('classes').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') throw new Error('Öğrencisi olan sınıf silinemez.')
    throw readError('Sınıf silinemedi', error)
  }
}
