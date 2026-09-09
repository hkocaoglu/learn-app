import { useEffect, useMemo, useRef, useState } from 'react'
import { submitStudentAttempt } from '../../cloud/attempts.js'
import { formatSeconds, gradeLabel, subjectLabel, topicLabel } from '../../domain/model.js'
import Modal from '../components/Modal.jsx'
import QuestionImage from '../components/QuestionImage.jsx'
import ReviewQuestion from '../components/ReviewQuestion.jsx'
import ReviewSummary from '../components/ReviewSummary.jsx'

const DRAFT_VERSION = 1
const draftKey = (studentId, assignmentId) => `learn_app_student_exam_v${DRAFT_VERSION}_${studentId}_${assignmentId}`

const readDraft = (studentId, assignmentId) => {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(draftKey(studentId, assignmentId))
    if (!raw) return null
    const draft = JSON.parse(raw)
    return draft?.version === DRAFT_VERSION ? draft : null
  } catch (error) {
    console.error('Öğrenci sınav taslağı yüklenemedi:', error)
    return null
  }
}

const saveDraft = (studentId, assignmentId, draft) => {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(draftKey(studentId, assignmentId), JSON.stringify(draft))
  } catch (error) {
    console.error('Öğrenci sınav taslağı kaydedilemedi:', error)
  }
}

const clearDraft = (studentId, assignmentId) => {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(draftKey(studentId, assignmentId))
  } catch (error) {
    console.error('Öğrenci sınav taslağı temizlenemedi:', error)
  }
}

const formatTimer = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0))
  const minutes = Math.floor(value / 60)
  const remaining = value % 60
  return minutes > 0 ? `${minutes}:${String(remaining).padStart(2, '0')}` : `${remaining} sn`
}

export default function StudentExamScreen({ student, assignment, onBack }) {
  const test = assignment.test
  const draft = useMemo(() => readDraft(student.id, assignment.id), [student.id, assignment.id])
  const [step, setStep] = useState(() => Math.min(Math.max(Number(draft?.step) || 0, 0), Math.max(0, (test?.questions.length || 1) - 1)))
  const [answers, setAnswers] = useState(() => draft?.answers || {})
  const [timeByQid, setTimeByQid] = useState(() => draft?.timeByQid || {})
  const [elapsedSec, setElapsedSec] = useState(() =>
    draft?.startedAt ? Math.max(0, Math.floor((Date.now() - draft.startedAt) / 1000)) : 0
  )
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [finished, setFinished] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const startedAtRef = useRef(draft?.startedAt || Date.now())
  const segmentStartedAtRef = useRef(draft?.segmentStartedAt || Date.now())
  const timeByQidRef = useRef(draft?.timeByQid || {})
  const stepRef = useRef(step)
  const finishedRef = useRef(false)
  const submitRef = useRef(null)

  const total = test?.questions.length || 0
  const durationMinutes = test?.durationMinutes || null
  const deadlineAt = durationMinutes ? startedAtRef.current + durationMinutes * 60 * 1000 : null
  const answeredCount = Object.values(answers).filter((value) => Number.isInteger(value) && value >= 0).length
  const unansweredCount = Math.max(0, total - answeredCount)
  const remainingSec = deadlineAt ? Math.max(0, Math.floor((deadlineAt - Date.now()) / 1000)) : null

  const recordSegment = () => {
    const question = test?.questions?.[stepRef.current]
    if (!question || !segmentStartedAtRef.current) return
    const elapsed = Date.now() - segmentStartedAtRef.current
    const next = {
      ...timeByQidRef.current,
      [question.id]: (timeByQidRef.current[question.id] || 0) + Math.max(0, elapsed)
    }
    timeByQidRef.current = next
    setTimeByQid(next)
    segmentStartedAtRef.current = Date.now()
  }

  useEffect(() => {
    if (finishedRef.current || !test) return undefined

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setElapsedSec(elapsed)
      if (deadlineAt && Date.now() >= deadlineAt) {
        clearInterval(interval)
        submitRef.current?.(true)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [deadlineAt, test])

  useEffect(() => {
    if (finishedRef.current || !test) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [test])

  useEffect(() => {
    if (finishedRef.current || !test) return
    saveDraft(student.id, assignment.id, {
      version: DRAFT_VERSION,
      step: stepRef.current,
      answers,
      timeByQid: timeByQidRef.current,
      startedAt: startedAtRef.current,
      segmentStartedAt: segmentStartedAtRef.current
    })
  }, [answers, assignment.id, elapsedSec, student.id, test, timeByQid])

  if (!test || total === 0) {
    return (
      <div className="card empty">
        Bu atamanın geçerli bir test içeriği yok.
        <div className="mt-8">
          <button className="btn btn-primary" type="button" onClick={onBack}>
            Atamalara dön
          </button>
        </div>
      </div>
    )
  }

  const submit = async (wasTimeUp = false, confirmed = false) => {
    if (finishedRef.current || submitting) return
    if (!wasTimeUp && !confirmed && unansweredCount > 0) {
      setShowSubmitConfirm(true)
      return
    }

    finishedRef.current = true
    setShowSubmitConfirm(false)
    setSubmitting(true)
    setError('')
    recordSegment()

    const totalSeconds = Math.round((Date.now() - startedAtRef.current) / 1000)
    const secondsByQuestion = Object.fromEntries(
      Object.entries(timeByQidRef.current).map(([questionId, milliseconds]) => [questionId, Math.round(milliseconds / 1000)])
    )

    try {
      const saved = await submitStudentAttempt({
        student,
        assignment,
        test,
        answers,
        timeByQid: secondsByQuestion,
        totalSeconds,
        timeUp: wasTimeUp,
        startedAt: startedAtRef.current
      })
      clearDraft(student.id, assignment.id)
      setResult(saved)
      setTimeUp(wasTimeUp)
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
    const unansweredAfterSubmit = result.answers.filter((answer) => answer.selected === undefined || answer.selected < 0).length
    return (
      <div>
        <div className="card student-result-card">
          <h1>{timeUp ? '⏰ Süre doldu' : '🎉 Test tamamlandı'}</h1>
          <p className="subtitle">
            {student.name} • {test.title}
          </p>
          {timeUp && <div className="alert alert-warning">Süre dolduğu için test otomatik teslim edildi.</div>}
          <div className="student-result-score">%{result.scorePercent}</div>
          <div className="status-summary">
            <span className="badge badge-success">✓ {result.correctCount} Doğru</span>
            <span className="badge badge-danger">✗ {result.totalCount - result.correctCount - unansweredAfterSubmit} Yanlış</span>
            {unansweredAfterSubmit > 0 && <span className="badge badge-warning">○ {unansweredAfterSubmit} Boş</span>}
          </div>
          <p className="muted small">⏱ Süre: {formatSeconds(result.totalSeconds)}</p>
        </div>
        <ReviewSummary attempt={result} />
        <div className="review-question-list">
          {result.answers.map((answer, index) => (
            <ReviewQuestion
              key={answer.questionId || index}
              index={index}
              questionText={answer.questionText}
              image={answer.image}
              topic={answer.topic}
              seconds={answer.seconds}
              options={answer.options}
              correctIndex={answer.correctIndex}
              selectedIndex={answer.selected}
              isAnswered={Number.isInteger(answer.selected) && answer.selected >= 0}
              isCorrect={answer.correct}
            />
          ))}
        </div>
        <button className="btn btn-primary" type="button" onClick={onBack}>
          Atanan testlere dön
        </button>
      </div>
    )
  }

  const question = test.questions[step]
  const selected = answers[question.id]
  const timerDanger = remainingSec !== null && remainingSec <= 60

  const changeStep = (nextStep) => {
    recordSegment()
    stepRef.current = nextStep
    setStep(nextStep)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-sm mb-16" type="button" onClick={onBack}>
            ← Atanan testler
          </button>
          <h1>Sınav</h1>
          <div className="subtitle">
            {test.title} • {subjectLabel(test.subject)} • {gradeLabel(test.grade)} • {total} soru
          </div>
        </div>
        <div className="row-actions exam-status-group" aria-live="polite">
          <span className={`badge ${unansweredCount > 0 ? 'badge-warning' : 'badge-success'}`}>
            {answeredCount}/{total} cevaplandı
          </span>
          {unansweredCount > 0 && <span className="badge badge-warning">○ {unansweredCount} soru boş</span>}
          {remainingSec !== null && (
            <span className={`badge ${timerDanger ? 'badge-danger' : 'badge-warning'}`}>⏱ {formatTimer(remainingSec)}</span>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="exam-progress">
          <span className="small muted">
            Soru {step + 1} / {total}
          </span>
          <div className="row-actions">
            {test.questions.map((item, index) => (
              <button
                key={item.id || index}
                className="btn btn-sm"
                type="button"
                style={{
                  padding: '2px 8px',
                  background: index === step ? 'var(--primary)' : answers[item.id] !== undefined ? 'var(--success)' : '#fff',
                  color: index === step || answers[item.id] !== undefined ? '#fff' : 'inherit'
                }}
                onClick={() => changeStep(index)}
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
          <button className="btn" type="button" disabled={step === 0} onClick={() => changeStep(step - 1)}>
            ← Önceki
          </button>
          {step < total - 1 ? (
            <button className="btn btn-primary" type="button" onClick={() => changeStep(step + 1)}>
              Sonraki →
            </button>
          ) : (
            <button className="btn btn-success" type="button" disabled={submitting} onClick={() => submit(false)}>
              {submitting ? 'Gönderiliyor…' : '✅ Testi Bitir'}
            </button>
          )}
        </div>
      </div>

      {showSubmitConfirm && (
        <Modal title="Testi bitirmek istiyor musunuz?" onClose={() => setShowSubmitConfirm(false)}>
          <div className="submit-confirmation">
            <div className="submit-confirmation-icon">!</div>
            <p>
              <strong>{unansweredCount} soru boş.</strong> Boş bırakılan sorular cevapsız kaydedilecek. Testi yine de bitirmek
              istiyor musunuz?
            </p>
            <div className="row-actions submit-confirmation-actions">
              <button className="btn" type="button" onClick={() => setShowSubmitConfirm(false)}>
                Sorulara dön
              </button>
              <button className="btn btn-success" type="button" onClick={() => submit(false, true)}>
                Evet, testi bitir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
