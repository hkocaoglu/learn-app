import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { studentAuthEmail } from '../domain/studentAuth.js'

const AuthContext = createContext(null)

const unavailableError = () =>
  new Error('Supabase yapılandırılmamış. VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY tanımlayın.')

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!mounted) return

      if (error) {
        setSessionError(error.message)
      }
      setSession(data?.session || null)
      setLoading(false)
    }

    loadSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setLoading(false)
      setSessionError('')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

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

  const signOut = useCallback(async () => {
    if (!supabase) return { error: unavailableError() }
    return supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      isCloudMode: isSupabaseConfigured,
      loading,
      session,
      user: session?.user || null,
      sessionError,
      signIn,
      signInStudent,
      signUp,
      signOut
    }),
    [loading, session, sessionError, signIn, signInStudent, signUp, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.')
  return context
}
