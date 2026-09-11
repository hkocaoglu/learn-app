// Uygulama çekirdek mantığını Node'da doğrular (tarayıcı gerekmez).
// localStorage yoksa stub kullan.
import { buildSeed, exportBackup, importBackup } from '../src/db/storage.js'
import { scoreAttempt, aggregateStudentTopics, aggregateStudentAll, attemptDurationStats } from '../src/domain/scoring.js'
import { computeDeficiencies, buildRuleReport } from '../src/domain/report.js'
import { normalizeTest, validateTest, validateQuestion, normalizeReading, validateReading, requiredDwellSeconds, readingWordCount, exportPassage, importPassage, GRADES } from '../src/domain/model.js'
import { createAIClient, OPENROUTER_DEFAULTS, PROVIDERS } from '../src/ai/client.js'
import { normalizeStudentPart, studentCodeBase, studentAuthEmail } from '../src/domain/studentAuth.js'
import { buildSpeechSegments } from '../src/lib/speech.js'
import vercelReportHandler from '../api/ai/report.js'

// --- localStorage stub ---
const mem = {}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v) },
    removeItem: (k) => { delete mem[k] }
  }
}

let failures = 0
const check = (name, cond, extra = '') => {
  if (cond) console.log('  ✓', name)
  else {
    failures++
    console.error('  ✗', name, extra)
  }
}

console.log('1) Seed verisi')
const seed = buildSeed()
check('Banka soru sayısı >= 60', seed.bank.length >= 60, `(${seed.bank.length})`)
check('12 hazır test (4 sınıf x 3 ders)', seed.tests.length === 12, `(${seed.tests.length})`)
check('Her testte soru var', seed.tests.every((t) => t.questions.length >= 5))
for (const g of [1, 2, 3, 4]) {
  for (const s of ['matematik', 'geometri', 'turkce']) {
    check(
      `${g}.sınıf ${s}`,
      seed.bank.some((q) => q.grade === g && q.subject === s) && seed.tests.some((t) => t.grade === g && t.subject === s)
    )
  }
}
const bankErrors = []
seed.bank.forEach((q) => validateQuestion(q).length && bankErrors.push(q))
check('Tüm banka soruları geçerli', bankErrors.length === 0, `${bankErrors.length} hatalı`)

console.log('\n2) Puanlama')
const test = seed.tests[0]
const answers = {}
test.questions.forEach((q, i) => {
  answers[q.id] = i % 2 === 0 ? q.correctIndex : (q.correctIndex + 1) % q.options.length
})
const scored = scoreAttempt(test, answers)
check('Doğru sayısı hesaplanıyor', scored.correctCount === Math.ceil(test.questions.length / 2))
check('Yüzde hesaplanıyor', scored.scorePercent === Math.round((scored.correctCount / scored.totalCount) * 100))
check('Konu istatistikleri üretiliyor', scored.topicStats.length >= 1 && scored.topicStats.every((t) => t.correct + t.total > 0))
check('total == soru sayısı', scored.topicStats.reduce((s, t) => s + t.total, 0) === test.questions.length)

console.log('\n2b) Süre ölçümü / istatistik')
const timeByQid = {}
test.questions.forEach((q, i) => {
  timeByQid[q.id] = (i + 1) * 10 // soru başına 10-60 sn
})
const scoredT = scoreAttempt(test, answers, { timeByQid })
check('Soru bazlı süreler atanıyor', scoredT.details.every((d) => d.seconds > 0))
check('totalSeconds toplamı', scoredT.totalSeconds === test.questions.reduce((s, q, i) => s + (i + 1) * 10, 0))
check('topicStats süre toplamı', scoredT.topicStats.reduce((s, t) => s + t.seconds, 0) === scoredT.totalSeconds)
const aggT = aggregateStudentTopics([{ topicStats: scoredT.topicStats }])
check('avgSeconds konu başına hesaplanıyor', aggT.every((t) => t.avgSeconds > 0))
const aggAll = aggregateStudentAll([{ topicStats: scoredT.topicStats, totalCount: test.questions.length }])
check('aggregateStudentAll süre toplamı', aggAll.totalSeconds === scoredT.totalSeconds)
check('avgSecondsPerQuestion doğru', aggAll.avgSecondsPerQuestion === Math.round(scoredT.totalSeconds / test.questions.length))
const dur = attemptDurationStats([{ totalSeconds: 300, totalCount: 5 }])
check('attemptDurationStats ortalama', dur.avgSeconds === 300 && dur.avgSecondsPerQuestion === 60)
check('durationMinutes normalize ediliyor', normalizeTest({ ...test, durationMinutes: 15 }).durationMinutes === 15)
check('durationMinutes boş -> null', normalizeTest({ ...test, durationMinutes: '' }).durationMinutes === null)
check('duration doğrulama geçerli', validateTest(normalizeTest({ ...test, durationMinutes: 30 })).length === 0)
check('duration doğrulama geçersiz (0)', validateTest({ ...test, durationMinutes: 0 }).some((e) => e.includes('Süre')))

console.log('\n3) JSON export/import round-trip')
const json = JSON.stringify({
  version: 1,
  kind: 'test',
  test: { title: 'RT', grade: 2, subject: 'matematik', questions: [test.questions[0], test.questions[1]] }
})
const parsed = JSON.parse(json)
const normalized = normalizeTest(parsed.test)
check('normalize sonrası doğrulama temiz', validateTest(normalized).length === 0)
check('Soru alanları korunuyor', normalized.questions[0].text === test.questions[0].text)
check('correctIndex korunuyor', normalized.questions[0].correctIndex === test.questions[0].correctIndex)

console.log('\n4) Rapor / eksik konu tespiti')
// "toplama" konusunda 3+ soru toplamak için 1. ve 2. sınıf matematik testlerini birleştir;
// toplamayı hep yanlış, diğer konuları ve geometriyi doğru cevapla.
const makeAnswers = (t, wrongTopic) => {
  const a = {}
  t.questions.forEach((q) => {
    a[q.id] = q.topic === wrongTopic ? (q.correctIndex + 1) % q.options.length : q.correctIndex
  })
  return a
}
const t1 = seed.tests.find((t) => t.subject === 'matematik' && t.grade === 1)
const t2 = seed.tests.find((t) => t.subject === 'matematik' && t.grade === 2)
const g1 = seed.tests.find((t) => t.subject === 'geometri' && t.grade === 1)
const attempts = [
  { subject: 'matematik', topicStats: scoreAttempt(t1, makeAnswers(t1, 'toplama')).topicStats },
  { subject: 'matematik', topicStats: scoreAttempt(t2, makeAnswers(t2, 'toplama')).topicStats },
  { subject: 'geometri', topicStats: scoreAttempt(g1, makeAnswers(g1, null)).topicStats }
]
const topics = aggregateStudentTopics(attempts)
check('toplama toplam soru >= 3', topics.find((t) => t.topic === 'toplama').total >= 3)
const defs = computeDeficiencies(topics, 60)
check('Eksik konu bulundu (toplama)', defs.some((d) => d.topic === 'toplama'))
check('Güçlü konu eksik sayılmıyor', defs.every((d) => d.subject !== 'geometri'))
const report = buildRuleReport({ name: 'Test Öğrenci', grade: 2 }, attempts, topics, { threshold: 60 })
check('Rapor metni Türkçe üretildi', report.includes('Test Öğrenci') && report.includes('ZAYIF KONULAR'))

console.log('\n5) Backup import/export')
const backup = exportBackup({ ...seed, students: [{ id: 's1', name: 'Ayşe', grade: 1 }], attempts: [], aiReports: {} })
const restored = importBackup(backup)
check('Backup geri yükleniyor', restored.students.length === 1 && restored.tests.length === 12)

console.log('\n8) Okuma ödevi')
const readingFixture = normalizeReading({
  title: 'Kırlangıç',
  body: 'kelime '.repeat(120).trim(),
  grade: 2,
  subject: 'turkce',
  quizThreshold: 60,
  questions: [
    { topic: 'okuma-anlama', text: 'Kırlangıç nereye gitti?', options: ['Güneye', 'Kuzeye'], correctIndex: 0 },
    { topic: 'okuma-anlama', text: 'Hikayenin ana duygusu nedir?', options: ['Özlem', 'Korku'], correctIndex: 0 }
  ]
})
check('Okuma doğrulama temiz', validateReading(readingFixture).length === 0)
check('Kelime sayısı 120', readingWordCount(readingFixture.body) === 120)
check('Gerekli dwell 48 sn', requiredDwellSeconds(readingFixture) === 48, `(${requiredDwellSeconds(readingFixture)})`)
check('Metin görünürlüğü varsayılan açık', normalizeReading({ title: 'T', body: 'kelime '.repeat(60), grade: 2, subject: 'turkce' }).showPassageDuringQuiz === true)
check('Metin gizleme seçimi korunuyor', normalizeReading({ title: 'T', body: 'kelime '.repeat(60), grade: 2, subject: 'turkce', showPassageDuringQuiz: false }).showPassageDuringQuiz === false)
check('Metin görünürlüğü doğrulama temiz', validateReading({ ...readingFixture, showPassageDuringQuiz: false }).length === 0)
check('5-6. sınıflar geçerli', GRADES.includes(5) && GRADES.includes(6) && validateReading({ ...readingFixture, grade: 6 }).length === 0)
const passageJson = exportPassage({ ...readingFixture, showPassageDuringQuiz: false })
const passageBack = importPassage(passageJson)
check('Metin JSON round-trip', passageBack.title === 'Kırlangıç' && passageBack.questions.length === 2 && passageBack.showPassageDuringQuiz === false && passageBack.grade === 2)
const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
const linkImage = 'https://ornek.test/kirlangic.png'
check('Görsel veri URI olarak taşınıyor', importPassage(exportPassage({ ...readingFixture, image: dataUri })).image === dataUri)
check('Görsel bağlantı olarak taşınıyor', importPassage(exportPassage({ ...readingFixture, image: linkImage })).image === linkImage)
check('Görselsiz metin boş görsel alanı', normalizeReading({ title: 'T', body: 'kelime '.repeat(60), grade: 2, subject: 'turkce' }).image === '')
check('Görsel doğrulamayı bozmuyor', validateReading({ ...readingFixture, image: linkImage }).length === 0 &&
  JSON.parse(exportPassage({ ...readingFixture, image: linkImage })).passage.image === linkImage)
// evaluateReadingGates src/cloud/readings.js içindedir; vite-only supabase importu
// Node'da yüklenemediği için eşdeğer kapı mantığı burada model+scoring ile doğrulanır:
const evalGates = ({ reading, answers, dwellSeconds, scrolledBottom }) => {
  const dwellOk = Number(dwellSeconds) >= requiredDwellSeconds(reading)
  const scrollOk = scrolledBottom === true
  const scored = scoreAttempt(
    { title: reading.title, grade: reading.grade, subject: reading.subject, questions: reading.questions },
    answers
  )
  const quizOk = scored.scorePercent >= Number(reading.quizThreshold ?? 60)
  return { dwellOk, scrollOk, quizOk, scored, read: dwellOk && scrollOk && quizOk }
}
const goodAnswers = {}
readingFixture.questions.forEach((q) => { goodAnswers[q.id] = q.correctIndex })
const gatesNoScroll = evalGates({ reading: readingFixture, answers: goodAnswers, dwellSeconds: 48, scrolledBottom: false })
check('Scroll yoksa read=false', gatesNoScroll.read === false)
const gatesFull = evalGates({ reading: readingFixture, answers: goodAnswers, dwellSeconds: 48, scrolledBottom: true })
check('Dwell+scroll+quiz geçerse read=true', gatesFull.read === true && gatesFull.scored.scorePercent === 100)
const badAnswers = {}
readingFixture.questions.forEach((q) => { badAnswers[q.id] = (q.correctIndex + 1) % q.options.length })
const gatesQuizFail = evalGates({ reading: readingFixture, answers: badAnswers, dwellSeconds: 48, scrolledBottom: true })
check('Quiz kalırsa read=false', gatesQuizFail.read === false && gatesQuizFail.quizOk === false)
const speechBody = normalizeReading({
  title: 'Ses',
  grade: 2,
  subject: 'turkce',
  body: 'Kısa bir cümle. ' + 'çok uzun bir cümle parçası '.repeat(20) + '\n\nİkinci paragraf burada!'
}).body
const speechSegments = buildSpeechSegments(speechBody)
check('Seslendirme parçaları metni birebir koruyor', speechSegments.join('') === speechBody)
check('Her parça 240 karakteri geçmiyor', speechSegments.every((s) => s.length <= 240), `(en uzun ${Math.max(...speechSegments.map((s) => s.length))})`)
check('Satır sonları parça sonunda kalıyor', speechSegments.filter((s) => s.endsWith('\n')).length === 2)
check('Boş metin parça üretmiyor', buildSpeechSegments('   ').length === 0)
check('Tek cümlelik kısa metin tek parça', buildSpeechSegments('Merhaba dünya.').length === 1)

const backupWithReading = exportBackup({ ...seed, students: [], attempts: [], aiReports: {}, readings: [readingFixture], readingAttempts: [] })
const restoredWithReading = importBackup(backupWithReading)
check('Backup okumaları round-trip yapıyor', restoredWithReading.readings.length === 1 && restoredWithReading.readings[0].title === 'Kırlangıç')
console.log('\n5b) Öğrenci giriş kimliği')
check('Türkçe karakterler öğrenci kodunda normalize ediliyor', normalizeStudentPart('İpek Şahin') === 'ipeksahin')
check('Öğrenci kodu okul no ve baş harflerden oluşuyor', studentCodeBase('12', 'Ayşe', 'Çelik') === '12ac')
check('Kısa öğrenci kodu destekleniyor', studentCodeBase('1', 'A', 'B') === '1ab')
check('Öğrenci Auth e-postası deterministik', studentAuthEmail('12ac') === '12ac@students.sinif-test.local')

console.log('\n6) AI sağlayıcıları')
const openRouter = PROVIDERS.find((provider) => provider.id === 'openrouter')
check(
  'OpenRouter sağlayıcısı tanımlı',
  openRouter?.baseUrl === OPENROUTER_DEFAULTS.baseUrl && openRouter?.model === OPENROUTER_DEFAULTS.model
)

const originalFetch = globalThis.fetch
let aiRequest = null
globalThis.fetch = async (url, options) => {
  aiRequest = { url, options }
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'OpenRouter test yanıtı' } }] })
  }
}
const aiResult = await createAIClient({
  baseUrl: OPENROUTER_DEFAULTS.baseUrl,
  apiKey: 'test-key',
  model: OPENROUTER_DEFAULTS.model
}).generateReport({
  studentName: 'Test Öğrenci',
  grade: 2,
  threshold: 60,
  subjectStats: []
})
globalThis.fetch = originalFetch
check('OpenRouter chat completions çağrısı', aiRequest?.url === `${OPENROUTER_DEFAULTS.baseUrl}/chat/completions`)
check('OpenRouter yanıtı işleniyor', aiResult.ok && aiResult.text === 'OpenRouter test yanıtı')

console.log('\n7) Vercel backend function')
const previousApiKey = process.env.OPENROUTER_API_KEY
const previousModel = process.env.OPENROUTER_MODEL
const previousFetch = globalThis.fetch
process.env.OPENROUTER_API_KEY = 'test-key'
process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini'
let serverRequest = null
let serverResponse = null
globalThis.fetch = async (url, options) => {
  serverRequest = { url, options }
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'Backend test yanıtı' } }] })
  }
}
const response = {
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    serverResponse = body
    return this
  },
  setHeader() {}
}
await vercelReportHandler(
  { method: 'POST', body: { studentName: 'Test Öğrenci', grade: 2, threshold: 60, subjectStats: [] } },
  response
)
globalThis.fetch = previousFetch
if (previousApiKey === undefined) delete process.env.OPENROUTER_API_KEY
else process.env.OPENROUTER_API_KEY = previousApiKey
if (previousModel === undefined) delete process.env.OPENROUTER_MODEL
else process.env.OPENROUTER_MODEL = previousModel
check('Vercel function OpenRouter endpointine bağlanıyor', serverRequest?.url === 'https://openrouter.ai/api/v1/chat/completions')
check('Vercel function anahtarı sunucu tarafında kullanıyor', serverRequest?.options?.headers?.Authorization === 'Bearer test-key')
check(
  'Vercel function header değerlerini ASCII gönderiyor',
  /^[\x00-\x7F]*$/.test(serverRequest?.options?.headers?.['X-OpenRouter-Title'] || '')
)
check('Vercel function yanıtı dönüyor', response.statusCode === 200 && serverResponse?.text === 'Backend test yanıtı')

console.log(failures === 0 ? '\nTÜM TESTLER GEÇTİ' : `\n${failures} TEST BAŞARISIZ`)
process.exit(failures === 0 ? 0 : 1)
