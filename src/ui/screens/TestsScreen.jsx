import { useEffect, useMemo, useState } from 'react'
import { useStore, go } from '../../state/store.jsx'
import { GRADES, SUBJECTS, gradeLabel, subjectLabel, uid, nowIso, formatMinutesShort } from '../../domain/model.js'
import { downloadJSON } from '../../db/storage.js'
import JsonImportDialog from '../components/JsonImportDialog.jsx'

const downloadTestJson = (test) => {
  const payload = {
    version: 1,
    kind: 'test',
    test: {
      title: test.title,
      grade: test.grade,
      subject: test.subject,
      durationMinutes: test.durationMinutes ?? null,
      questions: test.questions.map((q) => ({
        topic: q.topic,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        image: q.image || ''
      }))
    }
  }
  const safe = test.title.replace(/[^\w\u00c0-\u024f]+/g, '_')
  downloadJSON(`test_${test.grade}.sinif_${test.subject}_${safe}.json`, JSON.stringify(payload, null, 2))
}

export default function TestsScreen() {
  const { db, actions } = useStore()
  const initial = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const [grade, setGrade] = useState(Number(initial.get('grade')) || 0)
  const [subject, setSubject] = useState(initial.get('subject') || '')
  const [importOpen, setImportOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const filtered = useMemo(
    () =>
      db.tests
        .filter((t) => (!grade || t.grade === grade) && (!subject || t.subject === subject))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [db.tests, grade, subject]
  )

  const createNewTest = async () => {
    const g = grade || 1
    const s = subject || 'matematik'
    const test = {
      id: uid('t'),
      title: newTitle.trim() || `${gradeLabel(g)} ${subjectLabel(s)} — Yeni Test`,
      grade: g,
      subject: s,
      createdAt: nowIso(),
      questions: []
    }
    setSaving(true)
    setActionError('')
    try {
      const savedId = await actions.addTest(test)
      go(`/test/${savedId}`)
    } catch (caughtError) {
      setActionError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const generateReadyTest = async () => {
    setActionError('')
    const g = grade || 1
    const s = subject || 'matematik'
    const pool = db.bank.filter((q) => q.grade === g && q.subject === s)
    if (!pool.length) {
      setNotice('Bu sınıf/ders için bankada soru yok.')
      return
    }
    // konuları dengeli dağıt: her konudan en az 1, toplam 8 soru
    const byTopic = {}
    pool.forEach((q) => {
      ;(byTopic[q.topic] = byTopic[q.topic] || []).push(q)
    })
    const picked = []
    const topics = Object.keys(byTopic)
    let i = 0
    while (picked.length < 8 && topics.length) {
      const t = topics[i % topics.length]
      if (byTopic[t].length) picked.push(byTopic[t].shift())
      else topics.splice(i % topics.length, 1)
      i++
    }
    const test = {
      id: uid('t'),
      title: `${gradeLabel(g)} ${subjectLabel(s)} — Otomatik Test (${picked.length} soru)`,
      grade: g,
      subject: s,
      createdAt: nowIso(),
      questions: picked.map((q) => ({ ...q }))
    }
    setSaving(true)
    try {
      await actions.addTest(test)
      setNotice(`"${test.title}" oluşturuldu.`)
    } catch (caughtError) {
      setActionError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  const removeTest = async (test) => {
    if (!confirm(`"${test.title}" testi ve sonuçları silinsin mi?`)) return
    setActionError('')
    setSaving(true)
    try {
      await actions.deleteTest(test.id)
      setNotice(`"${test.title}" silindi.`)
    } catch (caughtError) {
      setActionError(caughtError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Testler</h1>
          <div className="subtitle">
            Elle oluşturun, soru bankasından derleyin veya JSON dosyasından yükleyin. Her test farklı sayıda soru
            içerebilir.
          </div>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => go('/banka')}>
            Soru Bankası
          </button>
          <button className="btn" onClick={() => setImportOpen(true)}>
            📥 JSON İçe Aktar
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew((v) => !v)}>
            + Yeni Test
          </button>
        </div>
      </div>

      {notice && <div className="alert alert-info">{notice}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="filter-bar card" style={{ marginBottom: 18 }}>
        <div>
          <label>Sınıf Filtresi</label>
          <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            <option value={0}>Tüm Sınıflar</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Ders Filtresi</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Tüm Dersler</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {subjectLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-success" onClick={generateReadyTest} disabled={saving}>
          ⚡ Hazır Test Üret (Bankadan)
        </button>
      </div>

      {showNew && (
        <div className="card mb-16">
          <h2>Yeni Test Oluştur</h2>
          <div className="inline-form">
            <div>
              <label>Sınıf</label>
              <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Ders</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {subjectLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Başlık (opsiyonel)</label>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Otomatik başlık kullanılır" />
            </div>
            <button className="btn btn-primary" onClick={createNewTest} style={{ marginBottom: 2 }} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Oluştur ve Düzenle'}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card empty">
          <p>Bu filtrelerle eşleşen test yok.</p>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            + İlk Testi Oluştur
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Sınıf</th>
                <th>Ders</th>
                <th>Soru</th>
                <th>Süre</th>
                <th style={{ textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="student-name-link" onClick={() => go(`/test/${t.id}`)}>
                      {t.title}
                    </span>
                  </td>
                  <td>{gradeLabel(t.grade)}</td>
                  <td>{subjectLabel(t.subject)}</td>
                  <td>{t.questions.length}</td>
                  <td>
                    {t.durationMinutes ? (
                      <span className="badge badge-grade">{formatMinutesShort(t.durationMinutes)}</span>
                    ) : (
                      <span className="muted small">Süresiz</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => go(`/sinav/${t.id}`)}>
                        ▶ Uygula
                      </button>
                      <button className="btn btn-sm" onClick={() => go(`/test/${t.id}`)}>
                        ✎ Düzenle
                      </button>
                      <button className="btn btn-sm" onClick={() => downloadTestJson(t)}>
                        ⬇ JSON
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeTest(t)}
                        disabled={saving}
                      >
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

      {importOpen && (
        <JsonImportDialog
          onClose={(ok, testId) => {
            setImportOpen(false)
            if (ok && testId) go(`/test/${testId}`)
          }}
        />
      )}
    </div>
  )
}
