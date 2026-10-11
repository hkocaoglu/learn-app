import { useCallback, useEffect, useState } from 'react'
import { clearSaveGoal, fetchStudentShop, redeemReward, setSaveGoal } from '../../cloud/rewards.js'
import { catalogForClass, progressToward, redeemState } from '../../domain/points.js'
import { formatDate } from '../../domain/model.js'

// Ödül Mağazası: sınıfın ödül havuzunu gösterir, anında harcama (öğretmen onayı yok),
// biriktirme hedefi ve puan geçmişini içerir. Bakiye ledger'dan türetilir.
export default function StudentShopScreen({ student, onBack }) {
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await fetchStudentShop(student)
      setShop(next)
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setLoading(false)
    }
  }, [student])

  useEffect(() => {
    load()
  }, [load])

  const handleRedeem = async (reward) => {
    if (busyId) return
    setBusyId(reward.id)
    setNotice('')
    setError('')
    try {
      const outcome = await redeemReward(reward.id)
      setNotice(`🎉 ${reward.name} sizin! Kalan bakiye: ${outcome.balance} puan`)
      setConfirmId(null)
      await load()
    } catch (caughtError) {
      setError(caughtError.message)
      setConfirmId(null)
    } finally {
      setBusyId(null)
    }
  }

  const handleGoal = async (reward, isGoal) => {
    if (busyId) return
    setBusyId(reward.id)
    setError('')
    try {
      if (isGoal) await clearSaveGoal(student.id, reward.id)
      else await setSaveGoal(student.id, reward.id)
      await load()
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setBusyId(null)
    }
  }

  const balance = shop?.balance ?? 0
  const rewards = shop ? catalogForClass(shop.rewards, student.classId) : []
  const goalRewardIds = new Set((shop?.saveGoals || []).map((goal) => goal.rewardId))

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-sm mb-16" type="button" onClick={onBack}>
            ← Portala dön
          </button>
          <h1>🏆 Ödül Mağazası</h1>
          <p className="subtitle">Puanlarınızı biriktirin ya da hemen harcayın. Ödüller sınıflarınıza özeldir.</p>
        </div>
        <div className="points-balance-badge" aria-live="polite">
          ⭐ {balance} puan
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {loading ? (
        <div className="card empty">Ödül havuzu yükleniyor…</div>
      ) : (
        <>
          {rewards.length === 0 ? (
            <div className="card empty">Bu sınıf için henüz ödül tanımlanmamış. Öğretmeniniz eklediğinde burada görünecek.</div>
          ) : (
            <div className="reward-grid">
              {rewards.map((reward) => {
                const state = redeemState(reward, balance)
                const isGoal = goalRewardIds.has(reward.id)
                const progress = progressToward(reward, balance)
                const confirming = confirmId === reward.id
                return (
                  <article key={reward.id} className={`reward-card ${state === 'sold_out' ? 'reward-sold-out' : ''}`}>
                    <div className="reward-icon" aria-hidden="true">
                      {reward.icon}
                    </div>
                    <h3>{reward.name}</h3>
                    {reward.description && <p className="small muted">{reward.description}</p>}
                    <div className="reward-cost">⭐ {reward.cost} puan</div>
                    <div className="reward-stock small">Kalan: {reward.quantity}</div>

                    {state === 'sold_out' ? (
                      <span className="badge badge-danger">Tükendi</span>
                    ) : confirming ? (
                      <div className="reward-confirm">
                        <p className="small">
                          <strong>{reward.cost} puan</strong> düşülecek. Onaylıyor musunuz?
                        </p>
                        <div className="row-actions">
                          <button className="btn btn-sm" type="button" onClick={() => setConfirmId(null)} disabled={busyId === reward.id}>
                            Vazgeç
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            type="button"
                            onClick={() => handleRedeem(reward)}
                            disabled={busyId === reward.id}
                          >
                            {busyId === reward.id ? 'İşleniyor…' : 'Onayla'}
                          </button>
                        </div>
                      </div>
                    ) : state === 'affordable' ? (
                      <button className="btn btn-success" type="button" onClick={() => setConfirmId(reward.id)}>
                        Hemen al
                      </button>
                    ) : (
                      <span className="badge badge-warning">{reward.cost - balance} puan eksik</span>
                    )}

                    {isGoal && (
                      <div className="save-goal-progress" title={`${progress}%`}>
                        <div className="save-goal-bar">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <span className="small muted">%{progress} biriktirildi</span>
                      </div>
                    )}
                    <button
                      className={`btn btn-sm ${isGoal ? 'btn-primary' : ''}`}
                      type="button"
                      onClick={() => handleGoal(reward, isGoal)}
                      disabled={busyId === reward.id || state === 'sold_out'}
                    >
                      {isGoal ? '✓ Hedeften çıkar' : 'Bunun için biriktir'}
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          <div className="section-heading mt-16">
            <h2>Puan Geçmişi</h2>
          </div>
          {!shop?.transactions?.length ? (
            <div className="card empty">Henüz puan hareketiniz yok. Sınav ve okumaları tamamlayın, puanlar burada birikir.</div>
          ) : (
            <div className="points-history">
              {shop.transactions.map((tx) => (
                <div key={tx.id} className={`points-history-row ${tx.amount < 0 ? 'is-spend' : ''}`}>
                  <span className="points-history-label">{tx.label || tx.kind}</span>
                  <span className="points-history-date small muted">{formatDate(tx.date)}</span>
                  <span className={`points-history-amount ${tx.amount < 0 ? 'amount-spend' : 'amount-earn'}`}>
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
