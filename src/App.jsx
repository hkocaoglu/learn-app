import { StoreProvider, useStore } from './state/store.jsx'

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

function Router() {
  const { route } = useStore()
  const [page, param1, param2] = route
  const action = param2 ? `${param1}/${param2}` : param1

  switch (page) {
    case 'ogrenciler':
      return <StudentsScreen />
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

function App() {
  return (
    <StoreProvider>
      <div className="app-shell">
        <nav className="topnav">
          <span className="brand" onClick={() => (window.location.hash = '#/')}>
            🎓 Sınıf Test
          </span>
          <div className="nav-links">
            <a href="#/">Ana Sayfa</a>
            <a href="#/testler">Testler</a>
            <a href="#/banka">Soru Bankası</a>
            <a href="#/ogrenciler">Öğrenciler</a>
            <a href="#/sonuclar">Sonuçlar</a>
            <a href="#/raporlar">Raporlar</a>
            <a href="#/ayarlar">Ayarlar</a>
          </div>
        </nav>
        <main className="content">
          <Router />
        </main>
        <footer className="app-footer">
          <span>Veriler bu cihazda (tarayıcıda) saklanır. Yedek almak için Ayarlar &gt; Veri Yedekleme.</span>
        </footer>
      </div>
    </StoreProvider>
  )
}

export default App
