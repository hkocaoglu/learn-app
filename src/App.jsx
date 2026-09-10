import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx'
import { StoreProvider, useStore, go } from './state/store.jsx'
import AuthScreen from './ui/screens/AuthScreen.jsx'
import PasswordResetScreen from './ui/screens/PasswordResetScreen.jsx'

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
import AdminScreen from './ui/screens/AdminScreen.jsx'
import ClassesScreen from './ui/screens/ClassesScreen.jsx'
import AssignmentsScreen from './ui/screens/AssignmentsScreen.jsx'
import StudentPortalScreen from './ui/screens/StudentPortalScreen.jsx'
import ReadingsScreen from './ui/screens/ReadingsScreen.jsx'

function Router() {
  const { route } = useStore()
  const { isAdmin } = useAuth()
  const [page, param1, param2] = route
  const action = param2 ? `${param1}/${param2}` : param1

  if (isAdmin && !page) return <AdminScreen />

  switch (page) {
    case 'ogrenciler':
      return <StudentsScreen />
    case 'siniflar':
      return <ClassesScreen />
    case 'atamalar':
      return <AssignmentsScreen />
    case 'okumalar':
      return <ReadingsScreen />
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
      return isAdmin ? <SettingsScreen /> : <AdminOnlyNotice />
    case 'admin':
      return isAdmin ? <AdminScreen /> : <AdminOnlyNotice />
    default:
      return <HomeScreen />
  }
}

function AdminOnlyNotice() {
  return (
    <div className="card empty">
      <h2>Admin yetkisi gerekli</h2>
      <p>Ayarlar ve admin menüsü yalnızca admin hesabı tarafından kullanılabilir.</p>
      <button className="btn btn-primary" onClick={() => go('/')}>
        Ana sayfaya dön
      </button>
    </div>
  )
}

function AppShell() {
  const { isCloudMode, user, isAdmin, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState('')

  const handleSignOut = async () => {
    setSignOutError('')
    const result = await signOut()
    if (result.error) setSignOutError(`Çıkış yapılamadı: ${result.error.message}`)
  }

  return (
    <div className="app-shell">
      <nav className="topnav">
        <span className="brand" onClick={() => (window.location.hash = isAdmin ? '#/admin' : '#/')}>
          🎓 Sınıf Test
        </span>
        <div className="nav-links">
          {isAdmin ? (
            <a href="#/admin">⚙ Admin</a>
          ) : (
            <>
              <a href="#/">Ana Sayfa</a>
              <a href="#/testler">Testler</a>
              <a href="#/banka">Soru Bankası</a>
              <a href="#/siniflar">Sınıflar</a>
              <a href="#/atamalar">Test Atama</a>
              <a href="#/okumalar">Okuma Ata</a>
              <a href="#/ogrenciler">Öğrenciler</a>
              <a href="#/sonuclar">Sonuçlar</a>
              <a href="#/raporlar">Raporlar</a>
              <span className="nav-disabled" title="Ayarlar yalnızca admin hesabına açıktır">
                ⚙ Ayarlar 🔒
              </span>
            </>
          )}
          {isCloudMode && user && (
            <span className="account-area">
              <span className="account-email" title={user.email}>
                {user.email}
              </span>
              {isAdmin && <span className="badge badge-primary">Admin</span>}
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
          ? 'Hesabınız Supabase ile korunuyor. Sınıf, öğrenci, soru, test ve sonuç verileri cloud store üzerinde tutulur.'
          : 'Veriler bu cihazda (tarayıcıda) saklanır. Ayar ve yönetim ekranları yalnızca admin hesabına açıktır.'}
      </footer>
    </div>
  )
}

function AuthenticatedApp() {
  const { isCloudMode, loading, user, passwordRecovery } = useAuth()

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading" aria-live="polite">
          Supabase oturumu kontrol ediliyor…
        </section>
      </main>
    )
  }

  if (isCloudMode && passwordRecovery) return <PasswordResetScreen />
  if (isCloudMode && !user) return <AuthScreen />
  if (user?.user_metadata?.role === 'student') return <StudentPortalScreen />

  return (
    <StoreProvider key={user?.id || 'local'} storageScope={user?.id || ''} cloudUser={user}>
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
