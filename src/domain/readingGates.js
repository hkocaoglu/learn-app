// Okuma kanıt kapıları — saf mantık.
//
// Bu modül `cloud/readings.js` (bulut gönderimi) ve `scripts/verify.mjs` (Node testi)
// tarafından paylaşılır: kapı kuralı tek yerde durur, test gerçek kodu çalıştırır.
//
// Kapılar:
//   static → dwell (yeterli süre) + scroll (metnin sonuna kadar) + quiz (eşik)
//   rsvp   → akış (kelime akışının sonuna kadar izlenmesi) + quiz (eşik)
import { requiredDwellSeconds } from './model.js'
import { scoreAttempt } from './scoring.js'

const emptyScored = () => ({
  correctCount: 0,
  totalCount: 0,
  scorePercent: 100,
  details: [],
  totalSeconds: 0,
  topicStats: []
})

export const evaluateReadingGates = ({
  reading,
  answers,
  dwellSeconds,
  scrolledBottom,
  flowCompleted
}) => {
  const rsvp = reading?.displayMode === 'rsvp'
  const required = requiredDwellSeconds(reading)
  // Akış modunda kanıt süre değil tamamlanmadır: metin hızı öğretmen tarafından
  // belirlendiği için requiredDwellSeconds formülü anlamsızdır.
  const flowOk = rsvp ? flowCompleted === true : true
  const dwellOk = rsvp ? flowOk : Number(dwellSeconds) >= required
  const scrollOk = rsvp ? flowOk : scrolledBottom === true

  const questions = Array.isArray(reading?.questions) ? reading.questions : []
  const scored =
    questions.length === 0
      ? emptyScored()
      : scoreAttempt(
          { title: reading.title, grade: reading.grade, subject: reading.subject, questions },
          answers || {}
        )
  const threshold = Number(reading?.quizThreshold ?? 60)
  const quizOk = questions.length === 0 ? true : scored.scorePercent >= threshold

  return { required, rsvp, flowOk, dwellOk, scrollOk, quizOk, scored, read: dwellOk && scrollOk && quizOk }
}
