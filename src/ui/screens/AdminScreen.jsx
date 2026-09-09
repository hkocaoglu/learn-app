import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { fetchAdminData } from '../../cloud/adminData.js'
import { formatDate, gradeLabel, subjectLabel } from '../../domain/model.js'
import { go } from '../../state/store.jsx'

const sections = [
  { id: 'profiles', label: 'Öğretmenler' },
  { id: 'classes', label: 'Sınıflar' },
  { id: 'students', label: 'Öğrenciler' },
  { id: 'question_bank', label: 'Soru Bankası' },
  { id: 'tests', label: 'Testler' },
  { id: 'assignments', label: 'Atamalar' },
  { id: 'attempts', label: 'Sonuçlar' }
]

const safeText = (value) => String(value ?? '').trim()
const teacherName = (profilesById, id) => profilesById.get(id)?.full_name || 'Bilinmeyen öğretmen'
const className = (classesById, id) => classesById.get(id)?.name || 'Bilinmeyen sınıf'
const testTitle = (testsById, id) => testsById.get(id)?.title || 'Bilinmeyen test'
const studentName = (studentsById, id) => {
  const student = studentsById.get(id)
  return student ? `${student.first_name} ${student.last_name}`.trim() : 'Bilinmeyen öğrenci'
}

const displayRole = (role) => (role === 'admin' ? 'Admin' : 'Öğretmen')

const sectionRows = (section, data, indexes) => {
  const {
    profilesById,
    classesById,
    studentsById,
    testsById
  } = indexes

  switch (section) {
    case 'profiles':
      return data.profiles.map((item) => ({
        id: item.id,
        primary: item.full_name || 'İsimsiz hesap',
        secondary: item.email || 'E-posta yok',
        cells: [displayRole(item.role), item.school_name || '—', formatDate(item.created_at)],
        raw: item
      }))
    case 'classes':
      return data.classes.map((item) => ({
        id: item.id,
        primary: item.name,
        secondary: teacherName(profilesById, item.teacher_id),
        cells: [gradeLabel(item.grade), item.school_year || '—', formatDate(item.created_at)],
        raw: item
      }))
    case 'students':
      return data.students.map((item) => ({
        id: item.id,
        primary: `${item.first_name} ${item.last_name}`.trim(),
        secondary: teacherName(profilesById, item.teacher_id),
        cells: [
          className(classesById, item.class_id),
          item.school_number,
          item.login_code,
          item.status === 'active' ? 'Aktif' : 'Arşivlendi'
        ],
        raw: item
      }))
    case 'question_bank':
      return data.question_bank.map((item) => ({
        id: item.id,
        primary: item.text,
        secondary: teacherName(profilesById, item.teacher_id),
        cells: [
          gradeLabel(item.grade),
          subjectLabel(item.subject),
          item.topic,
          item.is_shared ? 'Paylaşılan' : 'Özel',
          formatDate(item.created_at)
        ],
        raw: item
      }))
    case 'tests':
      return data.tests.map((item) => ({
        id: item.id,
        primary: item.title,
        secondary: teacherName(profilesById, item.teacher_id),
        cells: [
          gradeLabel(item.grade),
          subjectLabel(item.subject),
          Array.isArray(item.questions) ? item.questions.length : 0,
          item.duration_minutes ? `${item.duration_minutes} dk` : 'Süresiz',
          formatDate(item.created_at)
        ],
        raw: item
      }))
    case 'assignments':
      return data.assignments.map((item) => ({
        id: item.id,
        primary: testTitle(testsById, item.test_id),
        secondary: teacherName(profilesById, item.teacher_id),
        cells: [
          className(classesById, item.class_id),
          item.published ? 'Yayınlandı' : 'Taslak',
          item.max_attempts,
          item.ends_at ? formatDate(item.ends_at) : 'Süresiz',
          formatDate(item.created_at)
        ],
        raw: item
      }))
    case 'attempts':
      return data.attempts.map((item) => {
        const assignment = data.assignments.find((candidate) => candidate.id === item.assignment_id)
        return {
          id: item.id,
          primary: studentName(studentsById, item.student_id),
          secondary: teacherName(profilesById, item.teacher_id),
          cells: [
            testTitle(testsById, assignment?.test_id),
            `${item.score_percent}% (${item.correct_count}/${item.total_count})`,
            item.time_up ? 'Süre doldu' : 'Tamamlandı',
            formatDate(item.submitted_at || item.created_at)
          ],
          raw: item
        }
      })
    default:
      return []
  }
}

const sectionHeaders = {
  profiles: ['Rol', 'Okul', 'Kayıt'],
  classes: ['Seviye', 'Eğitim yılı', 'Kayıt'],
  students: ['Sınıf', 'Okul no', 'Giriş kodu', 'Durum'],
  question_bank: ['Sınıf', 'Ders', 'Konu', 'Görünürlük', 'Kayıt'],
  tests: ['Sınıf', 'Ders', 'Soru', 'Süre', 'Kayıt'],
  assignments: ['Sınıf', 'Durum', 'Maks. deneme', 'Bitiş', 'Kayıt'],
  attempts: ['Test', 'Puan', 'Durum', 'Gönderim']
}

const overviewCards = (data) => [
  ['Öğretmen', data.profiles.filter((profile) => profile.role === 'teacher').length],
  ['Sınıf', data.classes.length],
  ['Öğrenci', data.students.length],
  ['Soru', data.question_bank.length],
  ['Test', data.tests.length],
  ['Sonuç', data.attempts.length]
]

export default function AdminScreen() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState(null)
  const [section, setSection] = useState('profiles')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(isAdmin)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      setData(await fetchAdminData())
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    load()
  }, [load])

  const indexes = useMemo(() => {
    if (!data) return null
    return {
      profilesById: new Map(data.profiles.map((item) => [item.id, item])),
      classesById: new Map(data.classes.map((item) => [item.id, item])),
      studentsById: new Map(data.students.map((item) => [item.id, item])),
      testsById: new Map(data.tests.map((item) => [item.id, item]))
    }
  }, [data])

  const rows = useMemo(() => {
    if (!data || !indexes) return []
    const query = safeText(search).toLocaleLowerCase('tr-TR')
    return sectionRows(section, data, indexes).filter((row) => {
      if (!query) return true
      return `${row.primary} ${row.secondary} ${row.cells.join(' ')} ${JSON.stringify(row.raw)}`
        .toLocaleLowerCase('tr-TR')
        .includes(query)
    })
  }, [data, indexes, search, section])

  if (!isAdmin) {
    return (
      <div className="card empty">
        <h2>Admin yetkisi gerekli</h2>
        <p>Bu menü yalnızca admin hesabına açıktır.</p>
        <button className="btn btn-primary" onClick={() => go('/')}>
          Ana sayfaya dön
        </button>
      </div>
    )
  }

  if (loading && !data) return <div className="card empty">Admin verileri yükleniyor…</div>

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Admin Paneli</h1>
          <div className="subtitle">Öğretmen, sınıf, öğrenci, içerik, atama ve sonuçların tamamına genel bakış.</div>
        </div>
        <div className="row-actions">
          <button className="btn" type="button" onClick={load} disabled={loading}>
            {loading ? 'Yükleniyor…' : '↻ Yenile'}
          </button>
          <button className="btn btn-primary" type="button" onClick={() => go('/ayarlar')}>
            ⚙ Admin Ayarları
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {data && (
        <>
          <div className="dashboard-kpis admin-kpis">
            {overviewCards(data).map(([label, value]) => (
              <div className="dashboard-kpi" key={label}>
                <span className="dashboard-kpi-value">{value}</span>
                <span className="dashboard-kpi-label">{label}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-heading">
              <div>
                <h2>Platform detayları</h2>
                <p className="small muted">Kayıtlar salt okunur olarak listelenir; öğretmen verileri birbirinden ayrıdır.</p>
              </div>
            </div>
            <div className="admin-tabs" role="tablist" aria-label="Admin veri bölümleri">
              {sections.map((item) => (
                <button
                  className={`btn btn-sm ${section === item.id ? 'btn-primary' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={section === item.id}
                  key={item.id}
                  onClick={() => {
                    setSection(item.id)
                    setSearch('')
                  }}
                >
                  {item.label} ({data[item.id].length})
                </button>
              ))}
            </div>
            <div className="admin-filter">
              <label htmlFor="admin-search">Ara</label>
              <input
                id="admin-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ad, e-posta, sınıf, test veya kayıt içinde ara"
              />
              <span className="small muted">{rows.length} kayıt gösteriliyor</span>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="card empty">Bu bölümde arama kriteriyle eşleşen kayıt yok.</div>
          ) : (
            <div className="card admin-table-card">
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Temel bilgi</th>
                      {sectionHeaders[section].map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                      <th>Detay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.primary}</strong>
                          <div className="small muted">{row.secondary}</div>
                        </td>
                        {row.cells.map((cell, index) => (
                          <td className="small" key={`${row.id}-${index}`}>
                            {cell}
                          </td>
                        ))}
                        <td>
                          <details>
                            <summary className="admin-detail-summary">JSON</summary>
                            <pre className="admin-json">{JSON.stringify(row.raw, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
