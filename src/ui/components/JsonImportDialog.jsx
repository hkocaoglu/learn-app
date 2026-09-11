import { useRef, useState } from 'react'
import { useStore } from '../../state/store.jsx'
import Modal from './Modal.jsx'
import { validateQuestion, normalizeQuestion, uid, isValidGrade } from '../../domain/model.js'
import { gradeLabel, subjectLabel } from '../../domain/model.js'

// JSON test içe aktarma penceresi.
// Şema: { version: 1, kind: 'test', test: { title, grade, subject, questions: [...] } }
export default function JsonImportDialog({ onClose }) {
  const { db, actions } = useStore()
  const fileRef = useRef(null)
  const [text, setText] = useState('')
  const [errors, setErrors] = useState([])
  const [preview, setPreview] = useState(null)
  const [addToBank, setAddToBank] = useState(true)
  const [dragOver, setDragOver] = useState(false)

  const parseAndValidate = (jsonText) => {
    setErrors([])
    setPreview(null)
    try {
      const parsed = JSON.parse(jsonText)
      if (!parsed || parsed.kind !== 'test' || !parsed.test)
        return setErrors(['Geçersiz format: kind "test" ve test nesnesi bulunmalı.'])
      const t = parsed.test
      const errs = []
      if (!t.title || !String(t.title).trim()) errs.push('Test başlığı eksik.')
      if (!isValidGrade(t.grade)) errs.push('Geçersiz sınıf (1-6 olmalı).')
      if (!['matematik', 'geometri', 'turkce'].includes(t.subject)) errs.push('Geçersiz ders.')
      if (!Array.isArray(t.questions)) errs.push('Soru listesi eksik.')
      else {
        const qs = []
        t.questions.forEach((q, i) => {
          const vq = { ...q, grade: t.grade, subject: t.subject }
          const e = validateQuestion(vq)
          if (e.length) {
            errs.push(`Soru ${i + 1}: ${e.join('; ')}`)
          } else {
            qs.push(normalizeQuestion(vq, t.grade, t.subject))
          }
        })
        setPreview({
          title: String(t.title).trim(),
          grade: Number(t.grade),
          subject: t.subject,
          durationMinutes:
            t.durationMinutes === undefined || t.durationMinutes === null || t.durationMinutes === ''
              ? null
              : Number(t.durationMinutes),
          validCount: qs.length,
          totalCount: t.questions.length,
          questions: qs
        })
      }
      if (errs.length) setErrors(errs)
      else setErrors([])
    } catch (e) {
      setErrors(['JSON ayrıştırılamadı: ' + e.message])
    }
  }

  const handleFile = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      setText(String(reader.result || ''))
      parseAndValidate(String(reader.result || ''))
    }
    reader.readAsText(file)
  }

  const doImport = async () => {
    if (!preview || preview.validCount === 0) return
    const test = {
      id: uid('t'),
      title: preview.title,
      grade: preview.grade,
      subject: preview.subject,
      durationMinutes: preview.durationMinutes,
      createdAt: new Date().toISOString(),
      questions: preview.questions
    }
    try {
      const savedId = await actions.addTest(test)
      if (addToBank) {
        await actions.addBankQuestions(preview.questions.map((q) => ({ ...q, id: uid('q') })))
      }
      onClose(true, savedId)
    } catch (error) {
      setErrors([error.message])
    }
  }

  return (
    <Modal title="JSON ile Test İçe Aktar" onClose={() => onClose(false)} wide>
      <div
        className="card"
        style={{
          border: dragOver ? '2px dashed var(--primary)' : '2px dashed var(--gray-300)',
          textAlign: 'center',
          background: dragOver ? 'var(--primary-light)' : '#fff',
          cursor: 'pointer'
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        onClick={() => fileRef.current?.click()}
      >
        <div style={{ fontSize: '1.6rem' }}>📄</div>
        <p style={{ margin: '6px 0' }}>
          Test JSON dosyasını sürükleyip bırakın veya <strong>dosya seçin</strong>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          className="btn btn-sm"
          onClick={(e) => {
            e.stopPropagation()
            fileRef.current?.click()
          }}
        >
          Dosya Seç
        </button>
      </div>

      <div className="form-row mt-8">
        <label>Ya da JSON metnini buraya yapıştırın</label>
        <textarea
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (e.target.value.trim()) parseAndValidate(e.target.value)
          }}
          placeholder={'{\n  "version": 1,\n  "kind": "test",\n  "test": { ... }\n}'}
        />
      </div>

      {errors.length > 0 && (
        <div className="alert alert-error">
          <strong>Doğrulama hataları:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && preview.validCount === 0 && !errors.length && (
        <div className="alert alert-warning">Hiçbir geçerli soru bulunamadı.</div>
      )}

      {preview && preview.validCount > 0 && (
        <div className="alert alert-success">
          <strong>Önizleme:</strong> {preview.title} • {gradeLabel(preview.grade)} • {subjectLabel(preview.subject)} •{' '}
          {preview.validCount}/{preview.totalCount} soru geçerli
          {preview.durationMinutes ? ` • süre ${preview.durationMinutes} dk` : ''}
          {preview.validCount < preview.totalCount && ' (hatalı olanlar atlanır)'}.
        </div>
      )}

      <label className="mt-8" style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
        <input
          type="checkbox"
          checked={addToBank}
          onChange={(e) => setAddToBank(e.target.checked)}
          style={{ width: 'auto' }}
        />
        İçe aktarılan soruları soru bankasına da ekle
      </label>

      <div className="row-actions mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => onClose(false)}>
          Vazgeç
        </button>
        <button className="btn btn-primary" disabled={!preview || preview.validCount === 0} onClick={doImport}>
          Testi İçe Aktar
        </button>
      </div>
    </Modal>
  )
}
