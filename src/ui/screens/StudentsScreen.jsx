import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore, go } from '../../state/store.jsx'
import { GRADES, gradeLabel } from '../../domain/model.js'
import { aggregateStudentAll } from '../../domain/scoring.js'
import { ScoreBar } from '../components/ScoreBar.jsx'
import Modal from '../components/Modal.jsx'
import CloudStudentsScreen from './CloudStudentsScreen.jsx'

export default function StudentsScreen() {
  const { isCloudMode } = useAuth()
  if (isCloudMode) return <CloudStudentsScreen />
  return <LocalStudentsScreen />
}

function LocalStudentsScreen() {
  const { db, actions } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(1)
  const [editing, setEditing] = useState(null) // { id, name, grade }
  const [confirmDelete, setConfirmDelete] = useState(null)

  const rows = useMemo(() => {
    return db.students
      .map((s) => {
        const attempts = db.attempts.filter((a) => a.studentId === s.id)
        const agg = aggregateStudentAll(attempts)
        return { ...s, attempts: attempts.length, agg }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [db])

  const submitAdd = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    actions.addStudent(name, grade)
    setName('')
    setShowAdd(false)
  }

  const submitEdit = (e) => {
    e.preventDefault()
    if (!editing || !editing.name.trim()) return
    actions.updateStudent(editing.id, { name: editing.name, grade: Number(editing.grade) })
    setEditing(null)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Öğrenciler</h1>
          <div className="subtitle">Öğrenci ekleyin; her test çözümü bu öğrenciye kaydedilir.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Yeni Öğrenci
        </button>
      </div>

      {db.students.length === 0 ? (
        <div className="card empty">
          Henüz öğrenci yok. &quot;+ Yeni Öğrenci&quot; ile kayıt oluşturun.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th>Sınıf</th>
                <th>Çözülen Test</th>
                <th>Genel Başarı</th>
                <th style={{ textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="student-name-link" onClick={() => go(`/ogrenci/${s.id}`)}>
                      {s.name}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-grade">{gradeLabel(s.grade)}</span>
                  </td>
                  <td>{s.attempts}</td>
                  <td>
                    {s.attempts > 0 ? (
                      <ScoreBar correct={s.agg.totalCorrect} total={s.agg.totalQuestions} width={110} />
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" onClick={() => go(`/ogrenci/${s.id}`)}>
                        Detay
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => setEditing({ id: s.id, name: s.name, grade: s.grade })}
                      >
                        Düzenle
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(s)}>
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

      {showAdd && (
        <Modal title="Yeni Öğrenci" onClose={() => setShowAdd(false)}>
          <form onSubmit={submitAdd}>
            <div className="form-row">
              <label>Ad Soyad</label>
              <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Ayşe Yılmaz" />
            </div>
            <div className="form-row">
              <label>Sınıf</label>
              <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>
            <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowAdd(false)}>
                Vazgeç
              </button>
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                Kaydet
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="Öğrenciyi Düzenle" onClose={() => setEditing(null)}>
          <form onSubmit={submitEdit}>
            <div className="form-row">
              <label>Ad Soyad</label>
              <input autoFocus type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Sınıf</label>
              <select value={editing.grade} onChange={(e) => setEditing({ ...editing, grade: Number(e.target.value) })}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>
            <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn btn-primary">
                Kaydet
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Öğrenciyi Sil" onClose={() => setConfirmDelete(null)}>
          <p>
            <strong>{confirmDelete.name}</strong> silinecek. Bu öğrencinin tüm test sonuçları da silinir. Emin misiniz?
          </p>
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirmDelete(null)}>
              Vazgeç
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                actions.deleteStudent(confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              Evet, Sil
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
