import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore } from '../../state/store.jsx'
import { createAssignment, deleteAssignment, fetchTeacherAssignments, updateAssignment } from '../../cloud/assignments.js'
import { GRADES, gradeLabel, formatDate, formatMinutesShort } from '../../domain/model.js'

const initialForm = { classId: '', testId: '', startsAt: '', endsAt: '' }

const localDateToIso = (value) => (value ? new Date(value).toISOString() : null)
const isoToLocalDate = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '')

export default function AssignmentsScreen() {
  const { user } = useAuth()
  const { db } = useStore()
  const [classes, setClasses] = useState([])
  const [tests, setTests] = useState([])
  const [assignments, setAssignments] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchTeacherAssignments()
      setClasses(result.classes)
      const localTests = db.tests || []
      const localTitles = new Set(localTests.map((test) => test.title))
      setTests([...localTests, ...result.tests.filter((test) => !localTitles.has(test.title))])
      setAssignments(result.assignments)
      setForm((current) => ({
        ...current,
        classId: current.classId || result.classes[0]?.id || '',
        testId: current.testId || result.tests[0]?.id || ''
      }))
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setLoading(false)
    }
  }, [db.tests])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (event) => {
    event.preventDefault()
    const test = tests.find((item) => item.id === form.testId)
    if (!test || !form.classId) {
      setError('Sınıf ve test seçimi gereklidir.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await createAssignment({
        teacherId: user.id,
        classId: form.classId,
        test,
        startsAt: localDateToIso(form.startsAt),
        endsAt: localDateToIso(form.endsAt),
        maxAttempts: 1
      })
      setNotice('Test sınıfa atandı.')
      setForm((current) => ({ ...initialForm, classId: current.classId, testId: current.testId }))
      await load()
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (assignment) => {
    setError('')
    try {
      await updateAssignment({
        id: assignment.id,
        published: !assignment.published,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        maxAttempts: 1
      })
      setAssignments((current) =>
        current.map((item) => (item.id === assignment.id ? { ...item, published: !item.published } : item))
      )
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  const remove = async (assignment) => {
    if (!window.confirm(`"${assignment.testTitle}" ataması silinsin mi?`)) return
    setError('')
    try {
      await deleteAssignment(assignment.id)
      setAssignments((current) => current.filter((item) => item.id !== assignment.id))
      setNotice('Atama silindi.')
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Test Atama</h1>
          <div className="subtitle">Bir testi sınıfa yayınlayın; öğrenciler yalnızca yayınlanmış ve zamanı uygun testleri görür.</div>
        </div>
        <button className="btn btn-sm" type="button" onClick={load} disabled={loading}>
          {loading ? 'Yükleniyor…' : '↻ Yenile'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {classes.length === 0 || tests.length === 0 ? (
        <div className="card empty">
          {classes.length === 0 ? (
            <>
              <p>Atama yapmak için önce sınıf oluşturun.</p>
              <a className="btn btn-primary" href="#/siniflar">
                Sınıflara git
              </a>
            </>
          ) : (
            <>
              <p>Atama yapmak için önce en az bir test oluşturun.</p>
              <a className="btn btn-primary" href="#/testler">
                Testlere git
              </a>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <h2>Yeni atama</h2>
          <form className="form-grid mt-16" onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="assignment-class">Sınıf</label>
              <select
                id="assignment-class"
                value={form.classId}
                onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}
                required
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {gradeLabel(item.grade)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="assignment-test">Test</label>
              <select
                id="assignment-test"
                value={form.testId}
                onChange={(event) => setForm((current) => ({ ...current, testId: event.target.value }))}
                required
              >
                {tests.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.title} — {gradeLabel(test.grade)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="assignment-start">Başlangıç (isteğe bağlı)</label>
              <input
                id="assignment-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="assignment-end">Bitiş (isteğe bağlı)</label>
              <input
                id="assignment-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              />
            </div>
            <div className="row-actions" style={{ gridColumn: '1 / -1' }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Atanıyor…' : 'Testi sınıfa ata'}
              </button>
            </div>
          </form>
          <p className="small muted mt-8">İlk sürümde her öğrenci bir atama için yalnızca bir deneme yapabilir.</p>
        </div>
      )}

      <div className="section-heading">
        <div>
          <h2>Mevcut atamalar</h2>
          <p className="small muted">{assignments.length} atama</p>
        </div>
      </div>

      {loading ? (
        <div className="card empty">Atamalar yükleniyor…</div>
      ) : assignments.length === 0 ? (
        <div className="card empty">Henüz test ataması yok.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Sınıf</th>
                <th>Zaman</th>
                <th>Durum</th>
                <th style={{ textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <strong>{assignment.testTitle}</strong>
                    {assignment.test?.durationMinutes && (
                      <div className="small muted">{formatMinutesShort(assignment.test.durationMinutes)}</div>
                    )}
                  </td>
                  <td>{assignment.className}</td>
                  <td className="small">
                    {assignment.startsAt ? formatDate(assignment.startsAt) : 'Hemen'}
                    {' – '}
                    {assignment.endsAt ? formatDate(assignment.endsAt) : 'Süresiz'}
                  </td>
                  <td>
                    <span className={`badge ${assignment.published ? 'badge-success' : 'badge-warning'}`}>
                      {assignment.published ? 'Yayında' : 'Taslak'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" type="button" onClick={() => togglePublished(assignment)}>
                        {assignment.published ? 'Geri çek' : 'Yayınla'}
                      </button>
                      <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(assignment)}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
