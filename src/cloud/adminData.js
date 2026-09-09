import { requireSupabase } from '../lib/supabase.js'

const PAGE_SIZE = 1000

const tableFields = {
  profiles: 'id, role, email, full_name, school_name, created_at, updated_at',
  classes: 'id, teacher_id, name, grade, school_year, created_at',
  students: 'id, teacher_id, class_id, auth_user_id, school_number, first_name, last_name, login_code, status, created_at, updated_at',
  question_bank:
    'id, teacher_id, grade, subject, topic, text, options, correct_index, explanation, image, is_shared, created_at, updated_at',
  tests: 'id, teacher_id, title, grade, subject, duration_minutes, questions, created_at, updated_at',
  assignments:
    'id, teacher_id, class_id, test_id, starts_at, ends_at, max_attempts, published, created_at',
  attempts:
    'id, teacher_id, assignment_id, student_id, answers, correct_count, total_count, score_percent, total_seconds, time_up, started_at, submitted_at, created_at'
}

const readAll = async (table) => {
  const client = requireSupabase()
  const rows = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(tableFields[table])
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error(`${table} verileri yüklenemedi: ${error.message}`)

    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

export const fetchAdminData = async () => {
  const tables = Object.keys(tableFields)
  const values = await Promise.all(tables.map((table) => readAll(table)))
  return Object.fromEntries(tables.map((table, index) => [table, values[index]]))
}
