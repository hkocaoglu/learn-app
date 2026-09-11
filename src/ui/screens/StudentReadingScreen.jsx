import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluateReadingGates, submitReadingAttempt } from '../../cloud/readings.js'
import { synthesizeSpeech } from '../../ai/tts.js'
import { formatSeconds, gradeLabel, requiredDwellSeconds, subjectLabel, topicLabel } from '../../domain/model.js'
import {
  buildSpeechSegments,
  clampRate,
  formatRate,
  loadSpeechRate,
  pickTurkishVoice,
  saveSpeechRate,
  speechSupported,
  stopSpeech,
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_RATE_STEP
} from '../../lib/speech.js'
import Modal from '../components/Modal.jsx'
import QuestionImage from '../components/QuestionImage.jsx'

const DRAFT_VERSION = 2

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
  const [quizStarted, setQuizStarted] = useState(() => draft?.quizStarted === true)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [speechActive, setSpeechActive] = useState(false)
  const [speechIndex, setSpeechIndex] = useState(-1)
  const [speechNotice, setSpeechNotice] = useState('')
  const [speechRate, setSpeechRate] = useState(loadSpeechRate)

  const startedAtRef = useRef(draft?.startedAt || Date.now())
  const accumulatedRef = useRef(Number(draft?.dwellSeconds) || 0)
  const lastTickRef = useRef(Date.now())
  const scrolledRef = useRef(draft?.scrolledBottom === true)
  const finishedRef = useRef(false)
  const submitRef = useRef(null)
  const bodyRef = useRef(null)
  const voiceRef = useRef(null)
  const speechTokenRef = useRef(0)
  const speechRateRef = useRef(speechRate)
  const engineRef = useRef('unknown') // 'cloud' | 'browser' (ilk denemede belirlenir)
  const audioRef = useRef(null)
  const audioUrlRef = useRef('')
  const pendingIndexRef = useRef(-1)
  const segmentBlobsRef = useRef(new Map())

  const speechSegments = useMemo(() => buildSpeechSegments(reading?.body), [reading?.body])

  const answeredCount = Object.values(answers).filter((value) => Number.isInteger(value) && value >= 0).length
  const unansweredCount = Math.max(0, total - answeredCount)
  const gates = evaluateReadingGates({ reading, answers, dwellSeconds, scrolledBottom })
  const canFinish = gates.dwellOk && gates.scrollOk
  const passageVisible = !quizStarted || total === 0 || reading?.showPassageDuringQuiz !== false

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
      quizStarted,
      startedAt: startedAtRef.current
    })
  }, [answers, dwellSeconds, quizStarted, reading, readingAssignment.id, scrolledBottom, step, student.id])

  useEffect(() => {
    if (finishedRef.current || !reading) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [reading])

  const markScrolled = () => {
    scrolledRef.current = true
    setScrolledBottom(true)
  }

  const handleScroll = (event) => {
    const el = event.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) markScrolled()
  }

  // ---- Sesli okuma (erişilebilirlik) ----
  // Kanıt kapılarını değiştirmez: süre, kaydırma ve quiz koşulları aynen geçerlidir.
  useEffect(() => {
    if (!speechSupported()) {
      setSpeechNotice('Bu tarayıcı sesli okumayı desteklemiyor.')
      return undefined
    }
    const synth = window.speechSynthesis
    const loadVoice = () => {
      voiceRef.current = pickTurkishVoice()
    }
    loadVoice()
    // Ses listesi bazı tarayıcılarda gecikmeli gelir.
    synth.addEventListener?.('voiceschanged', loadVoice)
    return () => synth.removeEventListener?.('voiceschanged', loadVoice)
  }, [])

  // Ekrandan çıkışta veya metin gizlendiğinde sesi kes.
  useEffect(
    () => () => {
      stopSpeaking()
      segmentBlobsRef.current.clear()
    },
    []
  )

  // ---- Bulut seslendirme (anahtar sunucuda tanımlıysa) ----
  // Yapılandırılmamışsa bir kez denenir, sonra tarayıcı sesine düşülür.
  const loadSegmentBlob = async (index) => {
    const cache = segmentBlobsRef.current
    if (cache.has(index)) return cache.get(index)
    const result = await synthesizeSpeech({ text: speechSegments[index], speed: speechRateRef.current })
    if (!result.ok) {
      const error = new Error(result.error || 'Ses üretilemedi.')
      error.unavailable = result.unavailable === true
      throw error
    }
    cache.set(index, result.blob)
    return result.blob
  }

  const cloudAudio = () => {
    if (!audioRef.current) audioRef.current = new Audio()
    return audioRef.current
  }

  const playCloudFrom = (startIndex) => {
    const token = speechTokenRef.current

    const fail = (message) => {
      if (speechTokenRef.current !== token) return
      setSpeechActive(false)
      setSpeechIndex(-1)
      if (message) setSpeechNotice(message)
    }

    const playAt = async (index) => {
      if (speechTokenRef.current !== token) return
      if (index >= speechSegments.length) {
        setSpeechActive(false)
        setSpeechIndex(-1)
        return
      }
      setSpeechIndex(index)
      let blob
      try {
        blob = await loadSegmentBlob(index)
      } catch (error) {
        // Bulut yoksa sessizce tarayıcı sesine geç (mevcut deneyim korunur).
        if (error.unavailable && engineRef.current === 'unknown' && speechSupported()) {
          engineRef.current = 'browser'
          speakFrom(index)
          return
        }
        fail(
          error.unavailable
            ? 'Seslendirme kullanılamıyor: sunucuda ses sağlayıcısı tanımlı değil ve bu tarayıcı sesli okumayı desteklemiyor.'
            : error.message
        )
        return
      }
      if (speechTokenRef.current !== token) return

      const audio = cloudAudio()
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url
      audio.src = url
      audio.playbackRate = speechRateRef.current
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (audioUrlRef.current === url) audioUrlRef.current = ''
        if (speechTokenRef.current !== token) return
        playAt(index + 1)
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        if (audioUrlRef.current === url) audioUrlRef.current = ''
        fail('Ses oynatılamadı.')
      }
      try {
        await audio.play()
        // Sıradaki parçayı önden indir: parçalar arası boşluk olmasın.
        if (index + 1 < speechSegments.length) loadSegmentBlob(index + 1).catch(() => {})
      } catch {
        URL.revokeObjectURL(url)
        if (audioUrlRef.current === url) audioUrlRef.current = ''
        fail('Ses başlatılamadı. Tarayıcı otomatik oynatmayı engelliyor olabilir.')
      }
    }

    void playAt(startIndex)
  }

  const startSpeaking = (fromIndex) => {
    if (engineRef.current === 'browser') {
      speakFrom(fromIndex)
      return
    }
    if (engineRef.current === 'cloud') {
      playCloudFrom(fromIndex)
      return
    }
    // İlk kullanım: bulut var mı? Yoksa tarayıcı sesi.
    setSpeechActive(true)
    speechTokenRef.current += 1
    playCloudFrom(fromIndex)
  }

  const stopSpeaking = () => {
    speechTokenRef.current += 1
    setSpeechActive(false)
    setSpeechIndex(-1)
    stopSpeech()
    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = ''
    }
  }

  const speakFrom = (startIndex) => {
    if (!speechSupported() || speechSegments.length === 0) return
    const synth = window.speechSynthesis
    const token = speechTokenRef.current
    if (!voiceRef.current) {
      setSpeechNotice('Cihazda Türkçe ses bulunamadı; varsayılan ses kullanılacak.')
    }

    const fail = () => {
      if (speechTokenRef.current !== token) return
      setSpeechActive(false)
      setSpeechIndex(-1)
    }

    const speakAt = (index) => {
      if (speechTokenRef.current !== token) return
      if (index >= speechSegments.length) {
        setSpeechActive(false)
        setSpeechIndex(-1)
        return
      }
      setSpeechIndex(index)
      try {
        const utterance = new SpeechSynthesisUtterance(speechSegments[index])
        utterance.lang = 'tr-TR'
        utterance.rate = speechRateRef.current
        if (voiceRef.current) utterance.voice = voiceRef.current
        utterance.onend = () => speakAt(index + 1)
        utterance.onerror = fail
        synth.speak(utterance)
      } catch (caughtError) {
        // Bazı tarayıcılar/ayarlar ses başlatmayı reddeder; ekran "çalıyor" durumunda kilitli kalmamalı.
        console.error('Seslendirme başlatılamadı:', caughtError)
        fail()
        setSpeechNotice('Ses başlatılamadı. Tarayıcı sesli okumayı engelliyor olabilir (ses izni/otomatik oynatma ayarı).')
      }
    }

    speakAt(startIndex)
  }

  const toggleSpeaking = () => {
    if (!speechSupported() && engineRef.current !== 'cloud') {
      // Bulut desteği olmadan tarayıcı sesi yoksa yapılacak bir şey yok.
      setSpeechNotice('Bu tarayıcı sesli okumayı desteklemiyor.')
      return
    }
    if (speechActive) {
      speechTokenRef.current += 1
      setSpeechActive(false)
      stopSpeech()
      const audio = audioRef.current
      if (audio) {
        pendingIndexRef.current = speechIndex
        audio.pause()
      }
      return
    }
    const resumeAt = speechIndex >= 0 ? speechIndex : 0
    const audio = audioRef.current
    // Bulut parçası ortadan duraklatıldıysa kaldığı yerden devam et.
    if (engineRef.current === 'cloud' && audio && audio.src && pendingIndexRef.current === resumeAt) {
      pendingIndexRef.current = -1
      speechTokenRef.current += 1
      const token = speechTokenRef.current
      const restart = () => {
        if (speechTokenRef.current === token) setSpeechActive(false)
      }
      audio.playbackRate = speechRateRef.current
      audio.onended = () => {
        if (speechTokenRef.current !== token) return
        playCloudFrom(resumeAt + 1)
      }
      audio.onerror = restart
      setSpeechActive(true)
      setSpeechIndex(resumeAt)
      audio.play().catch(restart)
      return
    }
    speechTokenRef.current += 1
    setSpeechActive(true)
    startSpeaking(resumeAt)
  }

  // Hız değişince: bulut sesi anında uygulanır (playbackRate), tarayıcı sesi parçayı baştan okur.
  const changeRate = (delta) => {
    const next = clampRate(Number((speechRateRef.current + delta).toFixed(2)))
    if (next === speechRateRef.current) return
    speechRateRef.current = next
    setSpeechRate(next)
    saveSpeechRate(next)
    if (!speechActive) return
    if (engineRef.current === 'cloud') {
      if (audioRef.current) audioRef.current.playbackRate = next
      return
    }
    speechTokenRef.current += 1
    stopSpeech()
    setSpeechActive(true)
    speakFrom(Math.max(0, speechIndex))
  }

  // Metin gizlenirse (quiz sırasında gizli) sesi kes.
  useEffect(() => {
    if (passageVisible) return
    stopSpeaking()
  }, [passageVisible])

  // Metin kaydırma gerektirmiyorsa (kısa metin) kaydırma kapısı hemen sağlanmış sayılır;
  // aksi halde öğrenci hiçbir şey yapamadan kilitli kalırdı.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return undefined
    const check = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) markScrolled()
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [reading, quizStarted])

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
    stopSpeaking()

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
  // Quiz sırasında metin görünürse yan yana (geniş ekranda) yerleşim kullanılır.
  const splitLayout = quizStarted && total > 0 && reading?.showPassageDuringQuiz !== false

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

      <div className={`reading-layout ${splitLayout ? 'reading-layout-split' : ''}`}>
        {passageVisible && (
          <div className="card reading-pane">
            <div className="reading-audio-bar">
              <button
                className="btn btn-sm"
                type="button"
                onClick={toggleSpeaking}
                disabled={submitting || speechSegments.length === 0}
              >
                {speechActive ? '⏸ Duraklat' : speechIndex >= 0 ? '▶ Devam et' : '🔊 Sesli dinle'}
              </button>
              {(speechActive || speechIndex >= 0) && (
                <button className="btn btn-sm" type="button" onClick={stopSpeaking}>
                  ■ Durdur
                </button>
              )}
              {speechSupported() && (
                <span className="reading-rate-control">
                  <button
                    className="btn btn-sm"
                    type="button"
                    aria-label="Okuma hızını azalt"
                    disabled={speechRate <= SPEECH_RATE_MIN}
                    onClick={() => changeRate(-SPEECH_RATE_STEP)}
                  >
                    A−
                  </button>
                  <span className="small muted" aria-live="polite">
                    Hız {formatRate(speechRate)}
                  </span>
                  <button
                    className="btn btn-sm"
                    type="button"
                    aria-label="Okuma hızını artır"
                    disabled={speechRate >= SPEECH_RATE_MAX}
                    onClick={() => changeRate(SPEECH_RATE_STEP)}
                  >
                    A+
                  </button>
                </span>
              )}
              <span className="small muted">
                {speechNotice ||
                  (speechIndex >= 0
                    ? `${speechIndex + 1}/${speechSegments.length} parça okunuyor — dinlemek okuma kanıtını değiştirmez.`
                    : 'Metni Türkçe sesli dinleyebilirsiniz; süre, kaydırma ve quiz koşulları aynı kalır.')}
              </span>
            </div>
            <div
              ref={bodyRef}
              className={`reading-body no-copy ${splitLayout ? 'reading-body-split' : 'reading-body-solo'}`}
              onScroll={handleScroll}
              onCopy={(event) => event.preventDefault()}
            >
              {reading.image ? (
                <img className="reading-image" src={reading.image} alt={`${reading.title} görseli`} />
              ) : null}
              {/* Parçalar orijinal metnin birebir birleşimidir (satır sonları korunur). */}
              {speechSegments.map((segment, index) => (
                <span
                  key={index}
                  className={index === speechIndex && speechActive ? 'reading-segment-active' : undefined}
                >
                  {segment}
                </span>
              ))}
            </div>
            <p className="small muted mt-8">
              Metni sonuna kadar kaydırın ve {required} sn okuma süresini doldurun. Kopyalama kapalıdır; bu istemci
              sinyalleri göz-temasını kanıtlamaz.
            </p>
          </div>
        )}

        <div className="reading-quiz-column">
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
      ) : !gates.dwellOk ? (
        <div className="card mt-16">
          <div className="submit-confirmation">
            <div className="submit-confirmation-icon">🔒</div>
            <p>
              <strong>Quiz henüz kilitli.</strong> Sorular, okuma süresi dolunca açılacak.
            </p>
            <p className="muted">
              ⏱ {dwellSeconds}/{required} sn — kalan {Math.max(0, required - dwellSeconds)} sn. Önce metni
              sonuna kadar kaydırarak okumaya devam edin.
            </p>
          </div>
        </div>
      ) : !quizStarted ? (
        <div className="card mt-16">
          <div className="submit-confirmation">
            <div className="submit-confirmation-icon">📖</div>
            <p>
              <strong>Okuma tamamlandı.</strong> Sorulara geçmeye hazır olduğunuzda başlayın.
              {reading.showPassageDuringQuiz === false
                ? ' Metin, test sırasında gizlenecek.'
                : ' Metin, test sırasında görünür kalacak.'}
            </p>
            <div className="row-actions submit-confirmation-actions">
              <button className="btn btn-success" type="button" onClick={() => setQuizStarted(true)}>
                ✅ Teste hazırım
              </button>
            </div>
          </div>
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
        </div>
      </div>

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
