import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { seedIfEmpty, saveDB } from '../db/storage.js'
import { nowIso, uid } from '../domain/model.js'
import { scoreAttempt } from '../domain/scoring.js'
import { earnForExam, earnTransaction, examEarnLabel, earnedAlready, adjustTransaction } from '../domain/points.js'
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase.js'
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
import {
  createReward as createCloudReward,
  deleteReward as deleteCloudReward,
  fetchTeacherRewards,
  toTransaction,
  updateReward as updateCloudReward
} from '../cloud/rewards.js'

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
        // Puan kazanımı sunucu tarafında (DB trigger) yazılır — bkz. docs/points-system.md.
        update((d) => ({ ...d, attempts: [saved, ...d.attempts] }))
        return saved
      }
      // Yerel mod: aynı formül (domain/points.js) istemcide çalışır.
      update((d) => {
        let pointTransactions = d.pointTransactions || []
        if (studentId && !earnedAlready(pointTransactions, 'exam', attempt.testId)) {
          const earned = earnTransaction({
            studentId,
            source: 'exam',
            refType: 'exam',
            refId: attempt.testId,
            amount: earnForExam({ scorePercent: attempt.scorePercent, timeUp: attempt.timeUp }),
            label: examEarnLabel(test.title, attempt.scorePercent),
            date: attempt.date
          })
          pointTransactions = [earned, ...pointTransactions]
        }
        return { ...d, attempts: [attempt, ...d.attempts], pointTransactions }
      })
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

  // ---------- puan & ödüller (öğretmen) ----------
  const addReward = useCallback(
    async (reward) => {
      if (cloudMode) {
        const saved = await createCloudReward({ teacherId: cloudUser.id, ...reward })
        update((d) => ({ ...d, rewards: [saved, ...(d.rewards || [])] }))
        return saved
      }
      const local = {
        id: uid('rw'),
        teacherId: null,
        active: true,
        redemptionCount: 0,
        createdAt: nowIso(),
        description: '',
        icon: 'star',
        ...reward
      }
      update((d) => ({ ...d, rewards: [local, ...(d.rewards || [])] }))
      return local
    },
    [cloudMode, cloudUser?.id, update]
  )

  const updateReward = useCallback(
    async (id, patch) => {
      if (cloudMode) {
        const saved = await updateCloudReward(id, patch)
        update((d) => ({ ...d, rewards: (d.rewards || []).map((r) => (r.id === id ? saved : r)) }))
        return saved
      }
      update((d) => ({ ...d, rewards: (d.rewards || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
      return null
    },
    [cloudMode, update]
  )

  const deleteReward = useCallback(
    async (id) => {
      if (cloudMode) await deleteCloudReward(id)
      update((d) => ({ ...d, rewards: (d.rewards || []).filter((r) => r.id !== id) }))
    },
    [cloudMode, update]
  )

  // Öğretmen/admin puan düzeltmesi (eksi/artı); cloud'da RPC, yerelde ledger satırı.
  const adjustPoints = useCallback(
    async (studentId, amount, label) => {
      const value = Math.round(Number(amount) || 0)
      if (!studentId) throw new Error('Öğrenci seçilemedi.')
      if (!value) throw new Error('Puan miktarı 0 olamaz.')
      if (cloudMode) {
        const { data, error } = await requireSupabase().rpc('adjust_student_points', {
          p_student_id: studentId,
          p_amount: value,
          p_label: String(label || 'Öğretmen düzeltmesi')
        })
        if (error) throw new Error(`Puan düzeltilemedi: ${error.message}`)
        // PostgREST tablo tipini dizi olarak döndürür; tek satırı da kabul et.
        const row = Array.isArray(data) ? data[0] : data
        const saved = row ? toTransaction(row) : null
        if (saved) update((d) => ({ ...d, pointTransactions: [saved, ...(d.pointTransactions || [])] }))
        // Görünen bakiye sunucudan gelsin (istemci tahminine güvenme).
        try {
          const fresh = await fetchTeacherRewards()
          update((d) => ({ ...d, ...fresh }))
        } catch (refreshError) {
          console.warn('Düzeltme sonrası ledger tazelenemedi:', refreshError)
        }
        return saved
      }
      const tx = adjustTransaction({ studentId, amount: value, label: label || 'Öğretmen düzeltmesi' })
      update((d) => ({ ...d, pointTransactions: [tx, ...(d.pointTransactions || [])] }))
      return tx
    },
    [cloudMode, update]
  )

  // Cloud'da ledger/ödül verisini tazele (sunucu tetiklemesi yazdığı için istemci yazamaz).
  const refreshPoints = useCallback(async () => {
    if (!cloudMode) return
    const fresh = await fetchTeacherRewards()
    update((d) => ({ ...d, ...fresh }))
  }, [cloudMode, update])

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
        addReward,
        updateReward,
        deleteReward,
        adjustPoints,
        refreshPoints,
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
      addReward,
      updateReward,
      deleteReward,
      adjustPoints,
      refreshPoints,
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
