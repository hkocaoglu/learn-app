import { useMemo, useState } from 'react'
import { useStore, go } from '../../state/store.jsx'
import {
  GRADES,
  SUBJECTS,
  formatDate,
  formatMinutesShort,
  formatSeconds,
  gradeLabel,
  subjectLabel,
  topicLabel
} from '../../domain/model.js'
import { aggregateStudentTopics } from '../../domain/scoring.js'
import { computeDeficiencies } from '../../domain/report.js'
import { ScoreBar } from '../components/ScoreBar.jsx'

const scorePercent = (correct, total) => (total ? Math.round((correct / total) * 100) : 0)

const studentInitials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase('tr-TR'))
    .join('')

export default function HomeScreen() {
  const { db, settings } = useStore()
  const [grade, setGrade] = useState(1)
  const [subject, setSubject] = useState('matematik')

  const threshold = Number(settings.threshold) || 60

  const dashboard = useMemo(() => {
    const attempts = [...db.attempts].sort((a, b) => (a.date < b.date ? 1 : -1))
    const studentStats = db.students.map((student) => {
      const studentAttempts = attempts.filter((attempt) => attempt.studentId === student.id)
      const totalQuestions = studentAttempts.reduce((sum, attempt) => sum + Number(attempt.totalCount || 0), 0)
      const totalCorrect = studentAttempts.reduce((sum, attempt) => sum + Number(attempt.correctCount || 0), 0)
      const topics = aggregateStudentTopics(studentAttempts)
      const deficiencies = computeDeficiencies(topics, threshold)

      return {
        ...student,
        attempts: studentAttempts.length,
        totalQuestions,
        totalCorrect,
        overallPercent: scorePercent(totalCorrect, totalQuestions),
        deficiencies
      }
    })

    const totalQuestions = attempts.reduce((sum, attempt) => sum + Number(attempt.totalCount || 0), 0)
    const totalCorrect = attempts.reduce((sum, attempt) => sum + Number(attempt.correctCount || 0), 0)
    const topics = aggregateStudentTopics(attempts)
    const attention = studentStats
      .filter((student) => student.attempts === 0 || student.overallPercent < threshold || student.deficiencies.length > 0)
      .sort((a, b) => {
        if (a.attempts === 0 && b.attempts !== 0) return -1
        if (a.attempts !== 0 && b.attempts === 0) return 1
        return a.overallPercent - b.overallPercent
      })
      .slice(0, 5)

    return {
      recentAttempts: attempts.slice(0, 5),
      attention,
      weakTopics: computeDeficiencies(topics, threshold).slice(0, 5),
      totalQuestions,
      totalCorrect,
      overallPercent: scorePercent(totalCorrect, totalQuestions)
    }
  }, [db, threshold])

  const tests = db.tests
  const filtered = tests.filter(
    (test) => test.grade === Number(grade) && test.subject === subject && test.questions.length > 0
  )
  const bankCount = db.bank.filter((question) => question.grade === Number(grade) && question.subject === subject).length

  const startTest = (id) => go(`/sinav/${id}`)
  const openEditor = (id) => go(`/test/${id}`)
  const studentName = (id) => db.students.find((student) => student.id === id)?.name || 'Silinmiş öğrenci'

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">ÖĞRETMEN PANELİ</div>
          <h1>Bugünkü sınıf durumunuz</h1>
          <div className="subtitle">Öğrenci ilerlemesini takip edin, ihtiyaç olan konuları görün ve yeni bir test başlatın.</div>
        </div>
        <div className="dashboard-actions">
          <button className="btn" onClick={() => go('/ogrenciler')}>
            + Öğrenci Ekle
          </button>
          <button className="btn btn-primary" onClick={() => go('/testler')}>
            + Test Oluştur
          </button>
        </div>
      </div>

      <div className="dashboard-kpis">
        <button className="dashboard-kpi" onClick={() => go('/ogrenciler')}>
          <span className="dashboard-kpi-icon dashboard-kpi-icon-blue">👩‍🏫</span>
          <span>
            <strong className="dashboard-kpi-value">{db.students.length}</strong>
            <span className="dashboard-kpi-label">Kayıtlı öğrenci</span>
          </span>
          <span className="dashboard-kpi-arrow">→</span>
        </button>
        <button className="dashboard-kpi" onClick={() => go('/testler')}>
          <span className="dashboard-kpi-icon dashboard-kpi-icon-purple">📝</span>
          <span>
            <strong className="dashboard-kpi-value">{db.tests.length}</strong>
            <span className="dashboard-kpi-label">Hazır test</span>
          </span>
          <span className="dashboard-kpi-arrow">→</span>
        </button>
        <button className="dashboard-kpi" onClick={() => go('/sonuclar')}>
          <span className="dashboard-kpi-icon dashboard-kpi-icon-green">✓</span>
          <span>
            <strong className="dashboard-kpi-value">{db.attempts.length}</strong>
            <span className="dashboard-kpi-label">Çözülmüş test</span>
          </span>
          <span className="dashboard-kpi-arrow">→</span>
        </button>
        <button className="dashboard-kpi" onClick={() => go(`/banka?grade=${grade}&subject=${subject}`)}>
          <span className="dashboard-kpi-icon dashboard-kpi-icon-orange">📚</span>
          <span>
            <strong className="dashboard-kpi-value">{db.bank.length}</strong>
            <span className="dashboard-kpi-label">Banka sorusu</span>
          </span>
          <span className="dashboard-kpi-arrow">→</span>
        </button>
      </div>

      <div className="dashboard-grid dashboard-grid-main">
        <section className="card dashboard-panel quick-start-panel">
          <div className="section-heading">
            <div>
              <h2>Hızlı test başlat</h2>
              <p className="muted small">Sınıf ve ders seçerek hazır testlerden birini uygulayın.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => go(`/testler?grade=${grade}&subject=${subject}`)}>
              Tüm testler →
            </button>
          </div>

          <div className="form-grid dashboard-filters">
            <div>
              <label htmlFor="dashboard-grade">Sınıf</label>
              <select id="dashboard-grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {GRADES.map((value) => (
                  <option key={value} value={value}>
                    {gradeLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dashboard-subject">Ders</label>
              <select id="dashboard-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {SUBJECTS.map((value) => (
                  <option key={value} value={value}>
                    {subjectLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty dashboard-empty">
              <strong>Bu sınıf ve ders için sorulu test yok.</strong>
              <span className="small">Yeni bir test oluşturup en az bir soru ekleyerek başlayabilirsiniz.</span>
              <button className="btn btn-primary" onClick={() => go(`/testler?grade=${grade}&subject=${subject}`)}>
                + Test Oluştur
              </button>
            </div>
          ) : (
            <div className="dashboard-test-list">
              {filtered.slice(0, 3).map((test) => (
                <div key={test.id} className="dashboard-test-row">
                  <div className="dashboard-test-info">
                    <strong>{test.title}</strong>
                    <span className="small muted">
                      {test.questions.length} soru
                      {test.durationMinutes ? ` • ${formatMinutesShort(test.durationMinutes)}` : ' • süresiz'}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => startTest(test.id)}>
                      ▶ Başlat
                    </button>
                    <button className="btn btn-sm" onClick={() => openEditor(test.id)}>
                      Düzenle
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length > 3 && (
                <button className="btn btn-ghost dashboard-more-button" onClick={() => go(`/testler?grade=${grade}&subject=${subject}`)}>
                  {filtered.length - 3} test daha göster →
                </button>
              )}
            </div>
          )}
        </section>

        <section className="card dashboard-panel">
          <div className="section-heading">
            <div>
              <h2>Konu gündemi</h2>
              <p className="muted small">En az 3 soru çözülen zayıf konular.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => go('/raporlar')}>
              Raporlar →
            </button>
          </div>

          {dashboard.weakTopics.length === 0 ? (
            <div className="dashboard-compact-empty">
              <span className="dashboard-empty-icon">✓</span>
              <strong>Henüz zayıf konu yok</strong>
              <span className="small muted">Yeterli veri oluştuğunda burada görünecek.</span>
            </div>
          ) : (
            <div className="dashboard-topic-list">
              {dashboard.weakTopics.map((topic) => (
                <div className="dashboard-topic-row" key={`${topic.subject}-${topic.topic}`}>
                  <div className="dashboard-topic-heading">
                    <strong>{topicLabel(topic.topic)}</strong>
                    <span className="badge badge-subject">{subjectLabel(topic.subject)}</span>
                  </div>
                  <div className="dashboard-topic-meta">
                    <ScoreBar correct={topic.correct} total={topic.total} width={90} />
                    <span className="small muted">
                      {topic.correct}/{topic.total}
                    </span>
                  </div>
                  {topic.avgSeconds > 90 && <span className="badge badge-warning">yavaş</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="card dashboard-panel">
          <div className="section-heading">
            <div>
              <h2>Dikkat gerektiren öğrenciler</h2>
              <p className="muted small">Takip edilmesi gereken öğrenciler ve son durumları.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => go('/ogrenciler')}>
              Tüm öğrenciler →
            </button>
          </div>

          {dashboard.attention.length === 0 ? (
            <div className="dashboard-compact-empty">
              <span className="dashboard-empty-icon">✓</span>
              <strong>Şu an dikkat gerektiren öğrenci yok</strong>
              <span className="small muted">Sonuçlar geldikçe özet burada güncellenir.</span>
            </div>
          ) : (
            <div className="dashboard-attention-list">
              {dashboard.attention.map((student) => {
                const reason =
                  student.attempts === 0
                    ? 'Henüz test çözmedi'
                    : student.deficiencies.length > 0
                      ? `${student.deficiencies.length} eksik konu`
                      : `Genel başarı %${student.overallPercent}`

                return (
                  <button className="dashboard-attention-row" key={student.id} onClick={() => go(`/ogrenci/${student.id}`)}>
                    <span className="student-avatar">{studentInitials(student.name)}</span>
                    <span className="dashboard-attention-info">
                      <strong>{student.name}</strong>
                      <span className="small muted">
                        {gradeLabel(student.grade)} • {reason}
                      </span>
                    </span>
                    {student.attempts === 0 ? (
                      <span className="badge badge-grade">Yeni</span>
                    ) : (
                      <ScoreBar correct={student.totalCorrect} total={student.totalQuestions} width={88} />
                    )}
                    <span className="dashboard-kpi-arrow">→</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="card dashboard-panel">
          <div className="section-heading">
            <div>
              <h2>Son aktiviteler</h2>
              <p className="muted small">En son tamamlanan testler.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => go('/sonuclar')}>
              Tüm sonuçlar →
            </button>
          </div>

          {dashboard.recentAttempts.length === 0 ? (
            <div className="dashboard-compact-empty">
              <span className="dashboard-empty-icon">○</span>
              <strong>Henüz sonuç yok</strong>
              <span className="small muted">İlk testi uyguladığınızda sonuç burada görünecek.</span>
              <button className="btn btn-sm btn-primary" onClick={() => go('/testler')}>
                Test başlat
              </button>
            </div>
          ) : (
            <div className="dashboard-activity-list">
              {dashboard.recentAttempts.map((attempt) => (
                <button className="dashboard-activity-row" key={attempt.id} onClick={() => go(`/sonuclar/${attempt.id}`)}>
                  <span className={`dashboard-activity-icon ${attempt.scorePercent >= threshold ? 'is-good' : 'is-low'}`}>
                    {attempt.scorePercent >= threshold ? '✓' : '!'}
                  </span>
                  <span className="dashboard-activity-info">
                    <strong>{studentName(attempt.studentId)}</strong>
                    <span className="small muted">
                      {attempt.testTitle} • {formatDate(attempt.date)}
                    </span>
                  </span>
                  <span className={`badge ${attempt.scorePercent >= threshold ? 'badge-success' : 'badge-danger'}`}>
                    %{attempt.scorePercent}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="dashboard-summary card">
        <div>
          <span className="eyebrow">GENEL ÖZET</span>
          <strong>
            {dashboard.totalQuestions ? `%${dashboard.overallPercent} genel başarı` : 'Henüz başarı verisi yok'}
          </strong>
          <span className="small muted">
            {dashboard.totalQuestions
              ? `${dashboard.totalCorrect}/${dashboard.totalQuestions} doğru cevap • ${db.attempts.length} test sonucu`
              : 'Bir test uygulayarak sınıf ilerlemesini takip etmeye başlayın.'}
          </span>
        </div>
        <div className="dashboard-summary-actions">
          <div className="dashboard-summary-stat">
            <strong>{bankCount}</strong>
            <span className="small muted">{gradeLabel(grade)} {subjectLabel(subject)} sorusu</span>
          </div>
          <button className="btn" onClick={() => go(`/banka?grade=${grade}&subject=${subject}`)}>
            Soru bankasını aç
          </button>
          <button className="btn btn-primary" onClick={() => go('/raporlar')}>
            Raporları gör
          </button>
        </div>
      </section>
    </div>
  )
}
