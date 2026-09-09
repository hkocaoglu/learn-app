// Puanlama, konu istatistikleri ve öğrenci raporu hesapları

export const DEFAULT_THRESHOLD = 60 // %60 altı "eksik konu"
export const MIN_QUESTIONS_FOR_TOPIC = 3 // güvenilir istatistik için asgari soru

export const scoreAttempt = (test, answers, options = {}) => {
  // answers: { questionId -> selectedIndex }
  // options.timeByQid: { questionId -> harcanan saniye }
  const timeByQid = options.timeByQid || {}
  const details = test.questions.map((q, i) => {
    const selected = answers[q.id] !== undefined ? answers[q.id] : -1
    const correct = selected === q.correctIndex
    return {
      index: i,
      question: q,
      selected,
      correct,
      topic: q.topic,
      seconds: Math.round(Number(timeByQid[q.id]) || 0)
    }
  })
  const correctCount = details.filter((d) => d.correct).length
  const totalCount = details.length
  const scorePercent = totalCount ? Math.round((correctCount / totalCount) * 100) : 0
  const totalSeconds = details.reduce((s, d) => s + d.seconds, 0)

  // Anlık konu dökümü: bu denemedeki her konu için doğru/toplam + toplam süre
  const topicMap = new Map()
  details.forEach((d) => {
    const key = `${d.question.subject}::${d.topic}`
    if (!topicMap.has(key))
      topicMap.set(key, { subject: d.question.subject, topic: d.topic, correct: 0, total: 0, seconds: 0 })
    const t = topicMap.get(key)
    t.total += 1
    t.seconds += d.seconds
    if (d.correct) t.correct += 1
  })
  const topicStats = [...topicMap.values()]

  return { details, correctCount, totalCount, scorePercent, totalSeconds, topicStats }
}

// Bir öğrencinin TÜM denemelerini birleştirerek konu bazlı istatistik üretir.
// subject key yoksa filtre uygulanmaz.
export const aggregateStudentTopics = (attempts, subjectKey = null) => {
  const map = new Map()
  attempts.forEach((a) => {
    ;(a.topicStats || []).forEach((t) => {
      if (subjectKey && t.subject !== subjectKey) return
      const key = `${t.subject}::${t.topic}`
      if (!map.has(key))
        map.set(key, { subject: t.subject, topic: t.topic, correct: 0, total: 0, seconds: 0 })
      const cur = map.get(key)
      cur.correct += t.correct
      cur.total += t.total
      cur.seconds += t.seconds || 0
    })
  })
  return [...map.values()].map((t) => ({
    ...t,
    percent: t.total ? Math.round((t.correct / t.total) * 100) : 0,
    avgSeconds: t.total ? Math.round(t.seconds / t.total) : 0
  }))
}

// Öğrencinin toplam istatistikleri (tüm dersler)
export const aggregateStudentAll = (attempts) => {
  const topics = aggregateStudentTopics(attempts, null)
  const correct = topics.reduce((s, t) => s + t.correct, 0)
  const total = topics.reduce((s, t) => s + t.total, 0)
  const seconds = topics.reduce((s, t) => s + t.seconds, 0)
  return {
    topics,
    totalCorrect: correct,
    totalQuestions: total,
    overallPercent: total ? Math.round((correct / total) * 100) : 0,
    attemptCount: attempts.length,
    totalSeconds: seconds,
    avgSecondsPerQuestion: total ? Math.round(seconds / total) : 0
  }
}

// Öğrencinin çözdüğü testlerin ortalama süresi (deneme başına ortalama, dakika/saniye cinsinden)
export const attemptDurationStats = (attempts) => {
  const withTime = attempts.filter((a) => Number(a.totalSeconds) > 0)
  const total = withTime.reduce((s, a) => s + Number(a.totalSeconds || 0), 0)
  const count = withTime.length
  const avgSec = count ? Math.round(total / count) : 0
  return {
    count,
    avgSeconds: avgSec,
    avgSecondsPerQuestion: (() => {
      const qs = withTime.reduce((s, a) => s + (a.totalCount || 0), 0)
      return qs ? Math.round(total / qs) : 0
    })()
  }
}

// Konu bazlı ders ortalamaları
export const aggregateBySubject = (attempts) => {
  const map = new Map()
  attempts.forEach((a) => {
    if (!map.has(a.subject)) map.set(a.subject, { subject: a.subject, correct: 0, total: 0 })
    const cur = map.get(a.subject)
    cur.correct += a.correctCount
    cur.total += a.totalCount
  })
  return [...map.values()].map((s) => ({ ...s, percent: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
}
