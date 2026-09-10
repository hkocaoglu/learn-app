import { Fragment, useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import {
  createReading,
  deleteReading,
  fetchReadingAttempts,
  fetchTeacherReadings,
  updateReading
} from '../../cloud/readings.js'
import { GRADES, SUBJECTS, gradeLabel, subjectLabel, formatDate, formatSeconds, validateReading } from '../../domain/model.js'
import QuestionForm from '../components/QuestionForm.jsx'

const initialForm = {
  classId: '',
  title: '',
  sourceLabel: '',
  body: '',
  grade: 2,
  subject: 'turkce',
  minDwellSeconds: '',
  quizThreshold: 60,
  startsAt: '',
  endsAt: ''
}

const localDateToIso = (value) => (value ? new Date(value).toISOString() : null)
const isoToLocalDate = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '')

export default function ReadingsScreen() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [readings, setReadings] = useState([])
  const [form, setForm] = useState(initialForm)
  const [questions, setQuestions] = useState([])
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formErrors, setFormErrors] = useState([])
  const [attemptsById, setAttemptsById] = useState({})
  const [openDetailId, setOpenDetailId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchTeacherReadings()
      setClasses(result.classes)
      setReadings(result.readings)
      setForm((current) => ({
        ...current,
        classId: current.classId || result.classes[0]?.id || '',
        grade: current.grade || result.classes[0]?.grade || 2
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
    if (!form.classId || !form.title.trim() || form.body.trim().length < 50) {
      setError('Sınıf, başlık ve en az 50 karakterlik metin gereklidir.')
      return
    }
    const candidate = {
      title: form.title.trim(),
      sourceLabel: form.sourceLabel.trim(),
      body: form.body,
      grade: Number(form.grade),
      subject: form.subject,
      minDwellSeconds: form.minDwellSeconds === '' ? null : Number(form.minDwellSeconds),
      quizThreshold: Number(form.quizThreshold),
      questions
    }
    const errors = validateReading(candidate)
    setFormErrors(errors)
    if (errors.length > 0) {
      setError(errors[0])
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await createReading({
        teacherId: user.id,
        classId: form.classId,
        reading: candidate,
        startsAt: localDateToIso(form.startsAt),
        endsAt: localDateToIso(form.endsAt)
      })
      setNotice(questions.length === 0 ? 'Okuma atandı. Soru eklenmediği için kanıt daha zayıf olacak.' : 'Okuma sınıfa atandı.')
      setForm((current) => ({ ...initialForm, classId: current.classId, grade: current.grade, subject: current.subject }))
      setQuestions([])
      setFormErrors([])
      await load()
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (reading) => {
    setError('')
    try {
      await updateReading({
        id: reading.id,
        published: !reading.published,
        startsAt: reading.startsAt,
        endsAt: reading.endsAt
      })
      setReadings((current) =>
        current.map((item) => (item.id === reading.id ? { ...item, published: !item.published } : item))
      )
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  const remove = async (reading) => {
    if (!window.confirm(`"${reading.title}" okuması silinsin mi?`)) return
    setError('')
    try {
      await deleteReading(reading.id)
      setReadings((current) => current.filter((item) => item.id !== reading.id))
      setNotice('Okuma silindi.')
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  const toggleDetail = async (reading) => {
    if (openDetailId === reading.id) {
      setOpenDetailId('')
      return
    }
    setOpenDetailId(reading.id)
    if (!attemptsById[reading.id]) {
      try {
        const rows = await fetchReadingAttempts(reading.id)
        setAttemptsById((current) => ({ ...current, [reading.id]: rows }))
      } catch (caughtError) {
        setError(caughtError.message)
      }
    }
  }

  const saveQuestion = (q) => {
    setQuestions((current) => [...current, { ...q, grade: Number(form.grade), subject: form.subject }])
    setAddingQuestion(false)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Okuma Ata</h1>
          <div className="subtitle">Bir metni sınıfa yayınlayın; öğrenciler dwell + scroll + quiz ile okuduğunu kanıtlar.</div>
        </div>
        <button className="btn btn-sm" type="button" onClick={load} disabled={loading}>
          {loading ? 'Yükleniyor…' : '↻ Yenile'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {classes.length === 0 ? (
        <div className="card empty">
          <p>Okuma atamak için önce sınıf oluşturun.</p>
          <a className="btn btn-primary" href="#/siniflar">
            Sınıflara git
          </a>
        </div>
      ) : (
        <div className="card">
          <h2>Yeni okuma</h2>
          <form className="form-grid mt-16" onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="reading-class">Sınıf</label>
              <select
                id="reading-class"
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
              <label htmlFor="reading-title">Başlık</label>
              <input
                id="reading-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                maxLength={200}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="reading-source">Kaynak (kitap/yazar, isteğe bağlı)</label>
              <input
                id="reading-source"
                value={form.sourceLabel}
                onChange={(event) => setForm((current) => ({ ...current, sourceLabel: event.target.value }))}
                maxLength={200}
              />
            </div>
            <div className="form-row">
              <label htmlFor="reading-grade">Sınıf düzeyi</label>
              <select
                id="reading-grade"
                value={form.grade}
                onChange={(event) => setForm((current) => ({ ...current, grade: Number(event.target.value) }))}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="reading-subject">Ders</label>
              <select
                id="reading-subject"
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {subjectLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="reading-dwell">En az okuma süresi sn (boş = kelime sayısından)</label>
              <input
                id="reading-dwell"
                type="number"
                min={15}
                max={1800}
                value={form.minDwellSeconds}
                onChange={(event) => setForm((current) => ({ ...current, minDwellSeconds: event.target.value }))}
                placeholder="örn. 120"
              />
            </div>
            <div className="form-row">
              <label htmlFor="reading-threshold">Quiz geçme eşiği %</label>
              <input
                id="reading-threshold"
                type="number"
                min={0}
                max={100}
                value={form.quizThreshold}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quizThreshold: Number(event.target.value) }))
                }
              />
            </div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="reading-body">Metin (en az 50 karakter)</label>
              <textarea
                id="reading-body"
                rows={8}
                value={form.body}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="reading-start">Başlangıç (isteğe bağlı)</label>
              <input
                id="reading-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="reading-end">Bitiş (isteğe bağlı)</label>
              <input
                id="reading-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              />
            </div>
            <div className="row-actions" style={{ gridColumn: '1 / -1' }}>
              <button className="btn btn-primary" type="submit" disabled={saving || classes.length === 0}>
                {saving ? 'Atanıyor…' : 'Okumayı sınıfa ata'}
              </button>
            </div>
          </form>
          {formErrors.length > 0 && (
            <ul className="small mt-8" style={{ color: 'var(--danger)' }}>
              {formErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <div className="section-heading mt-16">
            <h3>Anlama soruları ({questions.length}/6)</h3>
            {!addingQuestion && questions.length < 6 && (
              <button className="btn btn-sm" type="button" onClick={() => setAddingQuestion(true)}>
                + Soru ekle
              </button>
            )}
          </div>
          {questions.length === 0 && !addingQuestion && (
            <p className="small muted">Soru yok — okuma yine dwell+scroll gerektirir ama kanıt daha zayıf olur.</p>
          )}
          {questions.map((q, i) => (
            <div key={q.text + i} className="question-block">
              <strong>
                Soru {i + 1}:
              </strong>{' '}
              {q.text}
              <div className="row-actions mt-8">
                <button
                  className="btn btn-sm btn-danger"
                  type="button"
                  onClick={() => setQuestions((current) => current.filter((_, j) => j !== i))}
                >
                  Kaldır
                </button>
              </div>
            </div>
          ))}
          {addingQuestion && (
            <QuestionForm
              subject={form.subject}
              grade={Number(form.grade)}
              onSave={saveQuestion}
              onCancel={() => setAddingQuestion(false)}
            />
          )}
        </div>
      )}

      <div className="section-heading">
        <div>
          <h2>Mevcut okumalar</h2>
          <p className="small muted">{readings.length} okuma</p>
        </div>
      </div>

      {loading ? (
        <div className="card empty">Okumalar yükleniyor…</div>
      ) : readings.length === 0 ? (
        <div className="card empty">Henüz okuma ataması yok.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Okuma</th>
                <th>Sınıf</th>
                <th>Zaman</th>
                <th>Durum</th>
                <th style={{ textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <Fragment key={reading.id}>
                  <tr>
                    <td>
                      <strong>{reading.title}</strong>
                      <div className="small muted">
                        {gradeLabel(reading.grade)} • {subjectLabel(reading.subject)} •{' '}
                        {reading.questions.length} soru
                      </div>
                    </td>
                    <td>{reading.className}</td>
                    <td className="small">
                      {reading.startsAt ? formatDate(reading.startsAt) : 'Hemen'}
                      {' – '}
                      {reading.endsAt ? formatDate(reading.endsAt) : 'Süresiz'}
                    </td>
                    <td>
                      <span className={`badge ${reading.published ? 'badge-success' : 'badge-warning'}`}>
                        {reading.published ? 'Yayında' : 'Taslak'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm" type="button" onClick={() => toggleDetail(reading)}>
                          {openDetailId === reading.id ? 'Gizle' : 'Kim okudu'}
                        </button>
                        <button className="btn btn-sm" type="button" onClick={() => togglePublished(reading)}>
                          {reading.published ? 'Geri çek' : 'Yayınla'}
                        </button>
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(reading)}>
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                  {openDetailId === reading.id && (
                    <tr>
                      <td colSpan={5}>
                        <ReadingAttemptTable rows={attemptsById[reading.id] || []} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ReadingAttemptTable({ rows }) {
  if (rows.length === 0) return <p className="small muted">Henüz sonuç yok veya yükleniyor…</p>
  return (
    <table>
      <thead>
        <tr>
          <th>Öğrenci</th>
          <th>Okundu?</th>
          <th>Quiz %</th>
          <th>Süre</th>
          <th>Scroll</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="small">{row.student_id.slice(0, 8)}…</td>
            <td>
              {row.read ? <span className="badge badge-success">✓ Okundu</span> : <span>—</span>}
            </td>
            <td>%{row.score_percent}</td>
            <td>{formatSeconds(row.total_seconds)}</td>
            <td>{row.scrolled_bottom ? '✓' : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
