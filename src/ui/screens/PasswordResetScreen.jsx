import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { formatAuthError } from '../../auth/authErrors.js'

export default function PasswordResetScreen() {
  const { updatePassword, completePasswordRecovery, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Parola en az 6 karakter olmalıdır.')
      return
    }
    if (password !== confirmation) {
      setError('Parola tekrarı eşleşmiyor.')
      return
    }

    setBusy(true)
    try {
      const result = await updatePassword(password)
      if (result.error) {
        setError(formatAuthError(result.error.message))
      } else {
        setSuccess('Parolanız güncellendi. Artık yeni parolanızla giriş yapabilirsiniz.')
      }
    } catch (caughtError) {
      setError(formatAuthError(caughtError?.message))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await signOut()
      if (result.error) {
        setError(formatAuthError(result.error.message))
        return
      }
      completePasswordRecovery()
    } catch (caughtError) {
      setError(formatAuthError(caughtError?.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-reset-title">
        <div className="auth-brand">🎓 Sınıf Test</div>
        <h1 id="password-reset-title">Yeni parola belirleyin</h1>
        <p className="subtitle">Öğretmen hesabınız için yeni bir parola oluşturun.</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {success ? (
          <button className="btn btn-primary auth-submit" type="button" onClick={completePasswordRecovery}>
            Uygulamaya devam et
          </button>
        ) : (
          <form onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="password-reset-password">Yeni parola</label>
              <input
                id="password-reset-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="password-reset-confirmation">Yeni parola tekrarı</label>
              <input
                id="password-reset-confirmation"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
              {busy ? 'Güncelleniyor…' : 'Parolayı güncelle'}
            </button>
          </form>
        )}

        {!success && (
          <div className="auth-switch">
            <button className="btn btn-ghost btn-sm" type="button" onClick={cancel} disabled={busy}>
              Vazgeç ve girişe dön
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
