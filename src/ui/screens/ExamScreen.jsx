import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, go } from '../../state/store.jsx'
import { gradeLabel, subjectLabel, topicLabel, formatSeconds } from '../../domain/model.js'
import Modal from '../components/Modal.jsx'
import QuestionImage from '../components/QuestionImage.jsx'
import ReviewQuestion from '../components/ReviewQuestion.jsx'
import ReviewSummary from '../components/ReviewSummary.jsx'

const EXAM_DRAFT_VERSION = 1
const examDraftKey = (testId) => `learn_app_exam_draft_v${EXAM_DRAFT_VERSION}_${testId}`

const readExamDraft = (testId) => {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(examDraftKey(testId))
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft || draft.version !== EXAM_DRAFT_VERSION || draft.testId !== testId || !draft.studentId) return null
    return draft
  } catch (error) {
    console.error('Sınav taslağı yüklenemedi:', error)
    return null
  }
}

const saveExamDraft = (testId, draft) => {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(examDraftKey(testId), JSON.stringify(draft))
  } catch (error) {
    console.error('Sınav taslağı kaydedilemedi:', error)
  }
}

const clearExamDraft = (testId) => {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(examDraftKey(testId))
  } catch (error) {
    console.error('Sınav taslağı temizlenemedi:', error)
  }
}

export default function ExamScreen({ id }) {
  const { db, actions } = useStore()
  // route 'sinav/ID' ya da 'sinav/ID/attemptId' (inceleme) olabilir
  const [testId, attemptId] = String(id || '').split('/')
  const test = db.tests.find((t) => t.id === testId)

  const reviewAttempt = attemptId ? db.attempts.find((a) => a.id === attemptId) : null
  const initialDraft = useMemo(() => readExamDraft(testId), [testId])
  const restoredStudentId = initialDraft?.studentId && db.students.some((student) => student.id === initialDraft.studentId)
    ? initialDraft.studentId
    : ''
  const draftToRestore = restoredStudentId ? initialDraft : null
  const restoredAnswers = useMemo(() => {
    if (!draftToRestore?.answers || !test) return {}
    const questions = new Map(test.questions.map((question) => [question.id, question]))
    return Object.fromEntries(
      Object.entries(draftToRestore.answers).filter(([questionId, selected]) => {
        const question = questions.get(questionId)
        return question && Number.isInteger(selected) && selected >= 0 && selected < question.options.length
      })
    )
  }, [draftToRestore, test])
  const restoredStep = useMemo(() => {
    if (!test?.questions.length) return 0
    const savedStep = Number(draftToRestore?.step)
    if (!Number.isInteger(savedStep)) return 0
    return Math.min(Math.max(savedStep, 0), test.questions.length - 1)
  }, [draftToRestore, test])

  const [studentId, setStudentId] = useState(() => restoredStudentId)
  const [step, setStep] = useState(() => restoredStep)
  const [finished, setFinished] = useState(false)
  const [lastAttempt, setLastAttempt] = useState(null)
  const [showReview, setShowReview] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [answers, setAnswers] = useState(() => restoredAnswers)
  const [restoredDraft, setRestoredDraft] = useState(() => Boolean(draftToRestore))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ---- süre ölçümü ----
  const [elapsedSec, setElapsedSec] = useState(() =>
    draftToRestore?.startedAt ? Math.max(0, Math.floor((Date.now() - draftToRestore.startedAt) / 1000)) : 0
  ) // sınavda geçen toplam süre (sn)
  const [timeByQid, setTimeByQid] = useState(() => draftToRestore?.timeByQid || {}) // soru bazlı harcanan süre (ms)
  const [timeUp, setTimeUp] = useState(false)
  const startRef = useRef(draftToRestore?.startedAt || null) // sınavın başladığı an (ms)
  const segmentStartRef = useRef(draftToRestore?.segmentStartedAt || null) // mevcut soruda harcanan sürenin başlangıcı (ms)
  const timeByQidRef = useRef(draftToRestore?.timeByQid || {}) // submit'te stale state okumamak için ref kopyası
  const stepRef = useRef(restoredStep)
  const finishedRef = useRef(false)
  const submitRef = useRef(null)

  const durationMin = test?.durationMinutes || null
  const deadlineAt = useMemo(() => {
    if (!durationMin || !startRef.current) return null
    return startRef.current + durationMin * 60 * 1000
  }, [durationMin, studentId, elapsedSec === 0 ? 0 : elapsedSec]) // eslint-disable-line

  const students = useMemo(
    () => db.students.filter((s) => s.grade === test?.grade || !test).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [db.students, test]
  )

  // Mevcut soruda geçen süreyi timeByQid'e işle; soru değişiminde çağrılır.
  const recordSegment = () => {
    const prevQ = test?.questions?.[stepRef.current]
    if (!prevQ || !segmentStartRef.current) return
    const delta = Date.now() - segmentStartRef.current
    if (delta > 0) {
      const next = { ...timeByQidRef.current, [prevQ.id]: (timeByQidRef.current[prevQ.id] || 0) + delta }
      timeByQidRef.current = next
      setTimeByQid(next)
    }
    segmentStartRef.current = Date.now()
  }

  // step değişimi: önceki sorunun süresini kapat, yeni soruya geç
  const changeStep = (next) => {
    recordSegment()
    stepRef.current = next
    setStep(next)
  }

  // Sınav zamanlayıcısı: öğrenci seçildiğinde başlar, bitince durur
  useEffect(() => {
    if (!studentId || finishedRef.current || !test?.questions?.length) return
    if (!startRef.current) {
      startRef.current = Date.now()
      segmentStartRef.current = Date.now()
    }
    const iv = setInterval(() => {
      const now = Date.now()
      const totalSec = Math.floor((now - startRef.current) / 1000)
      setElapsedSec(totalSec)
      if (durationMin && now >= startRef.current + durationMin * 60 * 1000) {
        // süre doldu → otomatik teslim
        clearInterval(iv)
        setTimeUp(true)
        submitRef.current?.(true)
      }
    }, 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, durationMin])

  // Aktif sınav yenilenir veya sekme kapatılırsa tarayıcıdan uyarı iste.
  useEffect(() => {
    if (!studentId) return
    const onBeforeUnload = (event) => {
      if (finishedRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [studentId])

  // Cevapları ve zaman bilgisini sekme oturumu boyunca koru.
  useEffect(() => {
    if (!studentId || finishedRef.current || !test) return
    saveExamDraft(testId, {
      version: EXAM_DRAFT_VERSION,
      testId,
      studentId,
      step: stepRef.current,
      answers,
      timeByQid: timeByQidRef.current,
      startedAt: startRef.current,
      segmentStartedAt: segmentStartRef.current
    })
  }, [answers, elapsedSec, step, studentId, test, testId, timeByQid])

  if (!test) {
    return (
      <div className="card empty">
        Test bulunamadı. <a href="#/testler">Testlere dön</a>
      </div>
    )
  }

  if (test.questions.length === 0) {
    return (
      <div className="card empty">
        <p>Bu testte henüz soru yok; öğrenciye uygulanamaz.</p>
        <div className="row-actions" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => go('/testler')}>
            Testlere dön
          </button>
          <button className="btn btn-primary" onClick={() => go(`/test/${test.id}`)}>
            Soru ekle
          </button>
        </div>
      </div>
    )
  }

  if (reviewAttempt) {
    return <AttemptReview attempt={reviewAttempt} test={test} onBack={() => go('/sonuclar')} />
  }

  const total = test.questions.length
  const answeredCount = Object.keys(answers).filter((k) => answers[k] !== null && answers[k] !== undefined).length
  const unansweredCount = Math.max(0, total - answeredCount)
  const remainingSec = deadlineAt ? Math.max(0, Math.floor((deadlineAt - Date.now()) / 1000)) : null

  const submit = async (wasTimeUp = false, confirmed = false) => {
    if (finishedRef.current || submitting) return
    if (!wasTimeUp && !confirmed && unansweredCount > 0) {
      setShowSubmitConfirm(true)
      return
    }
    finishedRef.current = true
    setShowSubmitConfirm(false)
    setSubmitError('')
    setSubmitting(true)
    recordSegment()
    const totalMs = Date.now() - startRef.current
    try {
      const attempt = await actions.addAttempt(test, answers, studentId, {
        timeByQid: Object.fromEntries(
          Object.entries(timeByQidRef.current).map(([k, v]) => [k, Math.round(v / 1000)])
        ),
        totalSeconds: Math.round(totalMs / 1000),
        timeUp: wasTimeUp
      })
      clearExamDraft(testId)
      setLastAttempt(attempt)
      setFinished(true)
      setTimeUp(wasTimeUp)
    } catch (caughtError) {
      finishedRef.current = false
      if (wasTimeUp) setTimeUp(false)
      setSubmitError(caughtError.message)
    } finally {
      setSubmitting(false)
    }
  }
  submitRef.current = submit

  const restart = () => {
    clearExamDraft(testId)
    setStudentId('')
    setStep(0)
    setAnswers({})
    setFinished(false)
    setLastAttempt(null)
    setShowSubmitConfirm(false)
    setRestoredDraft(false)
    setTimeUp(false)
    setElapsedSec(0)
    setTimeByQid({})
    finishedRef.current = false
    startRef.current = null
    segmentStartRef.current = null
    stepRef.current = 0
    timeByQidRef.current = {}
  }

  const studentName = db.students.find((s) => s.id === studentId)?.name || ''

  // ---------- Sınav sonucu ----------
  if (finished && lastAttempt) {
    const unansweredAfterSubmit = (lastAttempt.answers || []).filter(
      (answer) => answer.selected === undefined || answer.selected === null || answer.selected < 0
    ).length
    const wrongAfterSubmit = Math.max(0, lastAttempt.totalCount - lastAttempt.correctCount - unansweredAfterSubmit)

    return (
      <div>
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <h1 style={{ fontSize: '1.6rem' }}>{timeUp ? '⏰ Süre Doldu' : '🎉 Test Tamamlandı'}</h1>
          <p className="subtitle">
            {studentName} • {test.title}
          </p>
          {timeUp && <div className="alert alert-warning" style={{ maxWidth: 480, margin: '0 auto 12px' }}>
            <strong>⏰ Süre doldu.</strong> Sınav otomatik teslim edildi.
          </div>}
          <div style={{ fontSize: '3rem', fontWeight: 800, color: lastAttempt.scorePercent >= 60 ? 'var(--success)' : 'var(--danger)' }}>
            %{lastAttempt.scorePercent}
          </div>
          <p>
            <strong>
              {lastAttempt.correctCount} / {lastAttempt.totalCount}
            </strong>{' '}
            doğru
          </p>
          <div className="status-summary" aria-label="Sınav cevap özeti">
          <span className="badge badge-success">✓ {lastAttempt.correctCount} Doğru</span>
          <span className="badge badge-danger">✗ {wrongAfterSubmit} Yanlış</span>
          {unansweredAfterSubmit > 0 && (
            <span className="badge badge-warning">○ {unansweredAfterSubmit} Cevaplanmadı</span>
          )}
          {timeUp && <span className="badge badge-warning">⏰ Süre doldu</span>}
          </div>
          <p className="muted small">
          ⏱ Süre: {formatSeconds(lastAttempt.totalSeconds)}
            {durationMin ? ` / ${durationMin} dk` : ''} • soru başına ortalama{' '}
            {lastAttempt.totalSeconds && lastAttempt.totalCount
              ? formatSeconds(Math.round(lastAttempt.totalSeconds / lastAttempt.totalCount))
              : '—'}
          </p>
          <div className="row-actions" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={restart}>
              ↺ Yeni Öğrenci / Yeniden
            </button>
            <button className="btn btn-primary" onClick={() => setShowReview(true)}>
              🔍 Cevapları İncele
            </button>
            <button className="btn" onClick={() => go(`/ogrenci/${studentId}`)}>
              Öğrenci Detayı
            </button>
          </div>
        </div>

        {showReview && (
          <AttemptReview attempt={lastAttempt} test={test} onBack={() => setShowReview(false)} title="Sonuç İncelemesi" />
        )}
      </div>
    )
  }

  // ---------- Öğrenci seçimi ----------
  if (!studentId) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Sınav</h1>
            <div className="subtitle">
              {test.title} • {subjectLabel(test.subject)} • {gradeLabel(test.grade)} • {total} soru
              {durationMin ? ` • ⏱ ${durationMin} dk` : ' • süresiz'}
            </div>
          </div>
          <button className="btn" onClick={() => go('/testler')}>
            ← Testler
          </button>
        </div>

        <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2>Sınava girecek öğrenciyi seçin</h2>
          <p className="small muted">Sonuç, seçilen öğrenciye kaydedilir ve raporlarda kullanılır.</p>
          {students.length === 0 ? (
            <div className="empty">
              Bu sınıf için kayıtlı öğrenci yok.
              <div className="mt-8">
                <button className="btn btn-primary" onClick={() => go('/ogrenciler')}>
                  Öğrenci Ekle
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid-cards">
                {students.map((s) => (
                  <div key={s.id} className="grid-card" onClick={() => setStudentId(s.id)}>
                    <h3>{s.name}</h3>
                    <div className="muted small">{gradeLabel(s.grade)}</div>
                  </div>
                ))}
              </div>
              <div className="row-actions mt-16">
                <button className="btn" onClick={() => go('/ogrenciler')}>
                  + Yeni Öğrenci Ekle
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ---------- Soru ekranı ----------
  const q = test.questions[step]
  const selected = answers[q.id]
  const timerDanger = remainingSec !== null && remainingSec <= 60
  const timerLabel = remainingSec !== null ? formatTimer(remainingSec) : null

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sınav</h1>
          <div className="subtitle">
            {studentName} • {test.title}
          </div>
        </div>
        <div className="row-actions exam-status-group" aria-live="polite">
          <span className={`badge ${unansweredCount > 0 ? 'badge-warning' : 'badge-success'}`}>
            {unansweredCount > 0 ? `✓ ${answeredCount}/${total} cevaplandı` : '✓ Tüm sorular cevaplandı'}
          </span>
          {unansweredCount > 0 && <span className="badge badge-warning">○ {unansweredCount} soru boş</span>}
          {durationMin && (
            <span className={`badge ${timerDanger ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.9rem' }}>
              ⏱ {timerLabel}
            </span>
          )}
        </div>
      </div>

      {restoredDraft && (
        <div className="alert alert-info exam-draft-alert">
          <span>
            <strong>↻ Sınav kaldığı yerden geri yüklendi.</strong> Cevaplarınız ve süre bilgileriniz bu sekmede korunuyor.
          </span>
          <button className="btn btn-sm" onClick={restart}>
            Baştan başla
          </button>
        </div>
      )}

      <div className="card">
        <div className="exam-progress">
          <span className="small muted">
            Soru {step + 1} / {total}
          </span>
          <div className="row-actions">
            {test.questions.map((_, i) => (
              <button
                key={i}
                className="btn btn-sm"
                style={{
                  padding: '2px 8px',
                  background: i === step ? 'var(--primary)' : answers[test.questions[i].id] !== undefined ? 'var(--success)' : '#fff',
                  color: i === step || answers[test.questions[i].id] !== undefined ? '#fff' : 'inherit'
                }}
                onClick={() => changeStep(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="question-block" style={{ marginBottom: 0 }}>
          <QuestionImage image={q.image} />
          <div className="q-head">
            <strong>
              {step + 1}. {q.text}
            </strong>
            <div className="row-actions question-status-group">
              <span className="badge badge-topic">{topicLabel(q.topic)}</span>
              <span className={`badge ${selected === undefined ? 'badge-warning' : 'badge-success'}`}>
                {selected === undefined ? '○ Cevaplanmadı' : '✓ Cevap seçildi'}
              </span>
              <span className="badge badge-grade" style={{ marginLeft: 6 }}>
                ⏱ {formatTimer(Math.round((timeByQid[q.id] || 0) / 1000) + Math.floor((Date.now() - (segmentStartRef.current || Date.now())) / 1000))}
              </span>
            </div>
          </div>
          <div className="mt-8">
            {q.options.map((o, i) => {
              const letter = String.fromCharCode(65 + i)
              return (
                <div
                  key={i}
                  className={`answer-option ${selected === i ? 'selected' : ''}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                >
                  <span className="answer-letter">{letter}</span>
                  <span>{o}</span>
                </div>
              )
            })}
          </div>
        </div>

        {submitError && <div className="alert alert-error">{submitError}</div>}
        <div className="exam-nav">
          <button className="btn" disabled={step === 0} onClick={() => changeStep(step - 1)}>
            ← Önceki
          </button>
          {step < total - 1 ? (
            <button className="btn btn-primary" onClick={() => changeStep(step + 1)}>
              Sonraki →
            </button>
          ) : (
            <button
              className="btn btn-success"
              onClick={() => submit(false)}
              disabled={submitting}
              title={unansweredCount > 0 ? `${unansweredCount} soru boş; bitirmek için onay istenecek` : 'Testi bitir'}
            >
              {submitting ? 'Kaydediliyor…' : '✅ Testi Bitir'}
            </button>
          )}
        </div>
      </div>

      {showSubmitConfirm && (
        <Modal title="Testi bitirmek istiyor musunuz?" onClose={() => setShowSubmitConfirm(false)}>
          <div className="submit-confirmation">
            <div className="submit-confirmation-icon">!</div>
            <p>
              <strong>{unansweredCount} soru boş.</strong> Boş bırakılan sorular cevapsız olarak kaydedilecek. Testi yine de
              bitirmek istiyor musunuz?
            </p>
            <div className="row-actions submit-confirmation-actions">
              <button className="btn" onClick={() => setShowSubmitConfirm(false)}>
                Sorulara dön
              </button>
              <button className="btn btn-success" onClick={() => submit(false, true)} disabled={submitting}>
                Evet, testi bitir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// kalan süreyi mm:ss veya ss olarak biçimlendir
const formatTimer = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r} sn`
}

// Deneme incelemesi (sonuçtan sonra veya kayıtlı sonuca bakarken)
function AttemptReview({ attempt, test, onBack, title }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{title || 'Sınav İncelemesi'}</h1>
          <div className="subtitle">
            {test.title} • {subjectLabel(test.subject)} • {gradeLabel(test.grade)}
            {attempt.totalSeconds ? ` • ⏱ ${formatSeconds(attempt.totalSeconds)}` : ''}
          </div>
        </div>
        <button className="btn" onClick={onBack}>
          ← Geri
        </button>
      </div>

      <ReviewSummary attempt={attempt} />

      <div className="review-question-list">
        {test.questions.map((q, idx) => {
          const ans = attempt.answers?.[idx] || { selected: -1, correctIndex: q.correctIndex, correct: false }
          const selectedIdx = typeof ans.selected === 'number' ? ans.selected : ans.selectedIndex
          // attempt kaydı seçeneklerin kopyasını taşır (test düzenlense bile doğru inceleme)
          const options = ans.options?.length ? ans.options : q.options
          const correctIndex = typeof ans.correctIndex === 'number' ? ans.correctIndex : q.correctIndex
          const isAnswered = Number.isInteger(selectedIdx) && selectedIdx >= 0 && selectedIdx < options.length
          const isCorrect = isAnswered && (ans.correct ?? selectedIdx === correctIndex)

          return (
            <ReviewQuestion
              key={q.id || idx}
              index={idx}
              questionText={ans.questionText || q.text}
              image={ans.image || q.image}
              topic={ans.topic || q.topic}
              seconds={ans.seconds}
              options={options}
              correctIndex={correctIndex}
              selectedIndex={selectedIdx}
              isAnswered={isAnswered}
              isCorrect={isCorrect}
              explanation={q.explanation}
            />
          )
        })}
      </div>

      <div className="row-actions">
        <button className="btn" onClick={onBack}>
          ← Geri
        </button>
      </div>
    </div>
  )
}
