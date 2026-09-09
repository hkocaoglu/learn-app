// Kural tabanlı eksik-konu raporu (AI anahtarı yokken veya AI hatasında kullanılır)
import { DEFAULT_THRESHOLD, MIN_QUESTIONS_FOR_TOPIC, aggregateStudentTopics, aggregateStudentAll } from './scoring.js'
import { subjectLabel, topicLabel, formatSeconds } from './model.js'

export { MIN_QUESTIONS_FOR_TOPIC, DEFAULT_THRESHOLD }

export const computeDeficiencies = (topics, threshold = DEFAULT_THRESHOLD) => {
  return topics
    .filter((t) => t.total >= MIN_QUESTIONS_FOR_TOPIC && t.percent < threshold)
    .sort((a, b) => a.percent - b.percent)
}

// Konu ortalaması: konu başına düşen ortalama süre (sn)
const fmtAvg = (topic) => (topic.avgSeconds ? ` | ort. süre ${formatSeconds(topic.avgSeconds)}` : '')

export const buildRuleReport = (student, attempts, allTopics, options = {}) => {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  const topics = allTopics || aggregateStudentTopics(attempts, null)
  const deficiencies = computeDeficiencies(topics, threshold)
  const strengths = topics
    .filter((t) => t.total >= MIN_QUESTIONS_FOR_TOPIC && t.percent >= threshold)
    .sort((a, b) => b.percent - a.percent)
  const agg = aggregateStudentAll(attempts)

  const gradeTxt = student && student.grade ? `${student.grade}. sınıf` : ''

  let text = `${student.name} (${gradeTxt}) öğrencisinin konu bazlı değerlendirme raporu\n`
  text += `Toplam: ${topics.reduce((s, t) => s + t.total, 0)} soru çözüldü.`
  if (agg.totalSeconds) {
    text += ` Toplam süre: ${formatSeconds(agg.totalSeconds)}.`
    if (agg.totalQuestions) text += ` Soru başına ort. süre: ${formatSeconds(agg.avgSecondsPerQuestion)}.`
  }
  text += '\n\n'

  if (deficiencies.length) {
    text += 'ZAYIF KONULAR (%' + threshold + " altı, en az 3 soru çözülenler):\n"
    deficiencies.forEach((d) => {
      text += `• ${subjectLabel(d.subject)} / ${topicLabel(d.topic)}: %${d.percent} (${d.correct}/${d.total} doğru)${fmtAvg(d)}\n`
    })
  } else {
    text += 'Zayıf konu tespit edilmedi.\n'
  }

  if (strengths.length) {
    text += '\nGÜÇLÜ KONULAR:\n'
    strengths.slice(0, 5).forEach((d) => {
      text += `• ${subjectLabel(d.subject)} / ${topicLabel(d.topic)}: %${d.percent}${fmtAvg(d)}\n`
    })
  }

  if (deficiencies.length) {
    text += '\nÖNERİLER:\n'
    deficiencies.forEach((d) => {
      text += `• ${subjectLabel(d.subject)} - ${topicLabel(d.topic)} konusunda tekrar çalışılmalı, bol alıştırma yapılmalı.`
      if (d.avgSeconds && d.avgSeconds > 90) {
        text += ' Bu konuda sorulara ortalamanın üzerinde süre harcandığından, önce konu tekrarı önerilir.'
      }
      text += '\n'
    })
  }

  return text
}
