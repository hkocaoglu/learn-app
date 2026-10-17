import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchClasses } from '../../cloud/classes.js'
import { fetchClassTracking } from '../../cloud/tracking.js'
import { buildTrackingMatrix } from '../../domain/tracking.js'
import { subjectLabel, gradeLabel, formatDate } from '../../domain/model.js'

// Öğrenci × okuma/test matrisi: kim neyi yaptı, kim neyi yapmadı.
const TABS = [
  { id: 'reading', label: '📖 Okumalar', emptyHint: 'Bu sınıfa atanmış okuma yok. "Okuma Ata" ekranından ekleyebilirsiniz.' },
  { id: 'exam', label: '📝 Testler', emptyHint: 'Bu sınıfa atanmış test yok. "Test Atama" ekranından ekleyebilirsiniz.' }
]

const STATUS_META = {
  done: { icon: '✓', className: 'track-done', label: 'Yapıldı' },
  incomplete: { icon: '⚠', className: 'track-incomplete', label: 'Denendi, tamamlanmadı' },
  missed: { icon: '✗', className: 'track-missed', label: 'Yapılmadı' },
  upcoming: { icon: '⏳', className: 'track-pending', label: 'Henüz başlamadı' },
  expired: { icon: '⌛', className: 'track-pending', label: 'Süresi doldu' }
}

export default function TrackingScreen() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [tab, setTab] = useState('reading')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (targetClassId) => {
    setLoading(true)
    setError('')
    try {
      const classList = await fetchClasses()
      setClasses(classList)
      const activeId = targetClassId || classList[0]?.id || ''
      setClassId(activeId)
      setData(activeId ? await fetchClassTracking(activeId) : null)
    } catch (caughtError) {
      setError(caughtError.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const items = useMemo(() => {
    if (!data) return []
    return tab === 'reading' ? data.readings : data.exams
  }, [data, tab])

  const attempts = useMemo(() => {
    if (!data) return []
    return tab === 'reading' ? data.readingAttempts : data.examAttempts
  }, [data, tab])

  const matrix = useMemo(
    () => buildTrackingMatrix({ students: data?.students || [], items, attempts, kind: tab }),
    [data, items, attempts, tab]
  )

  const activeTab = TABS.find((item) => item.id === tab)
  const problems = matrix.itemStats.filter((stat) => stat.missingStudents.length > 0 || stat.incompleteStudents.length > 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">TAKİP</div>
          <h1>📊 Öğrenci Takibi</h1>
          <p className="subtitle">Kim hangi okumayı tamamladı, hangi testi çözdü — sınıf bazında tek bakışta.</p>
        </div>
        <div className="row-actions">
          <button className="btn btn-sm" type="button" onClick={() => load(classId)} disabled={loading}>
            {loading ? 'Yükleniyor…' : '↻ Yenile'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="inline-form">
          <div>
            <label htmlFor="tracking-class">Sınıf</label>
            <select
              id="tracking-class"
              value={classId}
              onChange={(event) => load(event.target.value)}
              disabled={loading || classes.length === 0}
            >
              {classes.length === 0 && <option value="">Sınıf yok</option>}
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {gradeLabel(item.grade)}
                </option>
              ))}
            </select>
          </div>
          <div className="row-actions">
            {TABS.map((item) => (
              <button
                key={item.id}
                className={`btn btn-sm ${tab === item.id ? 'btn-primary' : ''}`}
                type="button"
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {!loading && data && (
          <div className="row-actions mt-16" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-primary">
              Tamamlanma %{matrix.totals.percent} ({matrix.totals.done}/{matrix.totals.cells})
            </span>
            <span className="badge badge-muted">{matrix.totals.students} öğrenci</span>
            <span className="badge badge-muted">{matrix.totals.items} {tab === 'reading' ? 'okuma' : 'test'}</span>
            <span className="badge badge-danger">Eksik: {problems.length} {tab === 'reading' ? 'okuma' : 'test'}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card empty">Takip verisi yükleniyor…</div>
      ) : !data || matrix.totals.students === 0 ? (
        <div className="card empty">Bu sınıfta aktif öğrenci yok.</div>
      ) : matrix.totals.items === 0 ? (
        <div className="card empty">{activeTab?.emptyHint}</div>
      ) : (
        <>
          <div className="section-heading">
            <h2>Matris</h2>
            <span className="small muted">
              ✓ yapıldı · ⚠ tamamlanmadı · ✗ yapılmadı · ⏳ başlamadı · ⌛ süresi doldu
            </span>
          </div>
          <div className="tracking-wrap">
            <table className="tracking-table">
              <thead>
                <tr>
                  <th className="tracking-sticky">Öğrenci</th>
                  {matrix.itemStats.map((stat) => (
                    <th key={stat.item.id} title={stat.item.title}>
                      <span className="tracking-col-title">{stat.item.title}</span>
                      <span className="tracking-col-sub">
                        {stat.item.subject ? subjectLabel(stat.item.subject) : ''} %{stat.percent}
                      </span>
                    </th>
                  ))}
                  <th className="tracking-total-col">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.student.id}>
                    <td className="tracking-sticky">
                      <strong>{row.student.name}</strong>
                      <span className="small muted"> {row.student.schoolNumber}</span>
                    </td>
                    {row.cells.map((cell) => {
                      const meta = STATUS_META[cell.status] || STATUS_META.missed
                      return (
                        <td
                          key={`${row.student.id}-${cell.itemId}`}
                          className={`track-cell ${meta.className}`}
                          title={`${meta.label}${cell.scorePercent != null ? ` • %${cell.scorePercent}` : ''}${
                            cell.date ? ` • ${formatDate(cell.date)}` : ''
                          }`}
                        >
                          {meta.icon}
                        </td>
                      )
                    })}
                    <td className="tracking-total-col">
                      <strong>
                        {row.done}/{row.total}
                      </strong>
                      <span className="small muted"> %{row.percent}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-heading mt-16">
            <h2>Eksikler — kim neyi yapmadı</h2>
            <span className="small muted">{problems.length} kalem</span>
          </div>
          {problems.length === 0 ? (
            <div className="card empty">Herkes her şeyi tamamlamış. 🎉</div>
          ) : (
            <div className="tracking-problems">
              {problems.map((stat) => (
                <div key={stat.item.id} className="card tracking-problem">
                  <div className="row-actions" style={{ justifyContent: 'space-between' }}>
                    <strong>{stat.item.title}</strong>
                    <span className="small muted">
                      {stat.item.subject ? `${subjectLabel(stat.item.subject)} • ` : ''}%{stat.percent} tamamlandı
                    </span>
                  </div>
                  {stat.missingStudents.length > 0 && (
                    <div className="small mt-8">
                      <span className="badge badge-danger">✗ Yapmadı ({stat.missingStudents.length})</span>{' '}
                      {stat.missingStudents.map((student) => student.name).join(', ')}
                    </div>
                  )}
                  {stat.incompleteStudents.length > 0 && (
                    <div className="small mt-8">
                      <span className="badge badge-warning">⚠ Tamamlamadı ({stat.incompleteStudents.length})</span>{' '}
                      {stat.incompleteStudents.map((student) => student.name).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
