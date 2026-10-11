import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../state/store.jsx'
import { fetchClasses } from '../../cloud/classes.js'
import { GRADES, gradeLabel, formatDate } from '../../domain/model.js'
import { studentBalance } from '../../domain/points.js'
import Modal from '../components/Modal.jsx'

// Ödül yönetimi: sınıf bazlı havuz CRUD, bakiyeler + öğretmen puan düzeltmesi,
// puan hareketleri. Ledger istemcide yazılamaz (cloud); düzeltme RPC ile taşınır.
const emptyForm = { classKey: '', name: '', icon: '⭐', cost: 10, quantity: 10, description: '' }

export default function RewardsScreen() {
  const { db, actions, isCloudMode } = useStore()
  const [tab, setTab] = useState('pool')
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null) // { id, ...fields }
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const rewards = db.rewards || []
  const transactions = db.pointTransactions || []
  const students = db.students || []

  const loadClasses = useCallback(async () => {
    if (!isCloudMode) return
    try {
      setClasses(await fetchClasses())
    } catch (caughtError) {
      console.error('Sınıflar yüklenemedi:', caughtError)
    }
  }, [isCloudMode])

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        if (isCloudMode) await actions.refreshPoints() // sunucu ledger'ını tazele
      } catch (caughtError) {
        if (active) setError(caughtError.message)
      }
      if (active) loadClasses()
    }
    run()
    return () => {
      active = false
    }
  }, [actions, isCloudMode, loadClasses])

  // Havuz seçenekleri: cloud'da gerçek sınıflar, yerelde sınıf (grade) anahtarları.
  const poolOptions = isCloudMode
    ? classes.map((item) => ({ key: item.id, label: `${gradeLabel(item.grade)} — ${item.name}` }))
    : GRADES.map((g) => ({ key: `grade:${g}`, label: gradeLabel(g) }))

  const grouped = poolOptions
    .map((option) => ({ ...option, items: rewards.filter((r) => String(r.classKey) === String(option.key)) }))
    .filter((group) => group.items.length > 0)

  const studentName = (id) => students.find((s) => s.id === id)?.name || 'Bilinmeyen öğrenci'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!form.classKey) return setError('Sınıf seçin.')
    if (!String(form.name).trim()) return setError('Ödül adı zorunlu.')
    const cost = Math.round(Number(form.cost))
    const quantity = Math.round(Number(form.quantity))
    if (!Number.isFinite(cost) || cost < 1) return setError('Puan maliyeti en az 1 olmalı.')
    if (!Number.isFinite(quantity) || quantity < 1) return setError('Adet en az 1 olmalı.')
    setBusy(true)
    try {
      await actions.addReward({
        classKey: form.classKey,
        name: String(form.name).trim(),
        icon: form.icon || '⭐',
        cost,
        quantity,
        description: String(form.description || '').trim()
      })
      setForm({ ...emptyForm, classKey: form.classKey })
      setNotice(`"${String(form.name).trim()}" havuza eklendi.`)
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSaveEdit = async (event) => {
    event.preventDefault()
    if (!editing) return
    setError('')
    const cost = Math.round(Number(editing.cost))
    const quantity = Math.round(Number(editing.quantity))
    if (!Number.isFinite(cost) || cost < 1) return setError('Puan maliyeti en az 1 olmalı.')
    if (quantity < 0) return setError('Adet 0 veya daha büyük olmalı.')
    setBusy(true)
    try {
      await actions.updateReward(editing.id, {
        name: String(editing.name).trim(),
        icon: editing.icon || 'star',
        cost,
        quantity,
        description: String(editing.description || '').trim(),
        active: Boolean(editing.active)
      })
      setEditing(null)
      setNotice('Ödül güncellendi.')
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (reward) => {
    if (!window.confirm(`"${reward.name}" ödülünü havuzdan silmek istiyor musunuz? Geçmiş harcamalar korunur.`)) return
    setBusy(true)
    setError('')
    try {
      await actions.deleteReward(reward.id)
      setNotice('Ödül silindi.')
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleAdjust = async (student, rawValue) => {
    const value = Math.round(Number(String(rawValue).replace(',', '.')))
    if (!Number.isFinite(value) || value === 0) return
    setBusy(true)
    setError('')
    try {
      await actions.adjustPoints(student.id, value, `Öğretmen düzeltmesi`)
      setNotice(`${student.name}: ${value > 0 ? '+' : ''}${value} puan işlendi.`)
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">PUAN SİSTEMİ</div>
          <h1>🏆 Ödüller</h1>
          <p className="subtitle">
            Sınıf bazlı ödül havuzları, öğrenci bakiyeleri ve puan hareketleri. Kazanım yalnızca sunucuda yazılır
            (sınav/okuma sonuçlarından), harcama anında ve onaysızdır.
          </p>
        </div>
        <div className="row-actions">
          <button className="btn btn-sm" type="button" onClick={() => actions.refreshPoints().catch((e) => setError(e.message))}>
            ↻ Yenile
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="row-actions tab-group mb-16">
        <button className={`btn btn-sm ${tab === 'pool' ? 'btn-primary' : ''}`} type="button" onClick={() => setTab('pool')}>
          Ödül Havuzu
        </button>
        <button className={`btn btn-sm ${tab === 'balances' ? 'btn-primary' : ''}`} type="button" onClick={() => setTab('balances')}>
          Bakiyeler
        </button>
        <button className={`btn btn-sm ${tab === 'ledger' ? 'btn-primary' : ''}`} type="button" onClick={() => setTab('ledger')}>
          Hareketler
        </button>
      </div>

      {tab === 'pool' && (
        <>
          <form className="card reward-form" onSubmit={handleSubmit}>
            <h2>Yeni ödül ekle</h2>
            <div className="form-grid">
              <label>
                Sınıf
                <select value={form.classKey} onChange={(e) => setForm((f) => ({ ...f, classKey: e.target.value }))}>
                  <option value="">Sınıf seçin…</option>
                  {poolOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ödül adı
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Örn. Kırmızı kalem" />
              </label>
              <label>
                İkon (emoji)
                <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} maxLength={4} />
              </label>
              <label>
                Puan maliyeti
                <input type="number" min={1} value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
              </label>
              <label>
                Adet (stok)
                <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              </label>
              <label>
                Açıklama
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="İsteğe bağlı" />
              </label>
            </div>
            <div className="row-actions mt-8">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Ekleniyor…' : ' Havuza ekle'}
            </button>
            </div>
            {isCloudMode && poolOptions.length === 0 && (
              <p className="small muted">Henüz sınıf yok. Önce Sınıflar ekranından bir sınıf oluşturun.</p>
            )}
          </form>

          {grouped.length === 0 ? (
            <div className="card empty">Henüz ödül tanımlanmamış. Yukarıdan ilk ödülü ekleyin.</div>
          ) : (
            grouped.map((group) => (
              <section key={group.key} className="reward-pool">
                <div className="section-heading">
                  <h2>{group.label}</h2>
                  <span className="small muted">{group.items.length} ödül</span>
                </div>
                <div className="reward-table">
                  {group.items.map((reward) => (
                    <div key={reward.id} className={`reward-row ${reward.active ? '' : 'is-inactive'}`}>
                      <span className="reward-row-icon">{reward.icon}</span>
                      <span className="reward-row-name">
                        <strong>{reward.name}</strong>
                        {reward.description && <span className="small muted"> — {reward.description}</span>}
                      </span>
                      <span className="badge badge-primary">⭐ {reward.cost}</span>
                      <span className={`badge ${reward.quantity > 0 ? 'badge-success' : 'badge-danger'}`}>
                        {reward.quantity > 0 ? `Kalan ${reward.quantity}` : 'Tükendi'}
                      </span>
                      <span className="small muted">{reward.redemptionCount || 0} kişi aldı</span>
                      {!reward.active && <span className="badge badge-warning">Pasif</span>}
                      <span className="row-actions">
                        <button className="btn btn-sm" type="button" onClick={() => setEditing({ ...reward })} disabled={busy}>
                          Düzenle
                        </button>
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => handleDelete(reward)} disabled={busy}>
                          Sil
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {tab === 'balances' && (
        <div className="card">
          {students.length === 0 ? (
            <div className="card empty">Kayıtlı öğrenci yok.</div>
          ) : (
            <div className="reward-table">
              {[...students]
                .map((student) => ({ student, balance: studentBalance(transactions, student.id) }))
                .sort((a, b) => b.balance - a.balance)
                .map(({ student, balance }) => (
                  <BalanceRow key={student.id} student={student} balance={balance} busy={busy} onAdjust={handleAdjust} />
                ))}
            </div>
          )}
          <p className="small muted mt-8">
            Düzeltmeler ledger&apos;a işlenir ve denetlenebilir kalır. Öğrenci puanları yıllar arasında taşınır.
          </p>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="card">
          {transactions.length === 0 ? (
            <div className="card empty">Henüz puan hareketi yok.</div>
          ) : (
            <div className="points-history">
              {transactions.slice(0, 300).map((tx) => (
                <div key={tx.id} className={`points-history-row ${tx.amount < 0 ? 'is-spend' : ''}`}>
                  <span className="points-history-label">
                    <strong>{studentName(tx.studentId)}</strong> — {tx.label || tx.kind}
                  </span>
                  <span className="points-history-date small muted">{formatDate(tx.date)}</span>
                  <span className={`points-history-amount ${tx.amount < 0 ? 'amount-spend' : 'amount-earn'}`}>
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal title={`Düzenle: ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleSaveEdit} className="reward-form">
            <div className="form-grid">
              <label>
                Ödül adı
                <input value={editing.name} onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
              </label>
              <label>
                İkon (emoji)
                <input value={editing.icon} onChange={(e) => setEditing((s) => ({ ...s, icon: e.target.value }))} maxLength={4} />
              </label>
              <label>
                Puan maliyeti
                <input type="number" min={1} value={editing.cost} onChange={(e) => setEditing((s) => ({ ...s, cost: e.target.value }))} />
              </label>
              <label>
                Kalan adet
                <input type="number" min={0} value={editing.quantity} onChange={(e) => setEditing((s) => ({ ...s, quantity: e.target.value }))} />
              </label>
              <label>
                Açıklama
                <input value={editing.description} onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing((s) => ({ ...s, active: e.target.checked }))} />
                Aktif (öğrenciler görebilsin)
              </label>
            </div>
            <div className="row-actions mt-8" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" type="button" onClick={() => setEditing(null)}>
                Vazgeç
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function BalanceRow({ student, balance, busy, onAdjust }) {
  const [value, setValue] = useState('')
  return (
    <div className="reward-row balance-row">
      <span className="reward-row-name">
        <strong>{student.name}</strong>
        <span className="small muted"> {student.className || (student.grade ? gradeLabel(student.grade) : '')}</span>
      </span>
      <span className={`badge ${balance > 0 ? 'badge-success' : 'badge-muted'}`}>⭐ {balance} puan</span>
      <span className="row-actions">
        <input
          className="adjust-input"
          type="number"
          min={-500}
          max={500}
          placeholder="±"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="btn btn-sm"
          type="button"
          disabled={busy || !value}
          onClick={() => {
            onAdjust(student, value)
            setValue('')
          }}
        >
          Düzelt
        </button>
      </span>
    </div>
  )
}
