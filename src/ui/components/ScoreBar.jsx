import { percent } from '../../domain/model.js'

export function ScoreBar({ correct, total, width }) {
  const p = percent(correct, total)
  const cls = p >= 70 ? 'good' : p >= 50 ? 'mid' : 'bad'
  return (
    <div className="pill">
      <div className="score-bar" style={{ width: width || 90 }}>
        <div className={`score-bar-fill ${cls}`} style={{ width: `${p}%` }} />
      </div>
      <span className="score-label">%{p}</span>
    </div>
  )
}
