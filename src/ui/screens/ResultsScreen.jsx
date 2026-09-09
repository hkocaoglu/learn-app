import { useMemo, useState } from 'react'
import { useStore, go } from '../../state/store.jsx'
import { subjectLabel, formatDate, gradeLabel, formatSeconds } from '../../domain/model.js'
import { ScoreBar } from '../components/ScoreBar.jsx'
import ReviewQuestion from '../components/ReviewQuestion.jsx'
import ReviewSummary from '../components/ReviewSummary.jsx'

export default function ResultsScreen({ attemptId: routeAttemptId }) {
  const { db, actions } = useStore()
  const [subjectFilter, setSubjectFilter] = useState('')
  const [actionError, setActionError] = useState('')
  const attemptId = routeAttemptId || null

  const studentName = (id) => db.students.find((s) => s.id === id)?.name || '(silinmiş öğrenci)'

  const deleteResult = async (id) => {
    setActionError('')
    try {
      await actions.deleteAttempt(id)
      return true
    } catch (caughtError) {
      setActionError(caughtError.message)
      return false
    }
  }

  const rows = useMemo(() => {
    return db.attempts
      .filter((a) => !subjectFilter || a.subject === subjectFilter)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [db.attempts, subjectFilter])

  if (attemptId) {
    const attempt = db.attempts.find((a) => a.id === attemptId)
    if (!attempt) {
      return (
        <div className="card empty">
          Sonuç bulunamadı. <a href="#/sonuclar">Sonuçlara dön</a>
        </div>
      )
    }
    return (
      <AttemptDetail
        attempt={attempt}
        studentName={studentName(attempt.studentId)}
        actionError={actionError}
        onBack={() => go('/sonuclar')}
        onDelete={async () => {
          if (await deleteResult(attempt.id)) go('/sonuclar')
        }}
      />
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sonuçlar</h1>
          <div className="subtitle">Çözülen tüm testlerin öğrenci bazlı kayıtları.</div>
        </div>
        {actionError && <div className="alert alert-error">{actionError}</div>}
      </div>

      <div className="filter-bar card">
        <div>
          <label>Ders Filtresi</label>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">Tüm Dersler</option>
            {['matematik', 'geometri', 'turkce'].map((s) => (
              <option key={s} value={s}>
                {subjectLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="muted small" style={{ alignSelf: 'flex-end', paddingBottom: 6 }}>
          {rows.length} kayıt
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card empty">
          Henüz test sonucu yok. <a href="#/testler">Bir test uygulayın</a>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Öğrenci</th>
                <th>Test</th>
                <th>Ders</th>
                <th>Sonuç</th>
                <th>Süre</th>
                <th style={{ textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => go(`/sonuclar/${a.id}`)}>
                  <td className="small">{formatDate(a.date)}</td>
                  <td>
                    <span
                      className="student-name-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        go(`/ogrenci/${a.studentId}`)
                      }}
                    >
                      {studentName(a.studentId)}
                    </span>
                  </td>
                  <td>{a.testTitle}</td>
                  <td>{subjectLabel(a.subject)}</td>
                  <td>
                    <ScoreBar correct={a.correctCount} total={a.totalCount} width={110} />
                  </td>
                  <td className="small">
                    {a.totalSeconds ? (
                      <>
                        {formatSeconds(a.totalSeconds)}
                        {a.timeUp && <span className="badge badge-warning" style={{ marginLeft: 6 }}>⏰</span>}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); go(`/sonuclar/${a.id}`) }}>
                        🔍 İncele
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Bu sonuç kaydı silinsin mi?')) deleteResult(a.id)
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Detay: tek sonuç incelemesi ----
function AttemptDetail({ attempt, studentName, actionError, onBack, onDelete }) {
  const questions = attempt.answers || []
  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-sm mb-16" onClick={onBack}>
            ← Sonuçlar
          </button>
          <h1>Sonuç Detayı</h1>
          <div className="subtitle">
            {studentName} • {attempt.testTitle} • {subjectLabel(attempt.subject)} • {gradeLabel(attempt.grade)} •{' '}
            {formatDate(attempt.date)}
          </div>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => window.print()}>
            🖨 Yazdır
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            Sil
          </button>
        </div>
      </div>
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <ReviewSummary attempt={attempt} />

      <div className="review-question-list">
        {questions.map((a, idx) => {
        const options = a.options || []
        const selectedIdx = typeof a.selected === 'number' ? a.selected : -1
        const correctIndex = a.correctIndex
        const isAnswered = Number.isInteger(selectedIdx) && selectedIdx >= 0 && selectedIdx < options.length
        const isCorrect = isAnswered && (a.correct ?? selectedIdx === correctIndex)

          return (
            <ReviewQuestion
              key={a.questionId || idx}
              index={idx}
              questionText={a.questionText}
              image={a.image}
              topic={a.topic}
              seconds={a.seconds}
              options={options}
              correctIndex={correctIndex}
              selectedIndex={selectedIdx}
              isAnswered={isAnswered}
              isCorrect={isCorrect}
            />
          )
        })}
      </div>
    </div>
  )
}
