import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluateReadingGates, submitReadingAttempt } from '../../cloud/readings.js'
import { formatSeconds, gradeLabel, requiredDwellSeconds, subjectLabel, topicLabel } from '../../domain/model.js'
import Modal from '../components/Modal.jsx'
import QuestionImage from '../components/QuestionImage.jsx'

const DRAFT_VERSION = 1
const draftKey = (studentId, assignmentId) => `learn_app_student_reading_v1_${studentId}_${assignmentId}`

const readDraft = (studentId, assignmentId) => {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(draftKey(studentId, assignmentId))
    if (!raw) return null
    const draft = JSON.parse(raw)
    return draft?.version === DRAFT_VERSION ? draft : null
  } catch (error) {
    console.error('Öğrenci okuma taslağı yüklenemedi:', error)
    return null
  }
}

const saveDraft = (studentId, assignmentId, draft) => {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(draftKey(studentId, assignmentId), JSON.stringify(draft))
  } catch (error) {
    console.error('Öğrenci okuma taslağı kaydedilemedi:', error)
  }
}

const clearDraft = (studentId, assignmentId) => {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(draftKey(studentId, assignmentId))
  } catch (error) {
    console.error('Öğrenci okuma taslağı temizlenemedi:', error)
  }
}

export default function StudentReadingScreen({ student, readingAssignment, onBack }) {
  const reading = readingAssignment.reading
  const draft = useMemo(() => readDraft(student.id, readingAssignment.id), [student.id, readingAssignment.id])
  const questions = reading?.questions || []
  const total = questions.length
  const required = requiredDwellSeconds(reading)

  const [step, setStep] = useState(() => Math.min(Math.max(Number(draft?.step) || 0, 0), Math.max(0, total - 1)))
  const [answers, setAnswers] = useState(() => draft?.answers || {})
  const [dwellSeconds, setDwellSeconds] = useState(() => Number(draft?.dwellSeconds) || 0)
  const [scrolledBottom, setScrolledBottom] = useState(() => draft?.scrolledBottom === true)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const startedAtRef = useRef(draft?.startedAt || Date.now())
  const accumulatedRef = useRef(Number(draft?.dwellSeconds) || 0)
  const lastTickRef = useRef(Date.now())
  const scrolledRef = useRef(draft?.scrolledBottom === true)
  const finishedRef = useRef(false)
  const submitRef = useRef(null)

  const answeredCount = Object.values(answers).filter((value) => Number.isInteger(value) && value >= 0).length
  const unansweredCount = Math.max(0, total - answeredCount)
  const gates = evaluateReadingGates({ reading, answers, dwellSeconds, scrolledBottom })
  const canFinish = gates.dwellOk && gates.scrollOk

  useEffect(() => {
    lastTickRef.current = Date.now()
    const onVisibility = () => {
      lastTickRef.current = Date.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const interval = setInterval(() => {
      if (finishedRef.current) return
      const now = Date.now()
      if (!document.hidden) {
        accumulatedRef.current += (now - lastTickRef.current) / 1000
        const next = Math.floor(accumulatedRef.current)
        setDwellSeconds(next)
      }
      lastTickRef.current = now
    }, 1000)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (finishedRef.current || !reading) return
    saveDraft(student.id, readingAssignment.id, {
      version: DRAFT_VERSION,
      step,
      answers,
      dwellSeconds: accumulatedRef.current,
      scrolledBottom: scrolledRef.current,
      startedAt: startedAtRef.current
    })
  }, [answers, dwellSeconds, reading, readingAssignment.id, scrolledBottom, step, student.id])

  useEffect(() => {
    if (finishedRef.current || !reading) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [reading])

  if (!reading) {
    return (
      <div className="card empty">
        Bu okuma ataması bulunamadı.
        <div className="mt-8">
          <button className="btn btn-primary" type="button" onClick={onBack}>
            Okumalara dön
          </button>
        </div>
      </div>
    )
  }

  const handleScroll = (event) => {
    const el = event.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
      scrolledRef.current = true
      setScrolledBottom(true)
    }
  }

  const submit = async (confirmed = false) => {
    if (finishedRef.current || submitting) return
    if (!confirmed && unansweredCount > 0 && total > 0) {
      setShowSubmitConfirm(true)
      return
    }

    finishedRef.current = true
    setShowSubmitConfirm(false)
    setSubmitting(true)
    setError('')

    const totalSeconds = Math.round((Date.now() - startedAtRef.current) / 1000)

    try {
      const saved = await submitReadingAttempt({
        student,
        readingAssignment,
        reading,
        answers,
        dwellSeconds: Math.floor(accumulatedRef.current),
        scrolledBottom: scrolledRef.current,
        totalSeconds,
        startedAt: startedAtRef.current
      })
      clearDraft(student.id, readingAssignment.id)
      setResult(saved)
      setFinished(true)
    } catch (caughtError) {
      finishedRef.current = false
      setError(caughtError.message)
    } finally {
      setSubmitting(false)
    }
  }

  submitRef.current = submit

  if (finished && result) {
    return (
      <div>
        <div className="card student-result-card">
          <h1>{result.read ? '📖 Okundu ✓' : '📖 Tamamlanmadı'}</h1>
          <p className="subtitle">
            {student.name} • {reading.title}
          </p>
          <div className="student-result-score">%{result.scorePercent}</div>
          <div className="status-summary">
            <span className={`badge ${result.gates.dwellOk ? 'badge-success' : 'badge-danger'}`}>
              ⏱ Dwell {result.gates.dwellOk ? '✓' : '✗'}
            </span>
            <span className={`badge ${result.gates.scrollOk ? 'badge-success' : 'badge-danger'}`}>
              Scroll {result.gates.scrollOk ? '✓' : '✗'}
            </span>
            <span className={`badge ${result.gates.quizOk ? 'badge-success' : 'badge-danger'}`}>
              Quiz {result.gates.quizOk ? '✓' : '✗'}
            </span>
          </div>
          {!result.read && (
            <div className="alert alert-warning">
              {!result.gates.dwellOk && <div>Okuma süresi dolmadı ({required} sn gerekli).</div>}
              {!result.gates.scrollOk && <div>Metin sonuna kadar kaydırılmadı.</div>}
              {!result.gates.quizOk && <div>Quiz eşiği geçilemedi.</div>}
            </div>
          )}
          <p className="muted small">⏱ Süre: {formatSeconds(result.totalSeconds)}</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={onBack}>
          Okumalara dön
        </button>
      </div>
    )
  }

  const question = total > 0 ? questions[Math.min(step, total - 1)] : null
  const selected = question ? answers[question.id] : undefined

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-sm mb-16" type="button" onClick={onBack}>
            ← Okumalar
          </button>
          <h1>{reading.title}</h1>
          <div className="subtitle">
            {reading.sourceLabel ? `${reading.sourceLabel} • ` : ''}
            {subjectLabel(reading.subject)} • {gradeLabel(reading.grade)}
          </div>
        </div>
        <div className="row-actions exam-status-group" aria-live="polite">
          <span className={`badge ${gates.dwellOk ? 'badge-success' : 'badge-warning'}`}>
            ⏱ {dwellSeconds}/{required} sn
          </span>
          <span className={`badge ${scrolledBottom ? 'badge-success' : 'badge-warning'}`}>
            Kaydırma: %{scrolledBottom ? 100 : 0}
          </span>
          {total > 0 && (
            <span className={`badge ${answeredCount === total ? 'badge-success' : 'badge-warning'}`}>
              Quiz: {answeredCount}/{total}
            </span>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div
          className="reading-body no-copy"
          onScroll={handleScroll}
          onCopy={(event) => event.preventDefault()}
          style={{ maxHeight: 320, overflowY: 'auto', whiteSpace: 'pre-wrap' }}
        >
          {reading.body}
        </div>
        <p className="small muted mt-8">
          {/* eslint-disable-next-line no-undef */}
          Metni sonuna kadar kaydırın ve {required} sn okuma süresini doldurun. Kopyalama kapalıdır; bu istemci
          sinyalleri göz-temasını kanıtlamaz.
        </p>
      </div>

      {total === 0 ? (
        <div className="card mt-16">
          <p>Bu okumada quiz sorusu yok. Süre + kaydırma koşulunu doldurunca bitirebilirsiniz.</p>
          <button
            className="btn btn-success"
            type="button"
            disabled={!canFinish || submitting}
            onClick={() => submit(true)}
            title={
              canFinish
                ? 'Okumayı bitir'
                : `Önce metni sonuna kadar kaydırın ve ${required} sn okuma süresini doldurun.`
            }
          >
            {submitting ? 'Gönderiliyor…' : '✅ Okumayı Bitir'}
          </button>
          {!canFinish && (
            <p className="small muted mt-8">
              Önce metni sonuna kadar kaydırın ve {required} sn okuma süresini doldurun.
            </p>
          )}
        </div>
      ) : (
        <div className="card mt-16">
          <div className="exam-progress">
            <span className="small muted">
              Soru {step + 1} / {total}
            </span>
            <div className="row-actions">
              {questions.map((item, index) => (
                <button
                  key={item.id || index}
                  className="btn btn-sm"
                  type="button"
                  style={{
                    padding: '2px 8px',
                    background: index === step ? 'var(--primary)' : answers[item.id] !== undefined ? 'var(--success)' : '#fff',
                    color: index === step || answers[item.id] !== undefined ? '#fff' : 'inherit'
                  }}
                  onClick={() => setStep(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="question-block" style={{ marginBottom: 0 }}>
            <QuestionImage image={question.image} />
            <div className="q-head">
              <strong>
                {step + 1}. {question.text}
              </strong>
              <div className="row-actions question-status-group">
                <span className="badge badge-topic">{topicLabel(question.topic)}</span>
                <span className={`badge ${selected === undefined ? 'badge-warning' : 'badge-success'}`}>
                  {selected === undefined ? '○ Cevaplanmadı' : '✓ Cevap seçildi'}
                </span>
              </div>
            </div>
            <div className="mt-8">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  className={`answer-option ${selected === index ? 'selected' : ''}`}
                  type="button"
                  onClick={() => setAnswers((current) => ({ ...current, [question.id]: index }))}
                >
                  <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
                  <span>{option}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="exam-nav">
            <button className="btn" type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>
              ← Önceki
            </button>
            {step < total - 1 ? (
              <button className="btn btn-primary" type="button" onClick={() => setStep(step + 1)}>
                Sonraki →
              </button>
            ) : (
              <button
                className="btn btn-success"
                type="button"
                disabled={!canFinish || submitting}
                onClick={() => submit(false)}
                title={
                  canFinish
                    ? 'Okumayı bitir'
                    : `Önce metni sonuna kadar kaydırın ve ${required} sn okuma süresini doldurun.`
                }
              >
                {submitting ? 'Gönderiliyor…' : '✅ Okumayı Bitir'}
              </button>
            )}
          </div>
          {!canFinish && (
            <p className="small muted mt-8">
              Önce metni sonuna kadar kaydırın ve {required} sn okuma süresini doldurun.
            </p>
          )}
        </div>
      )}

      {showSubmitConfirm && (
        <Modal title="Okumayı bitirmek istiyor musunuz?" onClose={() => setShowSubmitConfirm(false)}>
          <div className="submit-confirmation">
            <div className="submit-confirmation-icon">!</div>
            <p>
              <strong>{unansweredCount} soru boş.</strong> Boş bırakılan sorular cevapsız kaydedilecek. Okumayı yine de
              bitirmek istiyor musunuz?
            </p>
            <div className="row-actions submit-confirmation-actions">
              <button className="btn" type="button" onClick={() => setShowSubmitConfirm(false)}>
                Sorulara dön
              </button>
              <button className="btn btn-success" type="button" onClick={() => submit(true)}>
                Evet, okumayı bitir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
