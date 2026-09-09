import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore, go } from '../../state/store.jsx'
import { subjectLabel, topicLabel, gradeLabel, formatDate, formatSeconds, SUBJECTS } from '../../domain/model.js'
import { aggregateStudentTopics, aggregateStudentAll, aggregateBySubject, attemptDurationStats } from '../../domain/scoring.js'
import { computeDeficiencies, buildRuleReport, MIN_QUESTIONS_FOR_TOPIC } from '../../domain/report.js'
import { createAIClient } from '../../ai/client.js'
import { ScoreBar } from '../components/ScoreBar.jsx'

export default function ReportsScreen({ studentId: routeStudentId }) {
  const { db, settings, actions } = useStore()
  const { isAdmin } = useAuth()
  const [studentId, setStudentId] = useState(routeStudentId || '')
  const [reportFor, setReportFor] = useState(null) // { rule, ai, aiLoading, aiError, date }
  const [subjectFilter, setSubjectFilter] = useState('')

  // route değişince (örn. #/raporlar -> #/rapor/ID) seçili öğrenciyi senkronla
  useEffect(() => {
    if (routeStudentId) {
      setStudentId(routeStudentId)
      setReportFor(null)
    }
  }, [routeStudentId])

  const student = db.students.find((s) => s.id === studentId) || null
  const reports = student ? db.aiReports[student.id] || [] : []

  const stats = useMemo(() => {
    if (!student) return null
    const attempts = db.attempts.filter((a) => a.studentId === student.id)
    const allTopics = aggregateStudentTopics(attempts)
    const bySubject = SUBJECTS.map((subject) => {
      const t = allTopics.filter((x) => x.subject === subject)
      const correct = t.reduce((s, x) => s + x.correct, 0)
      const total = t.reduce((s, x) => s + x.total, 0)
      return { subject, topics: t, correct, total }
    }).filter((s) => s.total > 0)
    const agg = aggregateStudentAll(attempts)
    const subjectAgg = aggregateBySubject(attempts)
    const durations = attemptDurationStats(attempts)
    return { attempts, allTopics, bySubject, agg, subjectAgg, durations }
  }, [db.attempts, student])

  const generateRuleReport = () => {
    if (!student || !stats) return
    const text = buildRuleReport(student, stats.attempts, stats.allTopics, { threshold: settings.threshold })
    setReportFor({ rule: text, ai: '', aiLoading: false, aiError: '', date: new Date().toISOString() })
  }

  const generateAiReport = async () => {
    if (!student || !stats) return
    setReportFor((p) => ({ ...p, aiLoading: true, aiError: '', ai: '' }))
    const cfg = settings.ai
    const client = createAIClient(cfg)
    const ctx = {
      studentName: student.name,
      grade: student.grade,
      threshold: settings.threshold,
      reportDate: new Date().toISOString(),
      subjectStats: stats.allTopics
        .filter((t) => t.total >= 1)
        .map((t) => ({
          subject: t.subject,
          topic: t.topic,
          correct: t.correct,
          total: t.total,
          percent: t.percent,
          avgSeconds: t.avgSeconds
        }))
    }
    const res = await client.generateReport(ctx)
    if (res.ok) {
      actions.saveAiReport(student.id, res.text)
      setReportFor((p) => ({ ...p, aiLoading: false, ai: res.text }))
    } else {
      setReportFor((p) => ({ ...p, aiLoading: false, aiError: res.error }))
    }
  }

  if (!student || !stats) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Raporlar</h1>
            <div className="subtitle">Öğrencinin tüm test sonuçları birleştirilerek konu bazlı eksik analizi çıkarılır.</div>
          </div>
        </div>
        <div className="card">
          <h2>Öğrenci Seçin</h2>
          {db.students.length === 0 ? (
            <div className="empty">
              Henüz öğrenci yok. <a href="#/ogrenciler">Öğrenci ekleyin</a>
            </div>
          ) : (
            <div className="grid-cards">
              {db.students.map((s) => (
                <div key={s.id} className="grid-card" onClick={() => go(`/rapor/${s.id}`)}>
                  <h3>{s.name}</h3>
                  <div className="muted small">{gradeLabel(s.grade)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const deficiencies = computeDeficiencies(stats.allTopics, settings.threshold)
  const selectSubjectTopics = stats.allTopics.filter((t) => !subjectFilter || t.subject === subjectFilter)

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-sm mb-16" onClick={() => go('/raporlar')}>
            ← Öğrenci Listesi
          </button>
          <h1>
            {student.name} <span className="badge badge-grade">{gradeLabel(student.grade)}</span>
          </h1>
          <div className="subtitle">
            {stats.attempts.length} test, {stats.agg.totalQuestions} soru çözüldü.
          </div>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => window.print()}>
            🖨 Yazdır / PDF
          </button>
        </div>
      </div>

      <div className="no-print filter-bar card">
        <div>
          <label>Öğrenci Değiştir</label>
          <select value={student.id} onChange={(e) => { setStudentId(e.target.value); setReportFor(null) }}>
            {db.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={generateRuleReport}>
          📄 Kural Tabanlı Rapor Oluştur
        </button>
        <button className="btn btn-success" onClick={generateAiReport} disabled={reportFor?.aiLoading}>
          🤖 AI ile Derin Analiz {reportFor?.aiLoading ? '…' : ''}
        </button>
      </div>

      {stats.attempts.length === 0 && (
        <div className="alert alert-warning">
          Bu öğrencinin henüz test sonucu yok. Önce <a href="#/testler">bir test uygulayın</a>.
        </div>
      )}

      {/* Süre özeti */}
      {stats.agg.totalSeconds > 0 && (
        <div className="card">
          <h2>⏱ Süre İstatistikleri</h2>
          <div className="topic-row" style={{ borderBottom: 'none' }}>
            <span>
              <strong>Toplam çözüm süresi</strong>
            </span>
            <span style={{ textAlign: 'right' }}>{formatSeconds(stats.agg.totalSeconds)}</span>
          </div>
          <div className="topic-row" style={{ borderBottom: 'none' }}>
            <span>
              <strong>Soru başına ortalama süre</strong> <span className="muted small">(tüm sorular)</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              {formatSeconds(stats.agg.avgSecondsPerQuestion)}
            </span>
          </div>
          <div className="topic-row" style={{ borderBottom: 'none' }}>
            <span>
              <strong>Test başına ortalama süre</strong>{' '}
              <span className="muted small">
                (süresi ölçülen {stats.durations.count}/{stats.attempts.length} test)
              </span>
            </span>
            <span style={{ textAlign: 'right' }}>
              {stats.durations.count ? formatSeconds(stats.durations.avgSeconds) : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Konu bazlı tablo */}
      <div className="card">
        <h2>Konu Bazlı Performans</h2>
        <div className="no-print small muted mt-8" style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={subjectFilter !== ''}
              onChange={(e) => setSubjectFilter(e.target.checked ? 'matematik' : '')}
              style={{ width: 'auto' }}
            />
            Sadece ders filtrele (Matematik)
          </label>
        </div>
        {selectSubjectTopics.length === 0 ? (
          <div className="empty small">Henüz veri yok.</div>
        ) : (
          selectSubjectTopics.map((t) => {
            const weak = t.total >= MIN_QUESTIONS_FOR_TOPIC && t.percent < settings.threshold
            const slow = t.avgSeconds > 90
            return (
              <div className="topic-row" key={`${t.subject}-${t.topic}`}>
                <span>
                  <strong>{subjectLabel(t.subject)}</strong> / {topicLabel(t.topic)}{' '}
                  {t.total < MIN_QUESTIONS_FOR_TOPIC && <span className="badge badge-grade">az veri</span>}
                  {weak && <span className="badge badge-danger">Eksik</span>}
                  {!weak && t.total >= MIN_QUESTIONS_FOR_TOPIC && t.percent >= settings.threshold && (
                    <span className="badge badge-success">Yeterli</span>
                  )}
                  {slow && (
                    <span className="badge badge-warning" title="Soru başına 90 saniyeden uzun">
                      yavaş
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {t.avgSeconds > 0 && (
                    <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                      ⏱ ort {formatSeconds(t.avgSeconds)}
                    </span>
                  )}
                  <ScoreBar correct={t.correct} total={t.total} width={110} />
                </div>
                <span className="muted small">
                  {t.correct}/{t.total} ({t.percent}%)
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Kural raporu / AI raporu */}
      {reportFor && (
        <>
          {reportFor.rule && (
            <div className="card print-only" style={{ display: 'block' }}>
              <div className="print-only" style={{ marginBottom: 16 }}>
                <h1 style={{ fontSize: '1.4rem' }}>Eksik Konu Raporu — {student.name}</h1>
                <div className="muted small">Tarih: {formatDate(reportFor.date)}</div>
              </div>
            </div>
          )}
          {reportFor.rule && (
            <div className="card">
              <h2>Eksik Konu Raporu (Kural Tabanlı)</h2>
              <div className="muted small mb-16">
                Eşik: %{settings.threshold} altı ve en az {MIN_QUESTIONS_FOR_TOPIC} soru çözülen konular zayıf kabul
                edilir. Süre bilgisi olan konularda soru başına ortalama süre de yazılır.
              </div>
              <div className="report-text">{reportFor.rule}</div>
            </div>
          )}
          {reportFor.aiLoading && (
            <div className="card">
              <h2>🤖 AI Analizi</h2>
              <div className="alert alert-info">AI raporu üretiliyor, lütfen bekleyin…</div>
            </div>
          )}
          {reportFor.aiError && (
            <div className="card">
              <h2>🤖 AI Analizi</h2>
              <div className="alert alert-warning">
                <strong>AI raporu oluşturulamadı:</strong> {reportFor.aiError}
                <div className="small mt-8">
                  {isAdmin ? (
                    <>
                      Kural tabanlı rapor geçerlidir. AI kullanmak için{' '}
                      <a href="#/ayarlar">Admin Ayarları &gt; AI</a> bölümünden geçerli bir API anahtarı tanımlayın.
                    </>
                  ) : (
                    'Kural tabanlı rapor geçerlidir. AI yapılandırması admin hesabı tarafından yönetilir.'
                  )}
                </div>
              </div>
            </div>
          )}
          {reportFor.ai && (
            <div className="card">
              <h2>🤖 AI Analizi</h2>
              <div className="report-text">{reportFor.ai}</div>
            </div>
          )}
        </>
      )}

      {/* Geçmiş AI raporları */}
      {reports.length > 0 && (
        <div className="card">
          <h2>Geçmiş AI Raporları</h2>
          {reports.map((r) => (
            <details key={r.id} style={{ marginBottom: 8 }}>
              <summary className="small" style={{ cursor: 'pointer' }}>
                {formatDate(r.date)}
              </summary>
              <div className="report-text mt-8">{r.text}</div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
