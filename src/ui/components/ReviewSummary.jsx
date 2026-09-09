import { formatSeconds, topicLabel } from '../../domain/model.js'
import { ScoreBar } from './ScoreBar.jsx'

export default function ReviewSummary({ attempt }) {
  const answers = attempt.answers || []
  const unansweredCount = answers.filter(
    (answer) => answer.selected === undefined || answer.selected === null || answer.selected < 0
  ).length
  const wrongCount = Math.max(0, attempt.totalCount - attempt.correctCount - unansweredCount)

  return (
    <section className="card review-summary-card" aria-label="Sonuç özeti">
      <div className="review-summary-score">
        <strong className="review-score-value">%{attempt.scorePercent}</strong>
        <span className="review-score-caption">
          {attempt.correctCount}/{attempt.totalCount} doğru
        </span>
        <ScoreBar correct={attempt.correctCount} total={attempt.totalCount} width={180} />
      </div>

      <div className="review-summary-body">
        <div className="review-summary-statuses">
          <span className="review-status review-status-correct">✓ {attempt.correctCount} Doğru</span>
          <span className="review-status review-status-wrong">✗ {wrongCount} Yanlış</span>
          {unansweredCount > 0 && <span className="review-status review-status-unanswered">○ {unansweredCount} Boş</span>}
          {attempt.timeUp && <span className="review-status review-status-unanswered">⏰ Süre doldu</span>}
        </div>

        <div className="review-summary-meta">
          {attempt.totalSeconds ? (
            <span>
              ⏱ Toplam süre: {formatSeconds(attempt.totalSeconds)}
              {attempt.durationMinutes ? ` / ${attempt.durationMinutes} dk sınır` : ''}
            </span>
          ) : (
            <span>Süre bilgisi yok</span>
          )}
          {attempt.totalCount > 0 && attempt.totalSeconds ? (
            <span>• Soru başına ort. {formatSeconds(Math.round(attempt.totalSeconds / attempt.totalCount))}</span>
          ) : null}
        </div>

        {attempt.topicStats?.length > 0 && (
          <div className="review-topic-summary">
            <span className="review-topic-summary-label">Konu özeti</span>
            <div className="review-topic-chips">
              {attempt.topicStats.map((topic) => (
                <span className="badge badge-topic" key={`${topic.subject || ''}-${topic.topic}`}>
                  {topicLabel(topic.topic)}: {topic.correct}/{topic.total}
                  {topic.seconds ? ` • ort ${formatSeconds(Math.round(topic.seconds / topic.total))}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
