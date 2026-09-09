import { formatSeconds, topicLabel } from '../../domain/model.js'
import QuestionImage from './QuestionImage.jsx'

export default function ReviewQuestion({
  index,
  questionText,
  image,
  topic,
  seconds,
  options,
  correctIndex,
  selectedIndex,
  isAnswered,
  isCorrect,
  explanation
}) {
  const status = isCorrect
    ? { key: 'correct', label: '✓ Doğru' }
    : isAnswered
      ? { key: 'wrong', label: '✗ Yanlış' }
      : { key: 'unanswered', label: '○ Cevaplanmadı' }

  return (
    <article className={`review-question-card review-card-${status.key}`}>
      <div className="review-question-header">
        <div className="review-question-label">
          <span className={`review-question-index review-index-${status.key}`}>{index + 1}</span>
          <span>Soru {index + 1}</span>
        </div>
        <span className={`review-status review-status-${status.key}`}>{status.label}</span>
      </div>

      <div className="review-question-text">{questionText}</div>

      <div className="review-question-meta">
        {topic && <span className="badge badge-topic">{topicLabel(topic)}</span>}
        {seconds ? <span className="review-time">⏱ {formatSeconds(seconds)}</span> : null}
      </div>

      <div className="review-options">
        {options.map((option, optionIndex) => {
          const isCorrectOption = optionIndex === correctIndex
          const isSelectedOption = optionIndex === selectedIndex
          const optionClass = isCorrectOption ? 'is-correct' : isSelectedOption ? 'is-wrong' : ''
          const optionLabel =
            isCorrectOption && isSelectedOption
              ? '✓ Öğrencinin cevabı • Doğru cevap'
              : isCorrectOption
                ? '✓ Doğru cevap'
                : isSelectedOption
                  ? '✗ Öğrencinin cevabı'
                  : ''

          return (
            <div className={`review-option ${optionClass}`} key={optionIndex}>
              <span className="answer-letter">{String.fromCharCode(65 + optionIndex)}</span>
              <span className="review-option-text">{option}</span>
              {optionLabel && <span className="review-option-label">{optionLabel}</span>}
            </div>
          )
        })}
      </div>

      {!isAnswered && <div className="review-answer-note">○ Cevap verilmedi. Doğru cevap yeşil ile gösterildi.</div>}
      {explanation && <div className="review-explanation">💡 {explanation}</div>}
    </article>
  )
}
