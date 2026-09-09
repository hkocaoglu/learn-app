import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx'
import { StoreProvider, useStore } from './state/store.jsx'
import AuthScreen from './ui/screens/AuthScreen.jsx'

import HomeScreen from './ui/screens/HomeScreen.jsx'
import StudentsScreen from './ui/screens/StudentsScreen.jsx'
import StudentDetailScreen from './ui/screens/StudentDetailScreen.jsx'
import TestsScreen from './ui/screens/TestsScreen.jsx'
import TestEditorScreen from './ui/screens/TestEditorScreen.jsx'
import BankScreen from './ui/screens/BankScreen.jsx'
import ExamScreen from './ui/screens/ExamScreen.jsx'
import ResultsScreen from './ui/screens/ResultsScreen.jsx'
import ReportsScreen from './ui/screens/ReportsScreen.jsx'
import SettingsScreen from './ui/screens/SettingsScreen.jsx'
import ClassesScreen from './ui/screens/ClassesScreen.jsx'
import AssignmentsScreen from './ui/screens/AssignmentsScreen.jsx'
import StudentPortalScreen from './ui/screens/StudentPortalScreen.jsx'

function Router() {
  const { route } = useStore()
  const [page, param1, param2] = route
  const action = param2 ? `${param1}/${param2}` : param1

  switch (page) {
    case 'ogrenciler':
      return <StudentsScreen />
    case 'siniflar':
      return <ClassesScreen />
    case 'atamalar':
      return <AssignmentsScreen />
    case 'ogrenci':
      return <StudentDetailScreen id={param1} />
    case 'testler':
      return <TestsScreen />
    case 'test':
      return <TestEditorScreen id={param1} />
    case 'banka':
      return <BankScreen />
    case 'sinav':
      return <ExamScreen id={action} />
    case 'sonuclar':
      return <ResultsScreen attemptId={param1} />
    case 'raporlar':
      return <ReportsScreen />
    case 'rapor':
      return <ReportsScreen studentId={param1} />
    case 'ayarlar':
      return <SettingsScreen />
    default:
      return <HomeScreen />
  }
}

function AppShell() {
  const { isCloudMode, user, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState('')

  const handleSignOut = async () => {
    setSignOutError('')
    const result = await signOut()
    if (result.error) setSignOutError(`Çıkış yapılamadı: ${result.error.message}`)
  }

  return (
    <div className="app-shell">
      <nav className="topnav">
        <span className="brand" onClick={() => (window.location.hash = '#/')}>
          🎓 Sınıf Test
        </span>
        <div className="nav-links">
          <a href="#/">Ana Sayfa</a>
          <a href="#/testler">Testler</a>
          <a href="#/banka">Soru Bankası</a>
          <a href="#/siniflar">Sınıflar</a>
          <a href="#/atamalar">Test Atama</a>
          <a href="#/ogrenciler">Öğrenciler</a>
          <a href="#/sonuclar">Sonuçlar</a>
          <a href="#/raporlar">Raporlar</a>
          <a href="#/ayarlar">Ayarlar</a>
          {isCloudMode && user && (
            <span className="account-area">
              <span className="account-email" title={user.email}>
                {user.email}
              </span>
              <button className="btn btn-sm" type="button" onClick={handleSignOut}>
                Çıkış
              </button>
            </span>
          )}
        </div>
      </nav>
      <main className="content">
        {signOutError && <div className="alert alert-error">{signOutError}</div>}
        <Router />
      </main>
      <footer className="app-footer">
        {isCloudMode
          ? 'Hesabınız Supabase ile korunuyor. Uygulama verileri cloud store tamamlanana kadar bu cihazda saklanır.'
          : 'Veriler bu cihazda (tarayıcıda) saklanır. Yedek almak için Ayarlar > Veri Yedekleme.'}
      </footer>
    </div>
  )
}

function AuthenticatedApp() {
  const { isCloudMode, loading, user } = useAuth()

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading" aria-live="polite">
          Supabase oturumu kontrol ediliyor…
        </section>
      </main>
    )
  }

  if (isCloudMode && !user) return <AuthScreen />
  if (user?.user_metadata?.role === 'student') return <StudentPortalScreen />

  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

export default App
