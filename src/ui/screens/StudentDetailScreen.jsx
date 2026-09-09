import { useMemo } from 'react'
import { useStore, go } from '../../state/store.jsx'
import { subjectLabel, topicLabel, gradeLabel, formatDate, formatSeconds, SUBJECTS } from '../../domain/model.js'
import { aggregateStudentTopics, aggregateStudentAll } from '../../domain/scoring.js'
import { computeDeficiencies } from '../../domain/report.js'
import { ScoreBar } from '../components/ScoreBar.jsx'

export default function StudentDetailScreen({ id }) {
  const { db, settings } = useStore()
  const student = db.students.find((s) => s.id === id)

  const data = useMemo(() => {
    if (!student) return null
    const attempts = db.attempts
      .filter((a) => a.studentId === id)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    const topics = aggregateStudentTopics(attempts)
    const agg = aggregateStudentAll(attempts)
    const bySubject = SUBJECTS.map((subject) => {
      const t = topics.filter((x) => x.subject === subject)
      const correct = t.reduce((s, x) => s + x.correct, 0)
      const total = t.reduce((s, x) => s + x.total, 0)
      return { subject, topics: t, correct, total }
    }).filter((s) => s.total > 0)
    return { attempts, topics, agg, bySubject, deficiencies: computeDeficiencies(topics, settings.threshold) }
  }, [db, id, student, settings.threshold])

  if (!student || !data) {
    return (
      <div className="card empty">
        Öğrenci bulunamadı. <a href="#/ogrenciler">Öğrencilere dön</a>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-sm mb-16" onClick={() => go('/ogrenciler')}>
            ← Öğrenciler
          </button>
          <h1>{student.name}</h1>
          <div className="subtitle">
            {gradeLabel(student.grade)} • {data.attempts.length} test çözüldü • {data.agg.totalQuestions} soru
            {data.agg.totalSeconds ? ` • ⏱ toplam ${formatSeconds(data.agg.totalSeconds)}` : ''}
          </div>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => go('/testler')}>
            Test Uygula
          </button>
          <button className="btn btn-primary" onClick={() => go(`/rapor/${student.id}`)}>
            📊 Eksik Konu Raporu
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Genel Durum</h2>
        <div className="topic-row">
          <strong>Genel başarı</strong>
          <ScoreBar correct={data.agg.totalCorrect} total={data.agg.totalQuestions} width={160} />
          <span className="muted small">
            {data.agg.totalCorrect}/{data.agg.totalQuestions} doğru
          </span>
        </div>
        {data.bySubject.map((s) => (
          <div className="topic-row" key={s.subject}>
            <strong>{subjectLabel(s.subject)}</strong>
            <ScoreBar correct={s.correct} total={s.total} width={160} />
            <span className="muted small">
              {s.correct}/{s.total} doğru
            </span>
          </div>
        ))}
      </div>

      {data.bySubject.length > 0 && (
        <div className="card">
          <h2>Konu Bazlı İlerleme</h2>
          {data.bySubject.map((s) => (
            <div key={s.subject} style={{ marginBottom: 8 }}>
              <div className="small" style={{ fontWeight: 600 }}>
                {subjectLabel(s.subject)}
              </div>
              {s.topics.map((t) => {
                const weak = t.total >= 3 && t.percent < settings.threshold
                return (
                  <div className="topic-row" key={`${s.subject}-${t.topic}`}>
                    <span>
                      {topicLabel(t.topic)}{' '}
                      {weak && <span className="badge badge-danger">Eksik</span>}
                      {t.avgSeconds > 90 && (
                        <span className="badge badge-warning" title="Soru başına 90 saniyeden uzun">
                          yavaş
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      {t.avgSeconds > 0 && (
                        <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                          ⏱ {formatSeconds(t.avgSeconds)}/soru
                        </span>
                      )}
                      <ScoreBar correct={t.correct} total={t.total} width={100} />
                    </div>
                    <span className="muted small">
                      {t.correct}/{t.total}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '14px 18px 0' }}>
          <h2>Test Geçmişi</h2>
        </div>
        {data.attempts.length === 0 ? (
          <div className="empty">Henüz test çözülmedi.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Test</th>
                <th>Ders</th>
                <th>Başarı</th>
                <th>Süre</th>
                <th style={{ textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.attempts.map((a) => (
                <tr key={a.id}>
                  <td className="small">{formatDate(a.date)}</td>
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
                      <button className="btn btn-sm" onClick={() => go(`/sonuclar/${a.id}`)}>
                        İncele
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
