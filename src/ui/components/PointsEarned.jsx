import { useEffect, useState } from 'react'
import { fetchEarnedFor } from '../../cloud/rewards.js'

// Sonuç ekranında kazanılan puanı sunucudan okur ve gösterir.
// Puan yalnızca sunucuda (DB trigger) yazılır; istemci yalnızca okur.
export default function PointsEarned({ studentId, refType, refId, show = true }) {
  const [amount, setAmount] = useState(null)

  useEffect(() => {
    if (!show || !studentId || !refId) return undefined
    let active = true
    fetchEarnedFor(studentId, refType, refId)
      .then((value) => {
        if (active) setAmount(value)
      })
      .catch(() => {
        if (active) setAmount(0)
      })
    return () => {
      active = false
    }
  }, [studentId, refType, refId, show])

  if (!show || !amount) return null
  return (
    <div className="points-earned" role="status">
      ⭐ +{amount} puan kazandınız
    </div>
  )
}
