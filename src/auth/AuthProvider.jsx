import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { studentAuthEmail } from '../domain/studentAuth.js'

const AuthContext = createContext(null)

const unavailableError = () =>
  new Error('Supabase yapılandırılmamış. VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY tanımlayın.')

const hasPasswordRecoveryCallback = () => {
  if (typeof window === 'undefined') return false

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [sessionError, setSessionError] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(hasPasswordRecoveryCallback)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    // getSession sekmeler arası kilit çekişmesinde veya engelli depolamada
    // asılı kalabilir ya da fırlatabilir; başlatma ekranı asla takılı kalmamalı.
    const SESSION_TIMEOUT_MS = 10000
    const loadSession = async () => {
      try {
        const { data, error } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Oturum kontrolü zaman aşımına uğradı.')), SESSION_TIMEOUT_MS)
          )
        ])
        if (!mounted) return

        if (error) {
          setSessionError(error.message)
        }
        setProfileLoading(Boolean(data?.session?.user?.id))
        setSession(data?.session || null)
      } catch (caughtError) {
        if (!mounted) return
        setSessionError(caughtError?.message || 'Oturum kontrol edilemedi.')
        setSession(null)
        setProfileLoading(false)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setProfileLoading(Boolean(nextSession?.user?.id))
      setSession(nextSession)
      setLoading(false)
      setSessionError('')
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setProfile(null)
      setProfileLoading(false)
      return undefined
    }

    let active = true
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, email, full_name, school_name, created_at, updated_at')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!active) return
      if (error) {
        setSessionError(`Profil yüklenemedi: ${error.message}`)
        setProfile(null)
      } else {
        setProfile(data || null)
      }
      setProfileLoading(false)
    }

    loadProfile()
    return () => {
      active = false
    }
  }, [session?.user?.id])

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) return { data: { user: null, session: null }, error: unavailableError() }

    return supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password
    })
  }, [])

  const signInStudent = useCallback(async ({ loginCode, pin }) => {
    if (!supabase) return { data: { user: null, session: null }, error: unavailableError() }

    return supabase.auth.signInWithPassword({
      email: studentAuthEmail(loginCode),
      password: String(pin).trim()
    })
  }, [])

  const signUp = useCallback(async ({ email, password, fullName, schoolName }) => {
    if (!supabase) return { data: { user: null, session: null }, error: unavailableError() }

    const options = {
      data: {
        role: 'teacher',
        full_name: String(fullName).trim(),
        school_name: String(schoolName || '').trim()
      }
    }

    if (typeof window !== 'undefined') {
      options.emailRedirectTo = window.location.origin
    }

    return supabase.auth.signUp({
      email: String(email).trim(),
      password,
      options
    })
  }, [])

  const resetPasswordForEmail = useCallback(async ({ email }) => {
    if (!supabase) return { data: {}, error: unavailableError() }

    const options = {}
    if (typeof window !== 'undefined') {
      options.redirectTo = window.location.origin
    }

    return supabase.auth.resetPasswordForEmail(String(email).trim(), options)
  }, [])

  const updatePassword = useCallback(async (password) => {
    if (!supabase) return { data: { user: null }, error: unavailableError() }
    return supabase.auth.updateUser({ password })
  }, [])

  const completePasswordRecovery = useCallback(() => {
    setPasswordRecovery(false)
    if (typeof window === 'undefined') return

    const cleanUrl = `${window.location.pathname}${window.location.search}`
    window.history.replaceState(null, document.title, cleanUrl)
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return { error: unavailableError() }
    return supabase.auth.signOut()
  }, [])

  const user = session?.user || null
  const role = profile?.role || (user?.user_metadata?.role === 'student' ? 'student' : user ? 'teacher' : null)
  const isAdmin = role === 'admin'

  const value = useMemo(
    () => ({
      isCloudMode: isSupabaseConfigured,
      loading: loading || profileLoading,
      session,
      user,
      profile,
      role,
      isAdmin,
      sessionError,
      passwordRecovery,
      signIn,
      signInStudent,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      completePasswordRecovery,
      signOut
    }),
    [
      loading,
      profileLoading,
      session,
      user,
      profile,
      role,
      isAdmin,
      sessionError,
      passwordRecovery,
      signIn,
      signInStudent,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      completePasswordRecovery,
      signOut
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.')
  return context
}
