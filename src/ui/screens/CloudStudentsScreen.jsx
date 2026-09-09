import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { fetchClasses } from '../../cloud/classes.js'
import { fetchStudents, provisionStudent, resetStudentPin } from '../../cloud/students.js'

const initialForm = { classId: '', schoolNumber: '', firstName: '', lastName: '' }

export default function CloudStudentsScreen() {
  const { session } = useAuth()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState(initialForm)
  const [credentials, setCredentials] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextStudents, nextClasses] = await Promise.all([fetchStudents(), fetchClasses()])
      setStudents(nextStudents)
      setClasses(nextClasses)
      setForm((current) => ({
        ...current,
        classId: current.classId || nextClasses[0]?.id || ''
      }))
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setCredentials(null)
    try {
      const result = await provisionStudent(session, form)
      const classInfo = classes.find((item) => item.id === form.classId)
      setStudents((current) => [
        {
          ...result.student,
          className: classInfo?.name || '',
          grade: classInfo?.grade || null
        },
        ...current
      ])
      setCredentials(result.credentials)
      setForm((current) => ({ ...initialForm, classId: current.classId }))
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const regeneratePin = async (student) => {
    if (!window.confirm(`${student.name} için yeni bir PIN oluşturulsun mu?`)) return

    setError('')
    setCredentials(null)
    try {
      const result = await resetStudentPin(session, student.id)
      setCredentials(result.credentials)
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Öğrenciler</h1>
          <div className="subtitle">Öğrencileri sınıflara ekleyin ve güvenli giriş kodu/PIN bilgilerini yönetin.</div>
        </div>
        <button className="btn btn-sm" type="button" onClick={load} disabled={loading}>
          {loading ? 'Yükleniyor…' : '↻ Yenile'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {classes.length === 0 && !loading ? (
        <div className="card empty">
          <p>Öğrenci eklemek için önce en az bir sınıf oluşturun.</p>
          <a className="btn btn-primary" href="#/siniflar">
            Sınıf oluştur
          </a>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="section-heading">
              <div>
                <h2>Yeni öğrenci</h2>
                <p className="small muted">PIN yalnızca oluşturma veya yenileme sonrasında gösterilir.</p>
              </div>
            </div>
            <form className="form-grid" onSubmit={submit}>
              <div className="form-row">
                <label htmlFor="student-class">Sınıf</label>
                <select
                  id="student-class"
                  value={form.classId}
                  onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}
                  required
                >
                  <option value="">Sınıf seçin</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.grade}. sınıf
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="student-school-number">Okul numarası</label>
                <input
                  id="student-school-number"
                  type="text"
                  value={form.schoolNumber}
                  onChange={(event) => setForm((current) => ({ ...current, schoolNumber: event.target.value }))}
                  maxLength={40}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="student-first-name">Ad</label>
                <input
                  id="student-first-name"
                  type="text"
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  maxLength={80}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="student-last-name">Soyad</label>
                <input
                  id="student-last-name"
                  type="text"
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  maxLength={80}
                  required
                />
              </div>
              <div className="row-actions" style={{ gridColumn: '1 / -1' }}>
                <button className="btn btn-primary" type="submit" disabled={saving || !form.classId}>
                  {saving ? 'Oluşturuluyor…' : 'Öğrenciyi oluştur'}
                </button>
              </div>
            </form>
          </div>

          {credentials && (
            <div className="card credential-card">
              <h2>Öğrenci giriş bilgileri</h2>
              <p className="small muted">Bu bilgileri öğrenciye güvenli bir kanaldan iletin.</p>
              <div className="credential-grid">
                <div>
                  <span className="credential-label">Giriş kodu</span>
                  <strong>{credentials.loginCode}</strong>
                </div>
                <div>
                  <span className="credential-label">PIN</span>
                  <strong>{credentials.pin}</strong>
                </div>
              </div>
              <div className="alert alert-warning small">PIN tekrar görüntülenemez; unutulursa yeni PIN oluşturmanız gerekir.</div>
            </div>
          )}

          {loading ? (
            <div className="card empty">Öğrenciler yükleniyor…</div>
          ) : students.length === 0 ? (
            <div className="card empty">Henüz öğrenci yok.</div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Öğrenci</th>
                    <th>Okul no</th>
                    <th>Sınıf</th>
                    <th>Giriş kodu</th>
                    <th style={{ textAlign: 'right' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.name}</strong>
                        <div className="small muted">{student.status === 'active' ? 'Aktif' : 'Arşivlendi'}</div>
                      </td>
                      <td>{student.schoolNumber}</td>
                      <td>{student.className || '—'}</td>
                      <td>
                        <code>{student.loginCode}</code>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm" type="button" onClick={() => regeneratePin(student)}>
                            PIN yenile
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
