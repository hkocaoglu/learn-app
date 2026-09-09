import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { isSupabaseConfigured } from '../../lib/supabase.js'
import { createClass, deleteClass, fetchClasses, updateClass } from '../../cloud/classes.js'
import { GRADES, gradeLabel } from '../../domain/model.js'

const defaultSchoolYear = () => {
  const year = new Date().getFullYear()
  return `${year}-${year + 1}`
}

const initialForm = () => ({
  name: '',
  grade: 1,
  schoolYear: defaultSchoolYear()
})

export default function ClassesScreen() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      setClasses(await fetchClasses())
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setForm(initialForm())
    setEditing(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const saved = editing
        ? await updateClass({ id: editing.id, ...form })
        : await createClass({ teacherId: user.id, ...form })

      setClasses((current) =>
        editing ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]
      )
      setNotice(editing ? 'Sınıf güncellendi.' : 'Sınıf oluşturuldu.')
      resetForm()
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item) => {
    setEditing(item)
    setForm({ name: item.name, grade: item.grade, schoolYear: item.schoolYear })
    setError('')
    setNotice('')
  }

  const remove = async (item) => {
    if (!window.confirm(`"${item.name}" sınıfı silinsin mi?`)) return

    setError('')
    setNotice('')
    try {
      await deleteClass(item.id)
      setClasses((current) => current.filter((candidate) => candidate.id !== item.id))
      setNotice('Sınıf silindi.')
      if (editing?.id === item.id) resetForm()
    } catch (caughtError) {
      setError(caughtError.message)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Sınıflar</h1>
            <div className="subtitle">Sınıf yönetimi için Supabase bağlantısı gereklidir.</div>
          </div>
        </div>
        <div className="alert alert-warning">
          `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` tanımlanmadan cloud sınıf yönetimi kullanılamaz.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sınıflar</h1>
          <div className="subtitle">Sınıflarınızı oluşturun; sonraki adımda öğrencileri bu sınıflara atayın.</div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="card">
        <div className="section-heading">
          <div>
            <h2>{editing ? 'Sınıfı düzenle' : 'Yeni sınıf oluştur'}</h2>
            <p className="small muted">Sınıf adı aynı öğretmen hesabında yalnızca bir kez kullanılabilir.</p>
          </div>
        </div>
        <form className="inline-form" onSubmit={submit}>
          <div>
            <label htmlFor="class-name">Sınıf adı</label>
            <input
              id="class-name"
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Örn. 2-A"
              maxLength={120}
              required
            />
          </div>
          <div>
            <label htmlFor="class-grade">Seviye</label>
            <select
              id="class-grade"
              value={form.grade}
              onChange={(event) => setForm((current) => ({ ...current, grade: Number(event.target.value) }))}
            >
              {GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {gradeLabel(grade)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="class-school-year">Eğitim öğretim yılı</label>
            <input
              id="class-school-year"
              type="text"
              value={form.schoolYear}
              onChange={(event) => setForm((current) => ({ ...current, schoolYear: event.target.value }))}
              placeholder="2026-2027"
              maxLength={30}
            />
          </div>
          <div className="row-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || !form.name.trim()}>
              {saving ? 'Kaydediliyor…' : editing ? 'Değişiklikleri kaydet' : 'Sınıf oluştur'}
            </button>
            {editing && (
              <button className="btn" type="button" onClick={resetForm} disabled={saving}>
                Vazgeç
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="section-heading">
        <div>
          <h2>Sınıf listesi</h2>
          <p className="small muted">{classes.length} sınıf</p>
        </div>
        <button className="btn btn-sm" type="button" onClick={load} disabled={loading}>
          {loading ? 'Yükleniyor…' : '↻ Yenile'}
        </button>
      </div>

      {loading ? (
        <div className="card empty">Sınıflar yükleniyor…</div>
      ) : classes.length === 0 ? (
        <div className="card empty">Henüz sınıf yok. İlk sınıfınızı yukarıdaki formdan oluşturun.</div>
      ) : (
        <div className="class-grid">
          {classes.map((item) => (
            <article className="class-card" key={item.id}>
              <div className="class-card-heading">
                <div>
                  <h3>{item.name}</h3>
                  <span className="badge badge-grade">{gradeLabel(item.grade)}</span>
                </div>
                <span className="class-card-icon" aria-hidden="true">
                  🏫
                </span>
              </div>
              <div className="class-card-meta">
                {item.schoolYear ? `Eğitim öğretim yılı: ${item.schoolYear}` : 'Eğitim öğretim yılı belirtilmedi'}
              </div>
              <div className="row-actions">
                <button className="btn btn-sm" type="button" onClick={() => startEdit(item)}>
                  Düzenle
                </button>
                <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(item)}>
                  Sil
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
