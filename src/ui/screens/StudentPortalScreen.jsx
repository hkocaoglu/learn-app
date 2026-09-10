import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { fetchCurrentStudent, fetchStudentAssignments } from '../../cloud/assignments.js'
import { fetchStudentReadings } from '../../cloud/readings.js'
import { gradeLabel, subjectLabel, formatDate, formatMinutesShort } from '../../domain/model.js'
import StudentExamScreen from './StudentExamScreen.jsx'
import StudentReadingScreen from './StudentReadingScreen.jsx'

const readAssignmentRoute = () => {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'ogrenci-okuma') return { kind: 'reading', id: parts[1] || '' }
  if (parts[0] === 'ogrenci-sinav') return { kind: 'exam', id: parts[1] || '' }
  return { kind: '', id: '' }
}

export default function StudentPortalScreen() {
  const [student, setStudent] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [readings, setReadings] = useState([])
  const [route, setRoute] = useState(readAssignmentRoute)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signOutError, setSignOutError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const currentStudent = await fetchCurrentStudent()
      const [nextAssignments, nextReadings] = await Promise.all([
        fetchStudentAssignments(currentStudent.id),
        fetchStudentReadings(currentStudent.id).catch(() => [])
      ])
      setStudent(currentStudent)
      setAssignments(nextAssignments)
      setReadings(nextReadings)
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const onHashChange = () => setRoute(readAssignmentRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [load])

  const handleSignOut = async () => {
    setSignOutError('')
    const result = await signOut()
    if (result.error) setSignOutError(`Çıkış yapılamadı: ${result.error.message}`)
  }

  const goToPortal = async () => {
    window.location.hash = '#/'
    await load()
  }

  if (route.id && student) {
    if (route.kind === 'reading') {
      const readingAssignment = readings.find((item) => item.id === route.id)
      if (!readingAssignment) {
        return (
          <StudentShell user={user} onSignOut={handleSignOut} signOutError={signOutError}>
            <div className="card empty">
              <p>Bu okuma ödevi bulunamadı veya erişim süresi doldu.</p>
              <button className="btn btn-primary" type="button" onClick={goToPortal}>
                Atanan içeriklere dön
              </button>
            </div>
          </StudentShell>
        )
      }
      return (
        <StudentShell user={user} onSignOut={handleSignOut} signOutError={signOutError}>
          <StudentReadingScreen
            key={readingAssignment.id}
            student={student}
            readingAssignment={readingAssignment}
            onBack={goToPortal}
          />
        </StudentShell>
      )
    }
    const assignment = assignments.find((item) => item.id === route.id)
    if (!assignment) {
      return (
        <StudentShell user={user} onSignOut={handleSignOut} signOutError={signOutError}>
          <div className="card empty">
            <p>Bu test ataması bulunamadı veya erişim süresi doldu.</p>
            <button className="btn btn-primary" type="button" onClick={goToPortal}>
              Atanan testlere dön
            </button>
          </div>
        </StudentShell>
      )
    }

    return (
      <StudentShell user={user} onSignOut={handleSignOut} signOutError={signOutError}>
        <StudentExamScreen
          key={assignment.id}
          student={student}
          assignment={assignment}
          onBack={goToPortal}
        />
      </StudentShell>
    )
  }

  return (
    <StudentShell user={user} onSignOut={handleSignOut} signOutError={signOutError}>
      <div className="student-portal-head">
        <div>
          <div className="eyebrow">ÖĞRENCİ PORTALI</div>
          <h1>Merhaba, {student?.firstName || 'öğrenci'}!</h1>
          <p className="subtitle">
            {student ? `${student.schoolNumber} • Atanan testlerin burada görünür.` : 'Atanan testlerin burada görünür.'}
          </p>
        </div>
        <button className="btn btn-sm" type="button" onClick={load} disabled={loading}>
          {loading ? 'Yükleniyor…' : '↻ Yenile'}
        </button>
      </div>

      {loading ? (
        <div className="card empty">Öğrenci bilgileri ve testler yükleniyor…</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <>
          {assignments.length === 0 ? (
            <div className="card empty">
              Henüz size atanmış bir test yok. Öğretmeniniz testi yayınladığında burada görünecek.
            </div>
          ) : (
            <div className="student-assignment-list">
              {assignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}
          <div className="section-heading mt-16">
            <h2>Okuma Ödevleri</h2>
          </div>
          {readings.length === 0 ? (
            <div className="card empty">Henüz size atanmış bir okuma yok.</div>
          ) : (
            <div className="student-assignment-list">
              {readings.map((item) => (
                <ReadingCard key={item.id} readingAssignment={item} />
              ))}
            </div>
          )}
        </>
      )}
    </StudentShell>
  )
}

function AssignmentCard({ assignment }) {
  const attempt = assignment.attempt
  const canStart = Boolean(assignment.available && assignment.test && !attempt)
  const status = attempt
    ? `Tamamlandı • %${attempt.score_percent}`
    : assignment.available
      ? 'Çözmeye hazır'
      : assignment.endsAt && new Date(assignment.endsAt).getTime() < Date.now()
        ? 'Süre doldu'
        : 'Henüz başlamadı'

  return (
    <article className="student-assignment-card">
      <div className="student-assignment-main">
        <div className="student-assignment-icon" aria-hidden="true">
          📝
        </div>
        <div>
          <h2>{assignment.test?.title || 'Test'}</h2>
          <div className="student-assignment-meta">
            <span className="badge badge-grade">{assignment.test ? gradeLabel(assignment.test.grade) : '—'}</span>
            <span className="badge badge-subject">{assignment.test ? subjectLabel(assignment.test.subject) : '—'}</span>
            {assignment.test?.durationMinutes && (
              <span className="badge badge-warning">{formatMinutesShort(assignment.test.durationMinutes)}</span>
            )}
          </div>
          <p className="small muted">
            Başlangıç: {assignment.startsAt ? formatDate(assignment.startsAt) : 'Hemen'} • Bitiş:{' '}
            {assignment.endsAt ? formatDate(assignment.endsAt) : 'Süresiz'}
          </p>
        </div>
      </div>
      <div className="student-assignment-action">
        <span className={`badge ${attempt ? 'badge-success' : assignment.available ? 'badge-primary' : 'badge-warning'}`}>
          {status}
        </span>
        {canStart ? (
          <a className="btn btn-primary" href={`#/ogrenci-sinav/${assignment.id}`}>
            Sınava başla
          </a>
        ) : attempt ? (
          <span className="small muted">
            {attempt.correct_count}/{attempt.total_count} doğru
          </span>
        ) : (
          <span className="small muted">Öğretmeninizden bilgi alın</span>
        )}
      </div>
    </article>
  )
}

function ReadingCard({ readingAssignment }) {
  const reading = readingAssignment.reading
  const attempt = readingAssignment.attempt
  const canStart = Boolean(readingAssignment.available && reading && !attempt)
  const status = attempt
    ? attempt.read
      ? `Tamamlandı • %${attempt.score_percent}`
      : `Tamamlanmadı • %${attempt.score_percent}`
    : readingAssignment.available
      ? 'Okumaya hazır'
      : readingAssignment.endsAt && new Date(readingAssignment.endsAt).getTime() < Date.now()
        ? 'Süre doldu'
        : 'Henüz başlamadı'

  return (
    <article className="student-assignment-card">
      <div className="student-assignment-main">
        <div className="student-assignment-icon" aria-hidden="true">
          📖
        </div>
        <div>
          <h2>{reading?.title || 'Okuma'}</h2>
          <div className="student-assignment-meta">
            <span className="badge badge-grade">{reading ? gradeLabel(reading.grade) : '—'}</span>
            <span className="badge badge-subject">{reading ? subjectLabel(reading.subject) : '—'}</span>
            <span className="badge badge-topic">{reading?.questions?.length || 0} soru</span>
          </div>
          <p className="small muted">
            Başlangıç: {readingAssignment.startsAt ? formatDate(readingAssignment.startsAt) : 'Hemen'} • Bitiş:{' '}
            {readingAssignment.endsAt ? formatDate(readingAssignment.endsAt) : 'Süresiz'}
          </p>
        </div>
      </div>
      <div className="student-assignment-action">
        <span className={`badge ${attempt?.read ? 'badge-success' : readingAssignment.available ? 'badge-primary' : 'badge-warning'}`}>
          {status}
        </span>
        {canStart ? (
          <a className="btn btn-primary" href={`#/ogrenci-okuma/${readingAssignment.id}`}>
            Başla • {reading?.title}
          </a>
        ) : attempt ? (
          <span className="small muted">
            {attempt.read ? 'Okundu ✓' : 'Okunmadı'}
          </span>
        ) : (
          <span className="small muted">Öğretmeninizden bilgi alın</span>
        )}
      </div>
    </article>
  )
}

function StudentShell({ user, onSignOut, signOutError, children }) {
  return (
    <div className="student-shell">
      <header className="student-topnav">
        <span className="brand">🎓 Sınıf Test</span>
        <div className="student-account">
          <span className="account-email" title={user?.email}>
            Öğrenci
          </span>
          <button className="btn btn-sm" type="button" onClick={onSignOut}>
            Çıkış
          </button>
        </div>
      </header>
      <main className="student-content">
        {signOutError && <div className="alert alert-error">{signOutError}</div>}
        {children}
      </main>
      <footer className="app-footer">Cevaplarınız ve sonuçlarınız güvenli şekilde kaydedilir.</footer>
    </div>
  )
}
