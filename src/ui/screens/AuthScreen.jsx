import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { formatAuthError } from '../../auth/authErrors.js'

const initialForm = {
  fullName: '',
  schoolName: '',
  email: '',
  loginCode: '',
  password: '',
  passwordConfirmation: ''
}

export default function AuthScreen() {
  const { signIn, signInStudent, signUp, resetPasswordForEmail, sessionError } = useAuth()
  const [authType, setAuthType] = useState('teacher')
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isRegister = mode === 'register'
  const isForgotPassword = mode === 'forgot'
  const isStudent = authType === 'student'

  const switchMode = (nextMode) => {
    if (isStudent) return
    setMode(nextMode || (mode === 'login' ? 'register' : 'login'))
    setError('')
    setSuccess('')
  }

  const switchAuthType = (type) => {
    setAuthType(type)
    setMode('login')
    setForm(initialForm)
    setError('')
    setSuccess('')
  }

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const email = form.email.trim()
    const loginCode = form.loginCode.trim()
    if (isStudent) {
      if (!loginCode) {
        setError('Öğrenci giriş kodu gereklidir.')
        return
      }
      if (!/^\d{4}$/.test(form.password)) {
        setError('PIN dört haneli olmalıdır.')
        return
      }
    } else {
      if (!email) {
        setError('E-posta adresi gereklidir.')
        return
      }
      if (!isForgotPassword && form.password.length < 6) {
        setError('Parola en az 6 karakter olmalıdır.')
        return
      }
      if (isRegister && !form.fullName.trim()) {
        setError('Ad soyad gereklidir.')
        return
      }
      if (isRegister && form.password !== form.passwordConfirmation) {
        setError('Parola tekrarı eşleşmiyor.')
        return
      }
    }

    setBusy(true)
    try {
      const result = isStudent
        ? await signInStudent({ loginCode, pin: form.password })
        : isForgotPassword
          ? await resetPasswordForEmail({ email })
        : isRegister
          ? await signUp({
              email,
              password: form.password,
              fullName: form.fullName,
              schoolName: form.schoolName
            })
          : await signIn({ email, password: form.password })

      if (result.error) {
        setError(formatAuthError(result.error.message))
      } else if (isStudent) {
        setSuccess('Öğrenci oturumu açıldı.')
      } else if (isForgotPassword) {
        setSuccess('Parola sıfırlama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.')
      } else if (isRegister && !result.data?.session) {
        setSuccess('Kayıt tamamlandı. Giriş yapmadan önce e-posta adresinizi doğrulayın.')
      } else if (isRegister) {
        setSuccess('Hesabınız oluşturuldu.')
      }
    } catch (caughtError) {
      setError(formatAuthError(caughtError?.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">🎓 Sınıf Test</div>
        <div className="auth-role-switch" role="tablist" aria-label="Giriş türü">
          <button
            type="button"
            className={`btn btn-sm ${!isStudent ? 'btn-primary' : ''}`}
            onClick={() => switchAuthType('teacher')}
            role="tab"
            aria-selected={!isStudent}
          >
            Öğretmen
          </button>
          <button
            type="button"
            className={`btn btn-sm ${isStudent ? 'btn-primary' : ''}`}
            onClick={() => switchAuthType('student')}
            role="tab"
            aria-selected={isStudent}
          >
            Öğrenci
          </button>
        </div>
        <h1 id="auth-title">
          {isStudent
            ? 'Öğrenci girişi'
            : isForgotPassword
              ? 'Parolanızı sıfırlayın'
              : isRegister
                ? 'Öğretmen hesabı oluşturun'
                : 'Öğretmen girişi'}
        </h1>
        <p className="subtitle">
          {isStudent
            ? 'Öğretmeninizin verdiği giriş kodu ve PIN ile devam edin.'
            : isForgotPassword
              ? 'E-posta adresinize parola yenileme bağlantısı gönderelim.'
            : isRegister
              ? 'Sınıflarınızı ve testlerinizi güvenli şekilde yönetmeye başlayın.'
              : 'Sınıflarınıza ve test yönetim panelinize devam edin.'}
        </p>

        {sessionError && <div className="alert alert-error">{formatAuthError(sessionError)}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={submit}>
          {isRegister && (
            <>
              <div className="form-row">
                <label htmlFor="auth-full-name">Ad soyad</label>
                <input
                  id="auth-full-name"
                  name="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={updateField}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="auth-school-name">Okul adı (isteğe bağlı)</label>
                <input
                  id="auth-school-name"
                  name="schoolName"
                  type="text"
                  value={form.schoolName}
                  onChange={updateField}
                  autoComplete="organization"
                />
              </div>
            </>
          )}

          {isStudent ? (
            <div className="form-row">
              <label htmlFor="auth-login-code">Öğrenci giriş kodu</label>
              <input
                id="auth-login-code"
                name="loginCode"
                type="text"
                value={form.loginCode}
                onChange={updateField}
                autoComplete="username"
                spellCheck="false"
                required
              />
            </div>
          ) : (
            <div className="form-row">
              <label htmlFor="auth-email">E-posta</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                autoComplete="email"
                required
              />
            </div>
          )}

          {!isForgotPassword && (
            <div className="form-row">
              <label htmlFor="auth-password">{isStudent ? '4 haneli PIN' : 'Parola'}</label>
              <input
                id="auth-password"
                name="password"
                type={isStudent ? 'text' : 'password'}
                value={form.password}
                onChange={updateField}
                autoComplete={isStudent ? 'one-time-code' : isRegister ? 'new-password' : 'current-password'}
                inputMode={isStudent ? 'numeric' : undefined}
                maxLength={isStudent ? 4 : undefined}
                pattern={isStudent ? '\\d{4}' : undefined}
                required
              />
            </div>
          )}

          {isRegister && (
            <div className="form-row">
              <label htmlFor="auth-password-confirmation">Parola tekrarı</label>
              <input
                id="auth-password-confirmation"
                name="passwordConfirmation"
                type="password"
                value={form.passwordConfirmation}
                onChange={updateField}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
          )}

          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? 'İşleniyor…' : isForgotPassword ? 'Sıfırlama bağlantısı gönder' : isRegister ? 'Kayıt ol' : 'Giriş yap'}
          </button>
        </form>

        <div className="auth-switch">
          {isStudent ? (
            <>
              Öğretmen misiniz?
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => switchAuthType('teacher')}>
                Öğretmen girişine dönün
              </button>
            </>
          ) : isForgotPassword ? (
            <>
              Parolanızı hatırladınız mı?
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => switchMode('login')}>
                Giriş yapın
              </button>
            </>
          ) : (
            <>
              {isRegister ? 'Zaten hesabınız var mı?' : 'Henüz hesabınız yok mu?'}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => switchMode()}>
                {isRegister ? 'Giriş yapın' : 'Kayıt olun'}
              </button>
            </>
          )}
        </div>
        {!isStudent && !isRegister && !isForgotPassword && (
          <div className="auth-switch">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => switchMode('forgot')}>
              Parolamı unuttum
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
