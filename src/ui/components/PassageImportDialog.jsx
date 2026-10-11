import { useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { collectPassageSources, summarizePassages } from '../../domain/passageImport.js'

// Çoklu dosya / klasör / sürükle-bırak / yapıştırma ile metin içe aktarma.
// Doğrulama kaynak başına yapılır: hatalı dosya diğerlerini engellemez.
export default function PassageImportDialog({ onImport, onClose, busy = false }) {
  const [sources, setSources] = useState([]) // { name, text }
  const [pasteText, setPasteText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState('')
  const fileRef = useRef(null)
  const folderRef = useRef(null)

  const allSources = useMemo(
    () => (pasteText.trim() ? [...sources, { name: 'Yapıştırılan JSON', text: pasteText }] : sources),
    [sources, pasteText]
  )
  const result = useMemo(() => collectPassageSources(allSources), [allSources])
  const summary = useMemo(() => summarizePassages(result.passages), [result.passages])

  const addFiles = async (fileList) => {
    const files = [...(fileList || [])].filter((file) => /\.json$/i.test(file.name))
    if (files.length === 0) {
      setLocalError('Seçilenler arasında .json dosyası yok.')
      return
    }
    setLocalError('')
    const read = await Promise.all(
      files.map(async (file) => {
        try {
          return { name: file.name, text: await file.text() }
        } catch {
          return { name: file.name, text: '' }
        }
      })
    )
    setSources((current) => {
      const byName = new Map(current.map((item) => [item.name, item]))
      read.forEach((item) => byName.set(item.name, item))
      return [...byName.values()]
    })
    if (fileRef.current) fileRef.current.value = ''
    if (folderRef.current) folderRef.current.value = ''
  }

  const removeSource = (name) => setSources((current) => current.filter((item) => item.name !== name))

  const statusOf = (name) => {
    const error = result.errors.find((message) => message.startsWith(`${name}:`))
    if (error) return { ok: false, text: error.slice(name.length + 2) }
    const warning = result.warnings.find((message) => message.startsWith(`${name}:`))
    if (warning) return { ok: true, text: warning.slice(name.length + 2), warning: true }
    return { ok: true, text: 'geçerli' }
  }

  const gradeText = Object.entries(summary.byGrade)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([grade, count]) => `${grade}. sınıf: ${count}`)
    .join(' • ')

  return (
    <Modal title="Metinleri İçe Aktar (JSON)" onClose={onClose} wide>
      <p className="small muted">
        Birden fazla dosya, bir klasörün tamamı veya yapıştırılan JSON. Kabul edilen şemalar:{' '}
        <code>reading-passage</code> (tek metin) ve <code>reading-passage-collection</code> (çok metinli paket).
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          addFiles(event.dataTransfer?.files)
        }}
        style={{
          marginTop: 12,
          padding: '18px 14px',
          border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--gray-300)'}`,
          borderRadius: 'var(--radius)',
          background: dragging ? 'var(--primary-light)' : 'var(--gray-50)',
          textAlign: 'center'
        }}
      >
        <div style={{ fontWeight: 600 }}>Dosyaları buraya sürükleyin</div>
        <div className="small muted mb-8">veya aşağıdaki düğmelerle seçin (.json)</div>
        <div className="row-actions" style={{ justifyContent: 'center' }}>
          <button className="btn btn-sm" type="button" onClick={() => fileRef.current?.click()}>
            📄 Dosya seç (çoklu)
          </button>
          <button className="btn btn-sm" type="button" onClick={() => folderRef.current?.click()}>
            📁 Klasör seç
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="application/json,.json"
          onChange={(event) => addFiles(event.target.files)}
          style={{ display: 'none' }}
        />
        <input
          ref={folderRef}
          type="file"
          onChange={(event) => addFiles(event.target.files)}
          style={{ display: 'none' }}
          {...{ webkitdirectory: '', directory: '' }}
        />
      </div>

      <div className="form-row mt-16">
        <label htmlFor="reading-import-text">JSON metni (tek metin veya paket yapıştırın)</label>
        <textarea
          id="reading-import-text"
          rows={5}
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          placeholder='{"version":1,"kind":"reading-passage",...}'
        />
      </div>

      {localError && <div className="alert alert-error mt-8">{localError}</div>}

      {allSources.length > 0 && (
        <div className="mt-16">
          <div className="section-heading" style={{ marginTop: 0 }}>
            <div>
              <h2>Önizleme</h2>
              <p className="small muted">
                {summary.count} metin • {summary.questions} soru • ~{summary.words} kelime
                {gradeText ? ` • ${gradeText}` : ''}
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="alert alert-error">
              <strong>{result.errors.length} kaynak aktarılamayacak:</strong>
              {result.errors.map((message) => (
                <div key={message} className="small mt-8">
                  • {message}
                </div>
              ))}
            </div>
          )}

          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
            {allSources.map((source) => {
              const status = statusOf(source.name)
              const count = (() => {
                try {
                  const parsed = JSON.parse(source.text)
                  if (Array.isArray(parsed?.passages)) return parsed.passages.length
                  return parsed?.passage ? 1 : 0
                } catch {
                  return 0
                }
              })()
              return (
                <div
                  key={source.name}
                  className="row-actions"
                  style={{ justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--gray-100)' }}
                >
                  <span className="small" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {status.ok ? '✓' : '✗'} {source.name}
                    {count > 0 ? ` (${count} metin)` : ''}
                  </span>
                  <span className={`badge ${status.ok ? (status.warning ? 'badge-warning' : 'badge-success') : 'badge-danger'}`}>
                    {status.text}
                  </span>
                  {source.name !== 'Yapıştırılan JSON' && (
                    <button className="btn btn-sm" type="button" onClick={() => removeSource(source.name)}>
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="row-actions mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" type="button" onClick={onClose}>
          Vazgeç
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy || summary.count === 0}
          onClick={() => onImport(result.passages)}
        >
          {busy ? 'Aktarılıyor…' : summary.count > 0 ? `${summary.count} metni içe aktar` : 'İçe aktar'}
        </button>
      </div>
    </Modal>
  )
}
