import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { seedIfEmpty, saveDB } from '../db/storage.js'
import { nowIso, uid } from '../domain/model.js'
import { scoreAttempt } from '../domain/scoring.js'

// Global uygulama durumu — localStorage'a senkronize edilir.

const StoreContext = createContext(null)

const defaultSettings = {
  threshold: 60,
  ai: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }
}

const SETTINGS_KEY = 'learn_app_settings_v1'

export const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    return { ...defaultSettings, ...parsed, ai: { ...defaultSettings.ai, ...(parsed.ai || {}) } }
  } catch {
    return defaultSettings
  }
}

const persistSettings = (s) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
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

export function StoreProvider({ children }) {
  const [db, setDb] = useState(() => seedIfEmpty())
  const [settings, setSettings] = useState(() => loadSettings())
  const [route, setRoute] = useState(parseHash())

  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const update = useCallback((fn) => {
    setDb((prev) => {
      const next = fn(prev)
      saveDB(next)
      return next
    })
  }, [])

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
    (test) => {
      update((d) => ({ ...d, tests: [test, ...d.tests] }))
      return test.id
    },
    [update]
  )

  const updateTest = useCallback(
    (id, patch) => {
      update((d) => ({ ...d, tests: d.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
    },
    [update]
  )

  const deleteTest = useCallback(
    (id) => {
      update((d) => ({
        ...d,
        tests: d.tests.filter((t) => t.id !== id),
        attempts: d.attempts.filter((a) => a.testId !== id)
      }))
    },
    [update]
  )

  // ---------- soru bankası ----------
  const addBankQuestions = useCallback(
    (questions) => {
      update((d) => ({ ...d, bank: [...questions, ...d.bank] }))
    },
    [update]
  )

  const updateBankQuestion = useCallback(
    (id, patch) => {
      update((d) => ({ ...d, bank: d.bank.map((q) => (q.id === id ? { ...q, ...patch } : q)) }))
    },
    [update]
  )

  const deleteBankQuestion = useCallback(
    (id) => {
      update((d) => ({ ...d, bank: d.bank.filter((q) => q.id !== id) }))
    },
    [update]
  )

  // ---------- denemeler (attempts) ----------
  const addAttempt = useCallback(
    (test, answers, studentId, timing = {}) => {
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
      update((d) => ({ ...d, attempts: [attempt, ...d.attempts] }))
      return attempt
    },
    [update]
  )

  const deleteAttempt = useCallback(
    (id) => {
      update((d) => ({ ...d, attempts: d.attempts.filter((a) => a.id !== id) }))
    },
    [update]
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
        persistSettings(next)
        return next
      })
    },
    []
  )

  const setAiConfig = useCallback(
    (patch) => {
      setSettings((prev) => {
        const next = { ...prev, ai: { ...prev.ai, ...patch } }
        persistSettings(next)
        return next
      })
    },
    []
  )

  const value = useMemo(
    () => ({
      db,
      settings,
      route: route.parts,
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

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
