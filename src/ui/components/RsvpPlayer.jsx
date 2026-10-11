import { useEffect, useRef, useState } from 'react'
import { formatSecondsPerWord, rsvpWordIndexAt, wordsPerMinute } from '../../domain/rsvp.js'

// Kelime akışı (RSVP) oynatıcısı.
//
// Zamanlama: metin tek bir kümülatif plana çevrilir (bkz. domain/rsvp.js) ve
// yalnızca `performance.now()` referans saatiyle karşılaştırılır. Kelime başına
// setTimeout kurulmadığı için akış zamanla kaymaz; ilk kelimeden son kelimeye
// kadar geçen süre planın toplamına birebir eşit olur.
//
// Sekme arka plana alınırsa tarayıcı requestAnimationFrame'i durdurur; geri
// dönüldüğünde referans saat sıçrayacağı için akış otomatik olarak duraklatılır.
// Böylece "izlenmeden tamamlanma" oluşmaz.
export default function RsvpPlayer({ plan, onComplete }) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)
  const elapsedRef = useRef(0)
  const baseRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

  useEffect(() => {
    if (paused || done || plan.totalMs <= 0) return undefined
    baseRef.current = clock() - elapsedRef.current
    let frame = 0
    const tick = () => {
      const next = Math.min(plan.totalMs, clock() - baseRef.current)
      elapsedRef.current = next
      setElapsedMs(next)
      if (next >= plan.totalMs) {
        setDone(true)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, done, plan.totalMs])

  useEffect(() => {
    if (done) onCompleteRef.current?.()
  }, [done])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPaused(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const index = rsvpWordIndexAt(plan, elapsedMs)
  const word = index >= 0 ? plan.words[index].text : ''
  const progressPercent = plan.totalMs > 0 ? Math.min(100, Math.round((elapsedMs / plan.totalMs) * 100)) : 0
  // Ekran okuyucuya her karede değil, çeyreklerde haber ver (akış görsel bir görevdir).
  const quartile = Math.min(100, Math.floor(progressPercent / 25) * 25)

  return (
    <div className="rsvp-player">
      <div className="rsvp-meta">
        <span className="badge badge-primary">⚡ Hızlı kelime akışı</span>
        <span className="small muted">
          {formatSecondsPerWord(plan.secondsPerWord)} • ≈ {wordsPerMinute(plan.secondsPerWord)} kelime/dk
        </span>
        <span className="small muted">Toplam {plan.wordCount} kelime</span>
      </div>

      {/* Kelime akışı görsel bir ölçüm: ekran okuyucuya kelime kelime okutmak ölçümü bozar. */}
      <div className="rsvp-stage" aria-hidden="true">
        <span className="rsvp-word">{word}</span>
      </div>

      <div
        className="rsvp-progress"
        role="progressbar"
        aria-label="Akış ilerlemesi"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <div className="rsvp-progress-bar" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="rsvp-controls">
        <span className="small muted" aria-live="polite">
          {done
            ? 'Akış tamamlandı.'
            : paused
              ? `Duraklatıldı • ${index + 1}/${plan.wordCount} kelime`
              : `Akan metin %${quartile} tamamlandı`}
        </span>
        {!done && (
          <button className="btn btn-sm" type="button" onClick={() => setPaused((current) => !current)}>
            {paused ? '▶ Devam et' : '⏸ Duraklat'}
          </button>
        )}
      </div>

      {paused && !done && (
        <p className="small muted" style={{ margin: 0 }}>
          Akış duraklatıldı. Sekme arka plana alındığında akış kendiliğinden durur; hazır olduğunuzda devam edin.
        </p>
      )}
    </div>
  )
}
