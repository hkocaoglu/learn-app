import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchClasses } from '../../cloud/classes.js'
import { fetchClassTracking, fetchTrackingOverview } from '../../cloud/tracking.js'
import { buildTrackingMatrix, summarizeStudents } from '../../domain/tracking.js'
import { subjectLabel, gradeLabel, formatDate } from '../../domain/model.js'

// Öğrenci × okuma/test matrisi: kim neyi yaptı, kim neyi yapmadı.
const TABS = [
  { id: 'reading', label: '📖 Okumalar', emptyHint: 'Bu sınıfa atanmış okuma yok. "Okuma Ata" ekranından ekleyebilirsiniz.' },
  { id: 'exam', label: '📝 Testler', emptyHint: 'Bu sınıfa atanmış test yok. "Test Atama" ekranından ekleyebilirsiniz.' },
  { id: 'students', label: '👥 Karşılaştır', emptyHint: '' }
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
  // Karşılaştırma sekmesi: tüm sınıfların özeti (farklı sınıflardan öğrenci seçilebilsin).
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [classFilter, setClassFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    if (tab !== 'students' || overview) return undefined
    let active = true
    setOverviewLoading(true)
    fetchTrackingOverview()
      .then((result) => {
        if (active) setOverview(result)
      })
      .catch((caughtError) => {
        if (active) setError(caughtError.message)
      })
      .finally(() => {
        if (active) setOverviewLoading(false)
      })
    return () => {
      active = false
    }
  }, [tab, overview])

  const toggleStudent = (id) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : current.length >= 6 ? current : [...current, id]
    )

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

        {tab !== 'students' && !loading && data && (
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

      {tab === 'students' ? (
        <ComparisonPanel
          overview={overview}
          loading={overviewLoading}
          error={error}
          classFilter={classFilter}
          onClassFilter={setClassFilter}
          selectedIds={selectedIds}
          onToggle={toggleStudent}
        />
      ) : loading ? (
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

// Farklı sınıflardan öğrencileri yan yana karşılaştırma paneli.
function ComparisonPanel({ overview, loading, error, classFilter, onClassFilter, selectedIds, onToggle }) {
  const summaries = useMemo(() => (overview ? summarizeStudents(overview) : []), [overview])
  if (loading) return <div className="card empty">Tüm sınıfların özeti yükleniyor…</div>
  if (error) return <div className="alert alert-error">{error}</div>
  if (!overview) return null

  const classes = overview.classes || []
  const visible = summaries.filter((item) => !classFilter || item.student.classId === classFilter)
  const selected = selectedIds
    .map((id) => summaries.find((item) => item.student.id === id))
    .filter(Boolean)

  const metrics = [
    { label: 'Okuma tamamlama', value: (item) => `${item.readingDone}/${item.readingTotal}` },
    { label: 'Test çözme', value: (item) => `${item.examDone}/${item.examTotal}` },
    { label: 'Test ortalaması', value: (item) => (item.examTotal ? `%${item.avgExamScore}` : '—') },
    { label: 'Puan bakiyesi', value: (item) => `⭐ ${item.balance}` },
    { label: 'Okul no', value: (item) => item.student.schoolNumber || '—' }
  ]

  return (
    <>
      <div className="card">
        <div className="inline-form">
          <div>
            <label htmlFor="compare-class">Sınıf</label>
            <select id="compare-class" value={classFilter} onChange={(event) => onClassFilter(event.target.value)}>
              <option value="">Tüm sınıflar</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {gradeLabel(item.grade)}
                </option>
              ))}
            </select>
          </div>
          <div className="small muted" style={{ alignSelf: 'end', paddingBottom: 8 }}>
            En fazla 6 öğrenci seçebilirsin ({selectedIds.length}/6) — farklı sınıflar birlikte seçilebilir.
          </div>
        </div>
        <div className="tracking-picker mt-16">
          {visible.length === 0 ? (
            <p className="small muted">Bu filtrede öğrenci yok.</p>
          ) : (
            visible.map((item) => {
              const checked = selectedIds.includes(item.student.id)
              return (
                <label key={item.student.id} className={`tracking-pick ${checked ? 'is-selected' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => onToggle(item.student.id)} />
                  <span className="tracking-pick-name">{item.student.name}</span>
                  <span className="small muted">
                    {gradeLabel(item.grade)} · {item.className}
                  </span>
                </label>
              )
            })
          )}
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="card empty">
          Yukarıdan öğrenci seçin — örneğin bir 3. sınıf ve bir 5. sınıf öğrencisini birlikte seçip yan yana görebilirsiniz.
        </div>
      ) : (
        <div className="tracking-wrap">
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="tracking-sticky">Ölçüt</th>
                {selected.map((item) => (
                  <th key={item.student.id}>
                    <span className="tracking-col-title">{item.student.name}</span>
                    <span className="tracking-col-sub">
                      {gradeLabel(item.grade)} · {item.className}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.label}>
                  <td className="tracking-sticky">
                    <strong>{metric.label}</strong>
                  </td>
                  {selected.map((item) => (
                    <td key={item.student.id} className="track-cell" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {metric.value(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.length > 0 && (
        <>
          <div className="section-heading mt-16">
            <h2>Okuduğu / okumadığı kitaplar</h2>
            <span className="small muted">Her öğrenci kendi sınıfının okumalarına göre</span>
          </div>
          <div className="compare-books">
            {selected.map((item) => (
              <div key={item.student.id} className="card compare-book-card">
                <div className="row-actions" style={{ justifyContent: 'space-between' }}>
                  <strong>{item.student.name}</strong>
                  <span className="small muted">
                    {gradeLabel(item.grade)} · {item.className} · {item.readingDone}/{item.readingTotal} okuma
                  </span>
                </div>
                <div className="mt-8">
                  <span className="badge badge-success">✓ Okudu ({item.readTitles.length})</span>{' '}
                  {item.readTitles.length === 0 ? (
                    <span className="small muted">henüz yok</span>
                  ) : (
                    item.readTitles.map((book) => (
                      <span
                        key={book.id}
                        className="badge badge-muted"
                        title={book.scorePercent != null ? `Quiz %${book.scorePercent}` : ''}
                      >
                        {book.title}
                        {book.scorePercent != null ? ` %${book.scorePercent}` : ''}
                      </span>
                    ))
                  )}
                </div>
                <div className="mt-8">
                  <span className="badge badge-danger">✗ Okumadı ({item.missingTitles.length})</span>{' '}
                  {item.missingTitles.length === 0 ? (
                    <span className="small muted">yok 🎉</span>
                  ) : (
                    item.missingTitles.map((book) => (
                      <span key={book.id} className="badge badge-muted">
                        {book.title}
                      </span>
                    ))
                  )}
                </div>
                {item.incompleteTitles.length > 0 && (
                  <div className="mt-8">
                    <span className="badge badge-warning">⚠ Tamamlamadı ({item.incompleteTitles.length})</span>{' '}
                    {item.incompleteTitles.map((book) => (
                      <span key={book.id} className="badge badge-muted">
                        {book.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
