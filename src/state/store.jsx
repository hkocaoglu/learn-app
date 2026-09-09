import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { seedIfEmpty, saveDB } from '../db/storage.js'
import { nowIso, uid } from '../domain/model.js'
import { scoreAttempt } from '../domain/scoring.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import {
  createCloudQuestions,
  createCloudTest,
  createTeacherAttempt,
  deleteCloudQuestion,
  deleteCloudTest,
  deleteTeacherAttempt,
  fetchTeacherData,
  updateCloudQuestion,
  updateCloudTest
} from '../cloud/teacherData.js'

// Global uygulama durumu — localStorage'a senkronize edilir.

const StoreContext = createContext(null)

const defaultSettings = {
  threshold: 60,
  ai: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }
}

const SETTINGS_KEY = 'learn_app_settings_v1'
const scopedSettingsKey = (scope = '') => {
  const normalizedScope = String(scope || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
  return normalizedScope ? `${SETTINGS_KEY}_${normalizedScope}` : SETTINGS_KEY
}

export const loadSettings = (scope = '') => {
  try {
    const raw = localStorage.getItem(scopedSettingsKey(scope))
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    return { ...defaultSettings, ...parsed, ai: { ...defaultSettings.ai, ...(parsed.ai || {}) } }
  } catch {
    return defaultSettings
  }
}

const persistSettings = (s, scope = '') => {
  try {
    localStorage.setItem(scopedSettingsKey(scope), JSON.stringify(s))
  } catch {
    /* yoksay */
  }
}

// Hash tabanlı mini router: '#/ogrenciler', '#/testler', '#/test/ID', '#/sinav/TESTID' vb.
const navigate = (path) => {
  const target = `#${path}`
  if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else window.location.hash = target
}

export const go = (path) => navigate(path)

const parseHash = () => {
  const h = window.location.hash.replace(/^#/, '')
  // sorgu parametrelerini (örn. #/banka?grade=1) path'ten ayır
  const path = h.split('?')[0]
  const parts = path.split('/').filter(Boolean)
  return { parts }
}

export function StoreProvider({ children, storageScope = '', cloudUser = null }) {
  const cloudMode = Boolean(cloudUser?.id) && isSupabaseConfigured
  const [db, setDb] = useState(() => seedIfEmpty(storageScope))
  const [settings, setSettings] = useState(() => loadSettings(storageScope))
  const [route, setRoute] = useState(parseHash())
  const [cloudLoading, setCloudLoading] = useState(cloudMode)
  const [cloudError, setCloudError] = useState('')

  useEffect(() => {
    if (!cloudMode) {
      setCloudLoading(false)
      return undefined
    }

    let active = true
    setCloudLoading(true)
    setCloudError('')
    fetchTeacherData()
      .then((next) => {
        if (!active) return
        setDb((previous) => {
          const merged = { ...next, aiReports: previous.aiReports || {} }
          saveDB(merged, storageScope)
          return merged
        })
      })
      .catch((error) => {
        if (!active) return
        setCloudError(error.message)
      })
      .finally(() => {
        if (active) setCloudLoading(false)
      })

    return () => {
      active = false
    }
  }, [cloudMode, storageScope, cloudUser?.id])

  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const update = useCallback((fn) => {
    setDb((prev) => {
      const next = fn(prev)
      saveDB(next, storageScope)
      return next
    })
  }, [storageScope])

  // ---------- öğrenciler ----------
  const addStudent = useCallback(
    (name, grade) => {
      update((d) => ({
        ...d,
        students: [...d.students, { id: uid('s'), name: String(name).trim(), grade: Number(grade), createdAt: nowIso() }]
      }))
    },
    [update]
  )

  const updateStudent = useCallback(
    (id, patch) => {
      update((d) => ({
        ...d,
        students: d.students.map((s) => (s.id === id ? { ...s, ...patch } : s))
      }))
    },
    [update]
  )

  const deleteStudent = useCallback(
    (id) => {
      update((d) => ({
        ...d,
        students: d.students.filter((s) => s.id !== id),
        attempts: d.attempts.filter((a) => a.studentId !== id)
      }))
    },
    [update]
  )

  // ---------- testler ----------
  const addTest = useCallback(
    async (test) => {
      if (cloudMode) {
        const saved = await createCloudTest(cloudUser.id, test)
        update((d) => ({ ...d, tests: [saved, ...d.tests] }))
        return saved.id
      }
      update((d) => ({ ...d, tests: [test, ...d.tests] }))
      return test.id
    },
    [cloudMode, cloudUser?.id, update]
  )

  const updateTest = useCallback(
    async (id, patch) => {
      if (cloudMode) {
        const saved = await updateCloudTest(id, patch)
        update((d) => ({ ...d, tests: d.tests.map((test) => (test.id === id ? saved : test)) }))
        return saved
      }
      update((d) => ({ ...d, tests: d.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
    },
    [cloudMode, update]
  )

  const deleteTest = useCallback(
    async (id) => {
      if (cloudMode) {
        await deleteCloudTest(id)
        update((d) => ({
          ...d,
          tests: d.tests.filter((t) => t.id !== id),
          attempts: d.attempts.filter((a) => a.testId !== id)
        }))
        return
      }
      update((d) => ({
        ...d,
        tests: d.tests.filter((t) => t.id !== id),
        attempts: d.attempts.filter((a) => a.testId !== id)
      }))
    },
    [cloudMode, update]
  )

  // ---------- soru bankası ----------
  const addBankQuestions = useCallback(
    async (questions) => {
      if (cloudMode) {
        const saved = await createCloudQuestions(cloudUser.id, questions)
        update((d) => ({ ...d, bank: [...saved, ...d.bank] }))
        return saved
      }
      update((d) => ({ ...d, bank: [...questions, ...d.bank] }))
      return questions
    },
    [cloudMode, cloudUser?.id, update]
  )

  const updateBankQuestion = useCallback(
    async (id, patch) => {
      if (cloudMode) {
        const saved = await updateCloudQuestion(id, patch)
        update((d) => ({ ...d, bank: d.bank.map((question) => (question.id === id ? saved : question)) }))
        return saved
      }
      update((d) => ({ ...d, bank: d.bank.map((q) => (q.id === id ? { ...q, ...patch } : q)) }))
    },
    [cloudMode, update]
  )

  const deleteBankQuestion = useCallback(
    async (id) => {
      if (cloudMode) {
        await deleteCloudQuestion(id)
        update((d) => ({ ...d, bank: d.bank.filter((q) => q.id !== id) }))
        return
      }
      update((d) => ({ ...d, bank: d.bank.filter((q) => q.id !== id) }))
    },
    [cloudMode, update]
  )

  // ---------- denemeler (attempts) ----------
  const addAttempt = useCallback(
    async (test, answers, studentId, timing = {}) => {
      // timing: { timeByQid: {questionId -> sn}, totalSeconds: sn, timeUp: bool }
      const scored = scoreAttempt(test, answers, { timeByQid: timing.timeByQid })
      const attempt = {
        id: uid('a'),
        studentId,
        testId: test.id,
        testTitle: test.title,
        subject: test.subject,
        grade: test.grade,
        date: nowIso(),
        correctCount: scored.correctCount,
        totalCount: scored.totalCount,
        scorePercent: scored.scorePercent,
        topicStats: scored.topicStats,
        durationMinutes: test.durationMinutes ?? null,
        totalSeconds: Math.round(Number(timing.totalSeconds) || scored.totalSeconds),
        timeUp: !!timing.timeUp,
        answers: scored.details.map((d) => ({
          questionId: d.question.id,
          questionText: d.question.text,
          options: d.question.options,
          image: d.question.image || '',
          topic: d.topic,
          selected: d.selected,
          correctIndex: d.question.correctIndex,
          correct: d.correct,
          seconds: d.seconds
        }))
      }
      if (cloudMode) {
        const saved = await createTeacherAttempt({
          teacherId: cloudUser.id,
          test,
          studentId,
          answers,
          timing
        })
        update((d) => ({ ...d, attempts: [saved, ...d.attempts] }))
        return saved
      }
      update((d) => ({ ...d, attempts: [attempt, ...d.attempts] }))
      return attempt
    },
    [cloudMode, cloudUser?.id, update]
  )

  const deleteAttempt = useCallback(
    async (id) => {
      if (cloudMode) {
        await deleteTeacherAttempt(id)
      }
      update((d) => ({ ...d, attempts: d.attempts.filter((a) => a.id !== id) }))
    },
    [cloudMode, update]
  )

  // ---------- AI raporları ----------
  const saveAiReport = useCallback(
    (studentId, text) => {
      update((d) => ({
        ...d,
        aiReports: {
          ...d.aiReports,
          [studentId]: [...(d.aiReports[studentId] || []), { id: uid('r'), date: nowIso(), text }]
        }
      }))
    },
    [update]
  )

  const setThreshold = useCallback(
    (v) => {
      setSettings((prev) => {
        const next = { ...prev, threshold: Number(v) }
        persistSettings(next, storageScope)
        return next
      })
    },
    [storageScope]
  )

  const setAiConfig = useCallback(
    (patch) => {
      setSettings((prev) => {
        const next = { ...prev, ai: { ...prev.ai, ...patch } }
        persistSettings(next, storageScope)
        return next
      })
    },
    [storageScope]
  )

  const value = useMemo(
    () => ({
      db,
      settings,
      route: route.parts,
      isCloudMode: cloudMode,
      cloudLoading,
      cloudError,
      actions: {
        addStudent,
        updateStudent,
        deleteStudent,
        addTest,
        updateTest,
        deleteTest,
        addBankQuestions,
        updateBankQuestion,
        deleteBankQuestion,
        addAttempt,
        deleteAttempt,
        saveAiReport,
        setThreshold,
        setAiConfig
      }
    }),
    [
      db,
      settings,
      route,
      cloudMode,
      cloudLoading,
      cloudError,
      addStudent,
      updateStudent,
      deleteStudent,
      addTest,
      updateTest,
      deleteTest,
      addBankQuestions,
      updateBankQuestion,
      deleteBankQuestion,
      addAttempt,
      deleteAttempt,
      saveAiReport,
      setThreshold,
      setAiConfig
    ]
  )

  if (cloudMode && cloudLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading" aria-live="polite">
          Öğretmen verileri Supabase&apos;den yükleniyor…
        </section>
      </main>
    )
  }

  if (cloudMode && cloudError) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Cloud verileri yüklenemedi</h1>
          <div className="alert alert-error">{cloudError}</div>
          <p className="small muted">
            Supabase migration dosyalarının tarih sırasıyla çalıştırıldığını ve RLS politikalarının etkin olduğunu
            kontrol edin.
          </p>
          <button className="btn btn-primary auth-submit" type="button" onClick={() => window.location.reload()}>
            Tekrar dene
          </button>
        </section>
      </main>
    )
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
