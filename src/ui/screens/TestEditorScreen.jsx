import { useEffect, useMemo, useState } from 'react'
import { useStore, go } from '../../state/store.jsx'
import { subjectLabel, gradeLabel, topicLabel, uid, validateTest, topicsForSubject } from '../../domain/model.js'
import QuestionForm from '../components/QuestionForm.jsx'
import Modal from '../components/Modal.jsx'
import QuestionImage from '../components/QuestionImage.jsx'
import { downloadJSON } from '../../db/storage.js'

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

export default function TestEditorScreen({ id }) {
  const { db, actions } = useStore()
  const test = db.tests.find((t) => t.id === id)
  const [draft, setDraft] = useState(null)
  const [editingIdx, setEditingIdx] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)
  const [bankFilter, setBankFilter] = useState('')
  const [bankSelected, setBankSelected] = useState({})
  const [errors, setErrors] = useState([])
  const [savedNotice, setSavedNotice] = useState(false)
  const [saving, setSaving] = useState(false)

  // Test (veya dışarıdan değişen id) değiştiğinde taslağı senkronize et
  useEffect(() => {
    if (test) {
      setDraft(JSON.parse(JSON.stringify(test)))
      setEditingIdx(null)
      setAddingNew(false)
      setErrors([])
    }
  }, [id, test])

  const active = draft || test

  const bankQuestions = useMemo(
    () => db.bank.filter((q) => q.grade === active?.grade && q.subject === active?.subject),
    [db.bank, active?.grade, active?.subject]
  )

  const topicsInBank = useMemo(
    () => topicsForSubject(active?.subject || 'matematik', bankQuestions.map((q) => q.topic)),
    [active?.subject, bankQuestions]
  )

  const filteredBank = bankQuestions.filter((q) => !bankFilter || q.topic === bankFilter)

  if (!test || !active) {
    return (
      <div className="card empty">
        Test bulunamadı. <a href="#/testler">Testlere dön</a>
      </div>
    )
  }

  const update = (patch) => setDraft({ ...active, ...patch })

  const persist = async () => {
    const errs = validateTest({ ...active })
    setErrors(errs)
    if (errs.length) return
    setSaving(true)
    try {
      await actions.updateTest(active.id, {
        title: active.title,
        durationMinutes: active.durationMinutes,
        questions: active.questions
      })
      setSavedNotice(true)
      setTimeout(() => setSavedNotice(false), 3500)
    } catch (caughtError) {
      setErrors([caughtError.message])
    } finally {
      setSaving(false)
    }
  }

  const saveQuestion = (q) => {
    if (editingIdx !== null) {
      const questions = [...active.questions]
      questions[editingIdx] = { ...questions[editingIdx], ...q }
      setDraft({ ...active, questions })
      setEditingIdx(null)
    } else {
      setDraft({ ...active, questions: [...active.questions, { ...q, id: uid('q') }] })
      setAddingNew(false)
    }
  }

  const removeQuestion = (idx) => {
    if (!confirm('Bu soruyu testten kaldırmak istiyor musunuz?')) return
    const questions = active.questions.filter((_, i) => i !== idx)
    setDraft({ ...active, questions })
  }

  const move = (idx, dir) => {
    const questions = [...active.questions]
    const j = idx + dir
    if (j < 0 || j >= questions.length) return
    ;[questions[idx], questions[j]] = [questions[j], questions[idx]]
    setDraft({ ...active, questions })
  }

  const duplicate = (idx) => {
    const questions = [...active.questions]
    const copy = { ...questions[idx], id: uid('q') }
    questions.splice(idx + 1, 0, copy)
    setDraft({ ...active, questions })
  }

  const addSelectedFromBank = () => {
    const chosen = filteredBank.filter((q) => bankSelected[q.id])
    if (!chosen.length) return
    const existingIds = new Set(active.questions.map((q) => q.id))
    const toAdd = chosen.filter((q) => !existingIds.has(q.id))
    const questions = [...active.questions, ...toAdd.map((q) => ({ ...q, id: uid('q') }))]
    setDraft({ ...active, questions })
    setBankSelected({})
    setBankOpen(false)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-sm mb-16" onClick={() => go('/testler')}>
            ← Testler
          </button>
          <h1>Test Editörü</h1>
          <div className="subtitle">
            {subjectLabel(active.subject)} • {gradeLabel(active.grade)} • {active.questions.length} soru — testteki
            sorular testin kopyasıdır; bankayı değiştirmek bu testi etkilemez.
          </div>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => downloadTestJson(active)}>
            ⬇ JSON İndir
          </button>
          {active.questions.length > 0 && (
            <button className="btn btn-primary" onClick={() => go(`/sinav/${active.id}`)}>
              ▶ Testi Uygula
            </button>
          )}
        </div>
      </div>

      {savedNotice && <div className="alert alert-success">Değişiklikler kaydedildi ✓</div>}
      {errors.length > 0 && (
        <div className="alert alert-error">
          <strong>Kaydedilemedi — düzeltilmesi gerekenler:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {errors.slice(0, 8).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="form-grid">
          <div className="form-row" style={{ gridColumn: 'span 2' }}>
            <label>Test Başlığı</label>
            <input type="text" value={active.title} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Süre Sınırı (dakika)</label>
            <input
              type="number"
              min={1}
              max={240}
              value={active.durationMinutes ?? ''}
              placeholder="Süresiz"
              onChange={(e) => update({ durationMinutes: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>&nbsp;</label>
            <div className="small muted" style={{ paddingTop: 8 }}>
              Boş bırakılırsa test süresizdir. Sınavda geri sayım gösterilir.
            </div>
          </div>
        </div>
        <div className="row-actions">
          <button className="btn btn-primary" onClick={persist} disabled={saving}>
            {saving ? 'Kaydediliyor…' : '💾 Kaydet'}
          </button>
          <button className="btn" onClick={() => setAddingNew((v) => !v)}>
            + Soru Ekle (Elle)
          </button>
          <button className="btn" onClick={() => setBankOpen(true)}>
            📚 Bankadan Soru Ekle ({bankQuestions.length} uygun)
          </button>
        </div>
      </div>

      {addingNew && (
        <QuestionForm
          subject={active.subject}
          grade={active.grade}
          onSave={saveQuestion}
          onCancel={() => setAddingNew(false)}
        />
      )}

      {active.questions.length === 0 ? (
        <div className="card empty">Bu testte henüz soru yok. Elle yazın veya bankadan ekleyin.</div>
      ) : (
        active.questions.map((q, idx) => (
          <div key={q.id || idx} className="question-block">
            {editingIdx === idx ? (
              <QuestionForm
                initial={q}
                subject={active.subject}
                grade={active.grade}
                onSave={saveQuestion}
                onCancel={() => setEditingIdx(null)}
              />
            ) : (
              <>
                <QuestionImage image={q.image} />
                <div className="q-head">
                  <strong>
                    {idx + 1}. {q.text}
                  </strong>
                  <span className="badge badge-topic">{topicLabel(q.topic)}</span>
                </div>
                <div>
                  {q.options.map((o, i) => (
                    <div className="option-line" key={i}>
                      <span className="answer-letter">{String.fromCharCode(65 + i)}</span>
                      <span>{o}</span>
                      {i === q.correctIndex && <span className="badge badge-success">✓ Doğru</span>}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <div className="muted small mt-8">💡 {q.explanation}</div>
                )}
                <div className="row-actions mt-8">
                  <button className="btn btn-sm" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    ↑
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => move(idx, 1)}
                    disabled={idx === active.questions.length - 1}
                  >
                    ↓
                  </button>
                  <button className="btn btn-sm" onClick={() => duplicate(idx)}>
                    ⧉ Kopyala
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditingIdx(idx)}>
                    ✎ Düzenle
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeQuestion(idx)}>
                    Sil
                  </button>
                </div>
              </>
            )}
          </div>
        ))
      )}

      {active.questions.length > 0 && (
        <div className="card" style={{ background: 'var(--gray-50)' }}>
          <div className="row-actions" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Değişiklikler &quot;Kaydet&quot; butonu ile kalıcı olur.</span>
            <button className="btn btn-primary" onClick={persist}>
              💾 Değişiklikleri Kaydet
            </button>
          </div>
        </div>
      )}

      {bankOpen && (
        <Modal title="Bankadan Soru Ekle" onClose={() => setBankOpen(false)} wide>
          <div className="inline-form mb-16">
            <div>
              <label>Konu Filtresi</label>
              <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
                <option value="">Tüm Konular</option>
                {topicsInBank.map((t) => (
                  <option key={t} value={t}>
                    {topicLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              disabled={!filteredBank.some((q) => bankSelected[q.id])}
              onClick={addSelectedFromBank}
            >
              Seçilenleri Ekle
            </button>
          </div>
          {filteredBank.length === 0 ? (
            <div className="empty">
              Bu sınıf/ders için bankada soru yok.{' '}
              <button className="btn btn-sm" onClick={() => go('/banka')}>
                Bankaya Git
              </button>
            </div>
          ) : (
            <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
              {filteredBank.map((q) => {
                const added = active.questions.some((x) => x.id === q.id)
                return (
                  <label
                    key={q.id}
                    className="question-block"
                    style={{ display: 'flex', gap: 10, cursor: 'pointer', marginBottom: 8 }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: 'auto', marginTop: 4 }}
                      checked={!!bankSelected[q.id]}
                      onChange={(e) => setBankSelected((s) => ({ ...s, [q.id]: e.target.checked }))}
                      disabled={added}
                    />
                    <div style={{ flex: 1 }}>
                      {q.image && <img src={q.image} alt="" style={{ maxWidth: 160, maxHeight: 90, borderRadius: 6, marginBottom: 6, objectFit: 'contain' }} />}
                      <div className="q-head">
                        <strong>{q.text}</strong>
                        <span className="badge badge-topic">{topicLabel(q.topic)}</span>
                      </div>
                      <div className="small muted">{q.options.join(' | ')}</div>
                      {added && <div className="small" style={{ color: 'var(--success)' }}>✓ Zaten testte</div>}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
