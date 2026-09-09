import { useEffect, useMemo, useState } from 'react'
import { useStore, go } from '../../state/store.jsx'
import { GRADES, SUBJECTS, gradeLabel, subjectLabel, topicLabel, uid, topicsForSubject } from '../../domain/model.js'
import { GradeBadge, SubjectBadge } from '../components/Badges.jsx'
import QuestionForm from '../components/QuestionForm.jsx'
import QuestionImage from '../components/QuestionImage.jsx'
import Modal from '../components/Modal.jsx'

const fileToText = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('Dosya okunamadı'))
    r.readAsText(file)
  })

export default function BankScreen() {
  const { db, actions } = useStore()
  const initial = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const [grade, setGrade] = useState(Number(initial.get('grade')) || 0)
  const [subject, setSubject] = useState(initial.get('subject') || '')
  const [topic, setTopic] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState('')

  const scoped = (g, s) => g && s

  const list = useMemo(() => {
    return db.bank
      .filter((q) => (!grade || q.grade === grade) && (!subject || q.subject === subject) && (!topic || q.topic === topic))
      .sort((a, b) => {
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject)
        if (a.grade !== b.grade) return a.grade - b.grade
        return a.topic.localeCompare(b.topic, 'tr')
      })
  }, [db.bank, grade, subject, topic])

  const availableTopics = useMemo(
    () =>
      db.bank
        .filter((q) => (!grade || q.grade === grade) && (!subject || q.subject === subject))
        .map((q) => q.topic)
        .filter((v, i, arr) => arr.indexOf(v) === i),
    [db.bank, grade, subject]
  )

  // konu önerileri: seçili sınıf/ders için sabitler + bankada kullanılanlar
  const subjectTopics = useMemo(() => {
    const s = subject || (db.bank[0] && db.bank[0].subject) || 'matematik'
    return topicsForSubject(s, availableTopics)
  }, [subject, availableTopics, db.bank])

  const addQuestion = (q) => {
    actions.addBankQuestions([
      {
        id: uid('q'),
        grade: q.grade ?? grade,
        subject: q.subject ?? subject,
        topic: q.topic,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || '',
        image: q.image || ''
      }
    ])
    setAdding(false)
  }

  const saveEdit = (q) => {
    actions.updateBankQuestion(editingId, q)
    setEditingId(null)
  }

  const editingQuestion = db.bank.find((q) => q.id === editingId)

  const doBankImport = async (file) => {
    try {
      const text = await fileToText(file)
      const parsed = JSON.parse(text)
      // Kabul şemaları: (a) { kind:'questions', questions:[...] }  (b) { test:{...} }
      let arr = null
      let source = null
      if (Array.isArray(parsed?.questions)) {
        arr = parsed.questions
        source = 'Soru listesi'
      } else if (parsed?.kind === 'test' && Array.isArray(parsed?.test?.questions)) {
        arr = parsed.test.questions
        source = parsed.test.grade && parsed.test.subject ? `${parsed.test.grade}. sınıf ${subjectLabel(parsed.test.subject)}` : 'Test dosyası'
      }
      if (!arr) {
        setImportResult({ error: 'Dosyada soru listesi bulunamadı. { "questions": [...] } veya test JSON şeması kullanın.' })
        return
      }
      const fixedGrade = grade || (parsed?.test?.grade) || 1
      const fixedSubject = subject || (parsed?.test?.subject) || 'matematik'
      let ok = 0
      const questions = []
      arr.forEach((q, i) => {
        if (!q || !q.text || !Array.isArray(q.options) || q.options.length < 2) return
        const gi = [1, 2, 3, 4].includes(Number(q.grade)) ? Number(q.grade) : fixedGrade
        const si = ['matematik', 'geometri', 'turkce'].includes(q.subject) ? q.subject : fixedSubject
        questions.push({
          id: uid('q'),
          grade: gi,
          subject: si,
          topic: String(q.topic || 'genel').trim().toLowerCase(),
          text: String(q.text).trim(),
          options: q.options.map((o) => String(o).trim()),
          correctIndex: Number(q.correctIndex),
          explanation: q.explanation ? String(q.explanation).trim() : '',
          image: q.image ? String(q.image) : ''
        })
        ok++
      })
      if (!questions.length) {
        setImportResult({ error: 'Geçerli soru bulunamadı.' })
        return
      }
      actions.addBankQuestions(questions)
      setImportText('')
      setImportOpen(false)
      setImportResult({ ok: `${ok} soru "${source}" kaynağından bankaya eklendi.` })
    } catch (e) {
      setImportResult({ error: 'İçe aktarma hatası: ' + e.message })
    }
  }

  useEffect(() => {
    if (!importResult) return
    const t = setTimeout(() => setImportResult(''), 5000)
    return () => clearTimeout(t)
  }, [importResult])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Soru Bankası</h1>
          <div className="subtitle">
            Sınıf + ders + konu etiketli sorular. Testler bu bankadaki sorularla hızlıca oluşturulur.
          </div>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => setImportOpen(true)}>
            📥 Toplu Soru Yükle
          </button>
          <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
            + Yeni Soru
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`alert ${importResult.error ? 'alert-error' : 'alert-success'}`}>
          {importResult.error || importResult.ok}
        </div>
      )}

      <div className="filter-bar card" style={{ marginBottom: 18 }}>
        <div>
          <label>Sınıf</label>
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
          <label>Ders</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Tüm Dersler</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {subjectLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Konu</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Tüm Konular</option>
            {subjectTopics.map((t) => (
              <option key={t} value={t}>
                {topicLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="muted small" style={{ alignSelf: 'flex-end', paddingBottom: 6 }}>
          {list.length} soru
        </div>
      </div>

      {adding && (
        <QuestionForm
          subject={subject || 'matematik'}
          grade={grade || 1}
          onSave={addQuestion}
          onCancel={() => setAdding(false)}
        />
      )}

      {list.length === 0 ? (
        <div className="card empty">
          Filtrelerle eşleşen soru yok.
          {!scoped(grade, subject) && ' Önce sınıf ve ders seçerek yeni soru ekleyebilirsiniz.'}
        </div>
      ) : (
        list.map((q) => (
          <div key={q.id} className="question-block">
            {editingId === q.id && editingQuestion ? (
              <QuestionForm
                initial={editingQuestion}
                subject={q.subject}
                grade={q.grade}
                onSave={saveEdit}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <QuestionImage image={q.image} />
                <div className="q-head">
                  <strong>{q.text}</strong>
                  <span>
                    <GradeBadge grade={q.grade} /> <SubjectBadge subject={q.subject} />{' '}
                    <span className="badge badge-topic">{topicLabel(q.topic)}</span>
                  </span>
                </div>
                <div>
                  {q.options.map((o, i) => (
                    <div className="option-line" key={i}>
                      <span className="answer-letter">{String.fromCharCode(65 + i)}</span>
                      <span>{o}</span>
                      {i === q.correctIndex && <span className="badge badge-success">✓</span>}
                    </div>
                  ))}
                </div>
                {q.explanation && <div className="muted small mt-8">💡 {q.explanation}</div>}
                <div className="row-actions mt-8">
                  <button className="btn btn-sm" onClick={() => setEditingId(q.id)}>
                    ✎ Düzenle
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (confirm('Bu soru bankadan silinsin mi?')) actions.deleteBankQuestion(q.id)
                    }}
                  >
                    Sil
                  </button>
                </div>
              </>
            )}
          </div>
        ))
      )}

      {importOpen && (
        <Modal title="Toplu Soru Yükle (JSON)" onClose={() => setImportOpen(false)}>
          <p className="small muted">
            Şema: <code>{'{"questions": [{ "grade": 2, "subject": "matematik", "topic": "toplama", "text": "...", "options": ["..","..","..",".."], "correctIndex": 1 }]}'}</code>
            <br />
            Bir test JSON dosyası yükler de olur (testin soruları bankaya eklenir). Sınıf/ders filtreleri seçiliyse,
            soruda belirtilmeyen sınıf/ders onlardan alınır.
          </p>
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) {
                await doBankImport(f)
              }
              e.target.value = ''
            }}
          />
          <div className="row-actions mt-16" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setImportOpen(false)}>
              Kapat
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
