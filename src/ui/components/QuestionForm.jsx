import { useEffect, useState } from 'react'
import { topicsForSubject, fileToImageData } from '../../domain/model.js'

// Tek soruyu elle düzenleme formu. Yeni soru veya mevcut soruyu düzenleme.
export default function QuestionForm({ initial, subject, grade, onSave, onCancel }) {
  const [text, setText] = useState(initial?.text || '')
  const [topic, setTopic] = useState(initial?.topic || (topicsForSubject(subject)[0] || 'genel'))
  const [options, setOptions] = useState(initial?.options?.length ? [...initial.options] : ['', '', '', ''])
  const [correctIndex, setCorrectIndex] = useState(initial?.correctIndex ?? 0)
  const [explanation, setExplanation] = useState(initial?.explanation || '')
  const [customTopic, setCustomTopic] = useState('')
  const [useCustomTopic, setUseCustomTopic] = useState(false)
  // görsel: base64 data URI veya URL; '' = yok
  const [image, setImage] = useState(initial?.image || '')
  const [imageError, setImageError] = useState('')

  const suggestions = topicsForSubject(subject)

  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)))

  const addOption = () => setOptions((o) => (o.length < 6 ? [...o, ''] : o))
  const removeOption = () => setOptions((o) => (o.length > 2 ? o.slice(0, -1) : o))

  const onPickImage = async (file) => {
    setImageError('')
    if (!file) return
    const res = await fileToImageData(file)
    if (res.error) {
      setImageError(res.error)
      return
    }
    setImage(res.data)
  }

  const submit = (e) => {
    e.preventDefault()
    const finalTopic = useCustomTopic ? customTopic.trim().toLowerCase() : topic
    onSave({
      topic: finalTopic || 'genel',
      text: text.trim(),
      options: options.map((o) => o.trim()).filter((o) => o !== ''),
      correctIndex,
      explanation: explanation.trim(),
      image: image || ''
    })
  }

  // Ders değişince (yeni soruda) varsayılan konuyu sıfırla
  useEffect(() => {
    if (!initial) {
      setTopic(topicsForSubject(subject)[0] || 'genel')
    }
  }, [subject, initial])

  return (
    <form onSubmit={submit} className="question-block" style={{ border: '2px solid var(--primary)', background: 'var(--gray-50)' }}>
      <div className="form-row">
        <label>Soru Görseli (opsiyonel — JPEG/PNG/GIF/WebP, en fazla 800 KB)</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {image && (
            <div style={{ position: 'relative' }}>
              <img src={image} alt="Soru görseli" style={{ maxWidth: 260, maxHeight: 180, borderRadius: 8, border: '1px solid var(--gray-300)', display: 'block' }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="row-actions">
              <label className="btn btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                {image ? '🖼 Görseli Değiştir' : '🖼 Görsel Yükle'}
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {image && (
                <button type="button" className="btn btn-sm btn-danger" onClick={() => { setImage(''); setImageError('') }}>
                  Görseli Kaldır
                </button>
              )}
            </div>
            <div className="small muted mt-8">
              Görsel soru metninin üstünde gösterilir. Bilgisayardan seçilen görsel, soru verisiyle birlikte saklanır
              ve JSON dışa aktarımına gömülür.
            </div>
          </div>
        </div>
        {imageError && <div className="alert alert-error" style={{ marginTop: 8 }}>{imageError}</div>}
      </div>

      <div className="form-row">
        <label>Soru Metni</label>
        <textarea
          autoFocus
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Örn. 7 + 5 işleminin sonucu kaçtır?"
        />
      </div>

      <div className="form-row">
        <label>Konu</label>
        {!useCustomTopic ? (
          <div className="inline-form">
            <div>
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                {suggestions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setUseCustomTopic(true)}>
              Özel konu yaz
            </button>
          </div>
        ) : (
          <div className="inline-form">
            <div>
              <input
                autoFocus
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Örn. saatler"
              />
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setUseCustomTopic(false)}>
              Listeden seç
            </button>
          </div>
        )}
      </div>

      <div className="form-row">
        <label>Seçenekler (en az 2, en çok 6)</label>
        {options.map((o, i) => (
          <div key={i} className="option-line">
            <span className="answer-letter">{String.fromCharCode(65 + i)}</span>
            <input type="text" value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`${i + 1}. seçenek`} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0, fontWeight: 400 }}>
              <input
                type="radio"
                name="correct"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                style={{ width: 'auto' }}
              />
              Doğru
            </label>
          </div>
        ))}
        <div className="row-actions mt-8">
          <button type="button" className="btn btn-sm" onClick={addOption} disabled={options.length >= 6}>
            + Seçenek Ekle
          </button>
          <button type="button" className="btn btn-sm" onClick={removeOption} disabled={options.length <= 2}>
            − Seçeneği Kaldır
          </button>
        </div>
      </div>

      <div className="form-row">
        <label>Açıklama (opsiyonel — cevap sonrası gösterilir)</label>
        <input type="text" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Örn. 7 + 5 = 12" />
      </div>

      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onCancel}>
          Vazgeç
        </button>
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || options.filter((o) => o.trim()).length < 2}>
          Soruyu Kaydet
        </button>
      </div>
    </form>
  )
}
