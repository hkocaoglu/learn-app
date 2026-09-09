import { useRef, useState } from 'react'
import { useStore } from '../../state/store.jsx'
import { exportBackup, importBackup, downloadJSON, resetToSeed } from '../../db/storage.js'
import { PROVIDERS } from '../../ai/client.js'
import Modal from '../components/Modal.jsx'

export default function SettingsScreen() {
  const { db, settings, actions } = useStore()
  const { threshold, ai } = settings
  const backupRef = useRef(null)
  const [restoreMsg, setRestoreMsg] = useState(null)
  const [testMsg, setTestMsg] = useState(null)
  const [testing, setTesting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // ilk seferde baseUrl değişince modeli varsayılanla doldur (kullanıcıya yardım)
  const [providerId, setProviderId] = useState(() => {
    if (!ai.baseUrl) return 'custom'
    if (ai.baseUrl.includes('openrouter.ai')) return 'openrouter'
    if (ai.baseUrl.includes('deepseek')) return 'deepseek'
    if (ai.baseUrl.includes('openai.com')) return 'openai'
    return 'custom'
  })

  const pickProvider = (id) => {
    setProviderId(id)
    const p = PROVIDERS.find((x) => x.id === id)
    if (p) actions.setAiConfig({ baseUrl: p.baseUrl, model: p.model })
  }

  const doBackup = () => {
    downloadJSON(`sinif_test_yedek_${new Date().toISOString().slice(0, 10)}.json`, exportBackup(db))
  }

  const doRestore = async (file) => {
    try {
      const text = await file.text()
      const next = importBackup(text)
      setRestoreMsg({ ok: `Yedek geri yüklendi: ${next.students.length} öğrenci, ${next.tests.length} test, ${next.attempts.length} sonuç.` })
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      setRestoreMsg({ error: 'Geri yükleme hatası: ' + e.message })
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestMsg(null)
    try {
      const res = await fetch(`${ai.baseUrl.replace(/\/+$/, '')}/models`, {
        headers: { Authorization: `Bearer ${ai.apiKey}` }
      })
      if (res.ok) setTestMsg({ ok: 'Bağlantı başarılı. Model listesi alınabildi.' })
      else setTestMsg({ error: `Bağlantı hatası (${res.status}). Anahtar veya adresi kontrol edin.` })
    } catch (e) {
      setTestMsg({ error: 'Bağlantı kurulamadı: ' + e.message })
    } finally {
      setTesting(false)
    }
  }

  const resetSeed = () => {
    resetToSeed()
    window.location.reload()
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ayarlar</h1>
          <div className="subtitle">Eşik, AI bağlantısı ve veri yönetimi.</div>
        </div>
      </div>

      <div className="card">
        <h2>Rapor Eşiği</h2>
        <p className="small muted">
          Bir konu, en az 3 soru çözüldüyse ve başarı yüzdesi bu eşiğin altındaysa &quot;eksik konu&quot; olarak
          işaretlenir.
        </p>
        <div className="inline-form">
          <div>
            <label>Eksik kabul eşiği (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => actions.setThreshold(e.target.value)}
            />
          </div>
          <div className="muted small" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
            Örn. 60 → %60 altı eksik kabul edilir.
          </div>
        </div>
      </div>

      <div className="card">
        <h2>AI Raporlama (OpenAI-uyumlu)</h2>
        <p className="small muted">
          Raporlar ekranındaki &quot;AI ile Derin Analiz&quot; için kullanılır. OpenAI, DeepSeek, OpenRouter veya herhangi
          bir OpenAI-uyumlu uç (Ollama, LM Studio proxy…) çalışır. Anahtar tarayıcınızda saklanır — yalnız bu cihazda.
        </p>

        <div className="form-row">
          <label>Sağlayıcı</label>
          <select value={providerId} onChange={(e) => pickProvider(e.target.value)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid">
          <div className="form-row" style={{ gridColumn: 'span 2' }}>
            <label>Base URL</label>
            <input
              type="url"
              value={ai.baseUrl}
              onChange={(e) => actions.setAiConfig({ baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="form-row">
            <label>API Anahtarı</label>
            <input
              type="password"
              value={ai.apiKey}
              onChange={(e) => actions.setAiConfig({ apiKey: e.target.value })}
              placeholder={providerId === 'openrouter' ? 'sk-or-v1-...' : 'sk-...'}
            />
          </div>
          <div className="form-row">
            <label>Model</label>
            <input
              type="text"
              value={ai.model}
              onChange={(e) => actions.setAiConfig({ model: e.target.value })}
              placeholder={providerId === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini / deepseek-chat'}
            />
          </div>
        </div>

        {providerId === 'openrouter' && (
          <div className="alert alert-info small">
            OpenRouter’da model adı genellikle <strong>sağlayıcı/model</strong> biçimindedir. Örnek:
            <code>openai/gpt-4o-mini</code>. Kullanılabilir modelleri OpenRouter hesabınızdaki model kataloğundan
            seçebilirsiniz.
          </div>
        )}

        <div className="row-actions">
          <button className="btn" onClick={testConnection} disabled={testing || !ai.apiKey}>
            {testing ? 'Test ediliyor…' : '🔌 Bağlantıyı Test Et'}
          </button>
        </div>
        {testMsg && (
          <div className={`alert ${testMsg.ok ? 'alert-success' : 'alert-error'}`}>{testMsg.ok || testMsg.error}</div>
        )}
        <div className="alert alert-warning small" style={{ marginTop: 10 }}>
          Not: Tarayıcıdan doğrudan API çağrısı bazı ağlarda CORS nedeniyle engellenebilir. Böyle bir durumda CORS
          destekleyen bir sağlayıcı veya Ollama + proxy kullanın.
        </div>
      </div>

      <div className="card">
        <h2>Veri Yönetimi</h2>
        <p className="small muted">
          Tüm veriler bu tarayıcının localStorage alanında saklanır. Tarayıcı verisi temizlenirse veriler kaybolur —
          düzenli yedek alın. Yedek dosyası başka cihaza da taşınabilir.
        </p>
        <div className="row-actions">
          <button className="btn btn-primary" onClick={doBackup}>
            ⬇ Yedeği İndir (JSON)
          </button>
          <input
            ref={backupRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) await doRestore(f)
              e.target.value = ''
            }}
          />
          <button className="btn" onClick={() => backupRef.current?.click()}>
            ⬆ Yedekten Geri Yükle
          </button>
        </div>
        {restoreMsg && (
          <div className={`alert ${restoreMsg.ok ? 'alert-success' : 'alert-error'}`}>{restoreMsg.ok || restoreMsg.error}</div>
        )}
      </div>

      <div className="card">
        <h2>Örnek Veri</h2>
        <p className="small muted">
          İlk açılışta 1-4. sınıf × 3 ders için örnek soru bankası (~80 soru) ve 12 hazır test yüklenir. Bu buton
          mevcut tüm verileri siler ve örnek veriyi geri yükler.
        </p>
        <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
          Örnek Veriyi Geri Yükle
        </button>
      </div>

      {confirmReset && (
        <Modal title="Örnek Veriyi Geri Yükle" onClose={() => setConfirmReset(false)}>
          <p>
            Tüm öğrenciler, testler, sonuçlar ve AI raporları <strong>silinecek</strong> ve başlangıçtaki örnek veri
            geri yüklenecek. Emin misiniz? (Önce yedek almanız önerilir.)
          </p>
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Vazgeç
            </button>
            <button className="btn btn-danger" onClick={resetSeed}>
              Evet, Geri Yükle
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
