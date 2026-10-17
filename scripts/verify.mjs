// Uygulama çekirdek mantığını Node'da doğrular (tarayıcı gerekmez).
// localStorage yoksa stub kullan.
import { buildSeed, exportBackup, importBackup } from '../src/db/storage.js'
import { scoreAttempt, aggregateStudentTopics, aggregateStudentAll, attemptDurationStats } from '../src/domain/scoring.js'
import { computeDeficiencies, buildRuleReport } from '../src/domain/report.js'
import { normalizeTest, validateTest, validateQuestion, normalizeReading, validateReading, requiredDwellSeconds, readingWordCount, exportPassage, importPassage, importPassages, GRADES, SUBJECTS, SUBJECT_TOPICS, subjectLabel, subjectsForGrade, CURRICULUM_TOPICS, curriculumTopics, curriculumSubtopics, curriculumUnitLabel, topicsForSubject, DISPLAY_MODES, RSVP_QUESTION_COUNT, RSVP_DEFAULT_SECONDS_PER_WORD, RSVP_MIN_SECONDS_PER_WORD, RSVP_MAX_SECONDS_PER_WORD, normalizeSecondsPerWord } from '../src/domain/model.js'
import { evaluateReadingGates } from '../src/domain/readingGates.js'
import { parsePassageSource, collectPassageSources, summarizePassages } from '../src/domain/passageImport.js'
import { buildTrackingMatrix, summarizeStudents } from '../src/domain/tracking.js'
import { buildRsvpPlan, splitWords, wordsPerMinute, estimateRsvpSeconds, rsvpWordIndexAt, rsvpFinished, formatSecondsPerWord } from '../src/domain/rsvp.js'
import { createAIClient, OPENROUTER_DEFAULTS, PROVIDERS } from '../src/ai/client.js'
import { normalizeStudentPart, studentCodeBase, studentAuthEmail } from '../src/domain/studentAuth.js'
import { buildSpeechSegments, clampRate, formatRate, SPEECH_RATE, SPEECH_RATE_MAX, SPEECH_RATE_MIN } from '../src/lib/speech.js'
import {
  POINTS,
  earnForExam,
  earnForReading,
  attemptState,
  balanceOf,
  studentBalance,
  earnedAlready,
  earnTransaction,
  spendTransaction,
  adjustTransaction,
  examEarnLabel,
  readingEarnLabel,
  redeemLabel,
  canAfford,
  redeemState,
  progressToward,
  catalogForClass
} from '../src/domain/points.js'
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
// Koleksiyon (toplu) içe aktarım — tek dosyada çoklu metin
const passageA = JSON.parse(exportPassage(readingFixture)).passage
const passageB = JSON.parse(exportPassage({ ...readingFixture, title: 'İkinci Metin' })).passage
const collectionJson = JSON.stringify({ version: 1, kind: 'reading-passage-collection', passages: [passageA, passageB] })
const importedAll = importPassages(collectionJson)
check('Koleksiyon içe aktarımı iki metin döner', importedAll.length === 2 && importedAll[0].title === 'Kırlangıç' && importedAll[1].title === 'İkinci Metin')
check('Tekli dosya importPassages ile de çalışır', importPassages(exportPassage(readingFixture)).length === 1 && importPassages(exportPassage(readingFixture))[0].title === 'Kırlangıç')
let collectionError = ''
try {
  importPassages(JSON.stringify({ kind: 'reading-passage-collection', passages: [passageA, { title: 'Bozuk', body: 'kısa', grade: 2, subject: 'turkce' }] }))
} catch (e) {
  collectionError = e.message
}
check('Koleksiyonda hatalı metin numaralı hata verir', collectionError.startsWith('Metin 2 ("Bozuk")'), collectionError)
check('Boş koleksiyon reddedilir', (() => {
  try {
    importPassages(JSON.stringify({ kind: 'reading-passage-collection', passages: [] }))
    return false
  } catch (e) {
    return e.message.includes('metin yok')
  }
})())
check('Yanlış kind reddedilir', (() => {
  try {
    importPassages('{"kind":"belirsiz"}')
    return false
  } catch (e) {
    return e.message.includes('kind')
  }
})())
// Çoklu kaynak içe aktarımı (dosya/klasör): hatalı dosya diğerlerini engellemez
const multi = collectPassageSources([
  { name: 'a.json', text: exportPassage(readingFixture) },
  { name: 'bozuk.json', text: '{"kind":"reading-passage","passage":{"title":"Kısa","body":"az"}}' },
  { name: 'bos.json', text: '   ' },
  { name: 'paket.json', text: collectionJson }
])
check('Çoklu kaynak: geçerli metinler toplanıyor', multi.passages.length === 2, `(${multi.passages.length})`)
check('Çoklu kaynak: hatalı dosyalar raporlanıyor', multi.errors.length === 2 && multi.errors.some((m) => m.startsWith('bozuk.json:')) && multi.errors.some((m) => m.includes('boş')))
check('Çoklu kaynak: hata adı dosya adını taşır', multi.errors.every((m) => /^[\w.ÇŞİÖÜçşıöü]+\.json:/.test(m)), multi.errors.join(' | '))
check('Çoklu kaynak: aynı başlık tekilleştirilir + uyarı', multi.warnings.length === 1 && multi.passages.filter((p) => p.title === 'Kırlangıç').length === 1)
check('Çoklu kaynak: kısmi aktarım (geçerli olanlar korunur)', multi.passages.every((p) => p.title && p.questions.length >= 0))
const sameTitle = collectPassageSources([
  { name: 'v1.json', text: exportPassage(readingFixture) },
  { name: 'v2.json', text: exportPassage({ ...readingFixture, body: readingFixture.body + ' Ek cümle.' }) }
])
check('Çoklu kaynak: aynı başlıkta son sürüm kazanır + uyarı', sameTitle.passages.length === 1 && sameTitle.warnings.length === 1)
const summary = summarizePassages(multi.passages)
check('Önizleme özeti sayıları doğru', summary.count === 2 && summary.questions === multi.passages.reduce((s, p) => s + p.questions.length, 0) && summary.byGrade[2] === 2, JSON.stringify(summary))
check('Boş kaynak listesi güvenli', collectPassageSources([]).passages.length === 0 && collectPassageSources().errors.length === 0)
// Kapı mantığı artık saf domain modülünde (src/domain/readingGates.js) — test gerçek kodu çalıştırır.
const goodAnswers = {}
readingFixture.questions.forEach((q) => { goodAnswers[q.id] = q.correctIndex })
const gatesNoScroll = evaluateReadingGates({ reading: readingFixture, answers: goodAnswers, dwellSeconds: 48, scrolledBottom: false })
check('Scroll yoksa read=false', gatesNoScroll.read === false)
const gatesFull = evaluateReadingGates({ reading: readingFixture, answers: goodAnswers, dwellSeconds: 48, scrolledBottom: true })
check('Dwell+scroll+quiz geçerse read=true', gatesFull.read === true && gatesFull.scored.scorePercent === 100)
const badAnswers = {}
readingFixture.questions.forEach((q) => { badAnswers[q.id] = (q.correctIndex + 1) % q.options.length })
const gatesQuizFail = evaluateReadingGates({ reading: readingFixture, answers: badAnswers, dwellSeconds: 48, scrolledBottom: true })
check('Quiz kalırsa read=false', gatesQuizFail.read === false && gatesQuizFail.quizOk === false)

console.log('\n8b) Hızlı kelime akışı (RSVP)')
check('Kelime ayırma noktalama koruyor', splitWords('Bir  iki\nüç.').length === 3 && splitWords('Bir  iki\nüç.')[2] === 'üç.')
check('Boş metin kelime üretmiyor', splitWords('   ').length === 0 && buildRsvpPlan('', 0.5).wordCount === 0)
check('Hız varsayılanı 0,8 sn', normalizeSecondsPerWord(undefined) === RSVP_DEFAULT_SECONDS_PER_WORD && normalizeSecondsPerWord('abc') === RSVP_DEFAULT_SECONDS_PER_WORD)
check('Hız alt sınırda kırpılıyor', normalizeSecondsPerWord(0.01) === RSVP_MIN_SECONDS_PER_WORD && normalizeSecondsPerWord(-2) === RSVP_DEFAULT_SECONDS_PER_WORD)
check('Hız üst sınırda kırpılıyor', normalizeSecondsPerWord(9) === RSVP_MAX_SECONDS_PER_WORD)
check('Hız metinden okunuyor', normalizeSecondsPerWord('0.35') === 0.35)
check('Kelime/dk hesabı', wordsPerMinute(0.6) === 100 && wordsPerMinute(1) === 60)
check('Tahmini süre (120 kelime, 0,5 sn)', estimateRsvpSeconds(120, 0.5) === 60)
const plan4 = buildRsvpPlan('bir iki üç dört', 0.5)
check('Plan kelime sayısı ve kelime süresi', plan4.wordCount === 4 && plan4.msPerWord === 500)
check('Plan kümülatif başlangıçlar', plan4.words.map((w) => w.startMs).join(',') === '0,500,1000,1500')
check('Plan toplam süresi son bitişe eşit', plan4.totalMs === 2000 && plan4.words[3].endMs === plan4.totalMs)
check('Plan ilk kelimeden başlar', plan4.words[0].index === 0 && plan4.words[0].startMs === 0)
check('Süreye göre kelime indeksi', rsvpWordIndexAt(plan4, 0) === 0 && rsvpWordIndexAt(plan4, 499) === 0 && rsvpWordIndexAt(plan4, 500) === 1)
check('Akış sonunda son kelimede sabitlenir', rsvpWordIndexAt(plan4, 1999) === 3 && rsvpWordIndexAt(plan4, 99999) === 3)
check('Boş planda indeks -1', rsvpWordIndexAt(buildRsvpPlan('', 0.5), 100) === -1)
check('Bitiş tespiti', rsvpFinished(plan4, 1999) === false && rsvpFinished(plan4, 2000) === true)
check('Hız etiketi Türkçe ondalık', formatSecondsPerWord(0.5) === '0,5 sn/kelime' && formatSecondsPerWord(1) === '1 sn/kelime')

const rsvpQuestions = Array.from({ length: RSVP_QUESTION_COUNT }, (_, i) => ({
  topic: 'okuma-anlama',
  text: `Akış sorusu ${i + 1}`,
  options: ['A', 'B'],
  correctIndex: i % 2
}))
const rsvpFixture = normalizeReading({
  title: 'Akış Metni',
  body: 'kelime '.repeat(60).trim(),
  grade: 3,
  subject: 'turkce',
  displayMode: 'rsvp',
  rsvpSecondsPerWord: 0.5,
  questions: rsvpQuestions
})
check('Akış modu normalize ediliyor', rsvpFixture.displayMode === 'rsvp' && rsvpFixture.rsvpSecondsPerWord === 0.5)
check('Akış modunda metin quizde gizlenir', rsvpFixture.showPassageDuringQuiz === false)
check('Akış modu 3 soru ile geçerli', validateReading(rsvpFixture).length === 0)
check(
  'Akış modu 4. soruyu reddeder',
  validateReading({
    ...rsvpFixture,
    questions: [...rsvpQuestions, { topic: 'okuma-anlama', text: 'Fazla', options: ['A', 'B'], correctIndex: 0 }]
  }).some((e) => e.includes('3 soru'))
)
check(
  'Normal mod 6 soruya izin veriyor',
  validateReading({
    ...readingFixture,
    questions: Array.from({ length: 6 }, (_, i) => ({
      topic: 'okuma-anlama',
      text: `S${i}`,
      options: ['A', 'B'],
      correctIndex: 0
    }))
  }).length === 0
)
check('Geçersiz kelime hızı doğrulamayı bozuyor', validateReading({ ...rsvpFixture, rsvpSecondsPerWord: 0.05 }).some((e) => e.includes('Kelime hızı')))
check('Mod varsayılanı static', normalizeReading({ title: 'T', body: 'kelime '.repeat(60), grade: 2, subject: 'turkce' }).displayMode === 'static')
check('Modlar listesi static+rsvp', DISPLAY_MODES.join(',') === 'static,rsvp')
check('Normal moda dönerken hız korunuyor', normalizeReading({ ...rsvpFixture, displayMode: 'static' }).rsvpSecondsPerWord === 0.5)
const rsvpBack = importPassage(exportPassage(rsvpFixture))
check(
  'Akış modu JSON round-trip',
  rsvpBack.displayMode === 'rsvp' && rsvpBack.rsvpSecondsPerWord === 0.5 && rsvpBack.showPassageDuringQuiz === false && rsvpBack.questions.length === 3
)

const rsvpAnswers = {}
rsvpFixture.questions.forEach((q) => { rsvpAnswers[q.id] = q.correctIndex })
const rsvpLocked = evaluateReadingGates({ reading: rsvpFixture, answers: rsvpAnswers, dwellSeconds: 0, scrolledBottom: false, flowCompleted: false })
check('Akış tamamlanmadan quiz kilitli', rsvpLocked.rsvp === true && rsvpLocked.flowOk === false && rsvpLocked.dwellOk === false && rsvpLocked.read === false)
const rsvpOk = evaluateReadingGates({ reading: rsvpFixture, answers: rsvpAnswers, dwellSeconds: 0, scrolledBottom: false, flowCompleted: true })
check('Akış tamamlanınca süre/kaydırma olmadan geçer', rsvpOk.read === true && rsvpOk.flowOk === true && rsvpOk.quizOk === true)
const rsvpQuizFail = evaluateReadingGates({ reading: rsvpFixture, answers: {}, dwellSeconds: 0, scrolledBottom: false, flowCompleted: true })
check('Akış tamam olsa da quiz eşiği gerekli', rsvpQuizFail.read === false && rsvpQuizFail.quizOk === false)
const staticWithFlowFlag = evaluateReadingGates({ reading: readingFixture, answers: goodAnswers, dwellSeconds: 0, scrolledBottom: true, flowCompleted: true })
check('Normal modda akış bayrağı kapıyı açmaz', staticWithFlowFlag.read === false && staticWithFlowFlag.rsvp === false)
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
check('Hız alt sınırda kırpılıyor', clampRate(0.1) === SPEECH_RATE_MIN && clampRate(-3) === SPEECH_RATE_MIN)
check('Hız üst sınırda kırpılıyor', clampRate(9) === SPEECH_RATE_MAX)
check('Geçersiz hız varsayılana düşüyor', clampRate('abc') === SPEECH_RATE && clampRate(NaN) === SPEECH_RATE)
check('Hız etiketi okunur biçimde', formatRate(1) === '1×' && formatRate(0.95) === '0.95×')


const backupWithReading = exportBackup({ ...seed, students: [], attempts: [], aiReports: {}, readings: [readingFixture], readingAttempts: [] })
const restoredWithReading = importBackup(backupWithReading)
check('Backup okumaları round-trip yapıyor', restoredWithReading.readings.length === 1 && restoredWithReading.readings[0].title === 'Kırlangıç')
console.log('\n5b) Öğrenci giriş kimliği')
check('Türkçe karakterler öğrenci kodunda normalize ediliyor', normalizeStudentPart('İpek Şahin') === 'ipeksahin')
check('Öğrenci kodu okul no ve baş harflerden oluşuyor', studentCodeBase('12', 'Ayşe', 'Çelik') === '12ac')
check('Kısa öğrenci kodu destekleniyor', studentCodeBase('1', 'A', 'B') === '1ab')
check('Öğrenci Auth e-postası deterministik', studentAuthEmail('12ac') === '12ac@students.sinif-test.local')

console.log('\n5c) Müfredat dersleri (MEB)')
check(
  'Yeni dersler listede',
  ['hayat-bilgisi', 'fen-bilimleri', 'sosyal-bilgiler', 'din-kulturu', 'yabanci-dil', 'bilisim'].every((s) => SUBJECTS.includes(s))
)
check(
  'Ders etiketleri Türkçe',
  subjectLabel('hayat-bilgisi') === 'Hayat Bilgisi' &&
    subjectLabel('fen-bilimleri') === 'Fen Bilimleri' &&
    subjectLabel('sosyal-bilgiler') === 'Sosyal Bilgiler' &&
    subjectLabel('bilisim') === 'Bilişim Teknolojileri ve Yazılım'
)
check('Her dersin konu etiketleri var', SUBJECTS.every((s) => Array.isArray(SUBJECT_TOPICS[s]) && SUBJECT_TOPICS[s].length > 0))
check('3. sınıf dersleri', (() => {
  const list = subjectsForGrade(3)
  return list.includes('hayat-bilgisi') && list.includes('fen-bilimleri') && list.includes('yabanci-dil') && !list.includes('sosyal-bilgiler') && !list.includes('bilisim')
})())
check('5. sınıf dersleri', (() => {
  const list = subjectsForGrade(5)
  return list.includes('fen-bilimleri') && list.includes('sosyal-bilgiler') && list.includes('din-kulturu') && list.includes('bilisim') && !list.includes('hayat-bilgisi')
})())
check('1. sınıf dersleri', (() => {
  const list = subjectsForGrade(1)
  return list.includes('hayat-bilgisi') && !list.includes('fen-bilimleri') && !list.includes('yabanci-dil')
})())
check('Sınıf bilinmiyorsa tüm dersler', subjectsForGrade(0).length === SUBJECTS.length && subjectsForGrade('x').length === SUBJECTS.length)

// --- 5. sınıf Türkçe müfredatı (konu takibi) ---
const tr5 = CURRICULUM_TOPICS.turkce[5]
check('5. sınıf Türkçe müfredatı tanımlı', Array.isArray(tr5) && tr5.length === 11)
check('Her müfredat ünitesinin kimliği ve etiketi var', tr5.every((u) => u.id && u.label))
check('Her müfredat ünitesinde alt konu var', tr5.every((u) => Array.isArray(u.subtopics) && u.subtopics.length > 0))
check('Ünite kimlikleri benzersiz', new Set(tr5.map((u) => u.id)).size === tr5.length)
check('curriculumTopics 5. sınıf için 11 konu döner', curriculumTopics('turkce', 5).length === 11)
check('curriculumTopics tanımsız sınıf için boş döner', curriculumTopics('turkce', 4).length === 0 && curriculumTopics('matematik', 5).length === 0)
check('curriculumSubtopics ünitenin alt konularını döner', (() => {
  const sub = curriculumSubtopics('turkce', 5, 'söz sanatları')
  return sub.length === 3 && sub.includes('Benzetme (Teşbih)')
})())
check('curriculumUnitLabel okunabilir ad döner', curriculumUnitLabel('turkce', 5, 'metin yapısı') === 'Metin Yapısı')
check('5. sınıf Türkçe konu listesi müfredatı içerir', (() => {
  const list = topicsForSubject('turkce', [], 5)
  return (
    list.includes('söz varlığı') &&
    list.includes('görsel okuma ve grafik') &&
    list.includes('okuma-anlama') &&
    list.length === new Set(list).size
  )
})())
check('Sınıf verilmezse müfredat konuları eklenmez', !topicsForSubject('turkce', [], 1).includes('söz varlığı'))
check('Kullanıcı etiketleri sona eklenir', (() => {
  const list = topicsForSubject('turkce', ['özel konu'], 5)
  return list[list.length - 1] === 'özel konu'
})())
check(
  'Yeni ders doğrulamadan geçiyor',
  validateQuestion({
    text: 'Su kaç derecede donar?',
    options: ['0', '10', '50', '100'],
    correctIndex: 0,
    grade: 5,
    subject: 'fen-bilimleri',
    topic: 'madde ve doğası'
  }).length === 0
)
check(
  'Geçersiz ders doğrulamada reddediliyor',
  validateQuestion({ text: 'Soru?', options: ['a', 'b'], correctIndex: 0, grade: 5, subject: 'cografya', topic: 'konu' }).length > 0
)

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

console.log('\n6b) Puanlar & Ödüller')
// Sınav: başarı eşiği geçilmediyse HİÇ puan yok; geçilirse öğretmenin verdiği puanın
// başarı oranındaki kısmı verilir.
check('Sınav: eşik altı → 0 puan', earnForExam({ scorePercent: 50, points: 20, passThreshold: 60 }) === 0)
check('Sınav: eşik sınırında puan var (%60 → 12)', earnForExam({ scorePercent: 60, points: 20, passThreshold: 60 }) === 12)
check('Sınav: oranlı (20 puanın %80’i = 16)', earnForExam({ scorePercent: 80, points: 20, passThreshold: 60 }) === 16)
check('Sınav: tam başarı = tam puan', earnForExam({ scorePercent: 100, points: 20, passThreshold: 60 }) === 20)
check('Sınav: öğretmenin puanı esas (50 puanın %80’i = 40)', earnForExam({ scorePercent: 80, points: 50, passThreshold: 60 }) === 40)
check('Sınav: varsayılanlar (20 puan / eşik %60)', earnForExam({ scorePercent: 100 }) === 20 && earnForExam({ scorePercent: 59 }) === 0)
check('Sınav: eşik %0 ise 0 alan bile en az 1 puan', earnForExam({ scorePercent: 0, points: 20, passThreshold: 0 }) === 1)
check(
  'Sınav: tüm kombinasyonlar sınırlar içinde',
  [0, 33, 50, 60, 99, 100, 150, -5].every((score) =>
    [0, 50, 60, 100].every((passThreshold) => {
      const p = earnForExam({ scorePercent: score, points: 20, passThreshold })
      return p >= 0 && p <= POINTS.exam.max
    })
  )
)
check('Sınav: geçersiz giriş güvenli', earnForExam() === 0 && Number.isFinite(earnForExam({})))
// Okuma: yalnızca tamamlandıysa ve eşiği geçtiyse (kapı quiz tarafında).
check('Okuma: tamamlanmadı → 0', earnForReading({ read: false, scorePercent: 100 }) === 0)
check('Okuma: oranlı (10 puanın %90’ı = 9)', earnForReading({ read: true, scorePercent: 90, points: 10 }) === 9)
check('Okuma: tam başarı = tam puan', earnForReading({ read: true, scorePercent: 100, points: 10 }) === 10)
check('Okuma: öğretmenin puanı esas (30 puanın %60’ı = 18)', earnForReading({ read: true, scorePercent: 60, points: 30 }) === 18)
check(
  'Okuma: sınırlar içinde',
  [0, 40, 60, 100].every((score) => {
    const p = earnForReading({ read: true, scorePercent: score })
    return p >= POINTS.reading.min && p <= POINTS.reading.max
  })
)
// Deneme hakkı: tamamlanan sınavda tekrar yok; eşik altında günde N hak, gün değişince yenilenir.
const todayIso = new Date().toISOString()
const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
check('Deneme: deneme yoksa 2 hak', attemptState({}, []).canAttempt && attemptState({}, []).leftToday === 2)
check('Deneme: bir başarısız sonrası 1 hak', attemptState({}, [{ scorePercent: 25, date: todayIso }]).leftToday === 1)
check(
  'Deneme: günlük hak dolunca engellenir',
  attemptState({}, [{ scorePercent: 25, date: todayIso }, { scorePercent: 50, date: todayIso }]).canAttempt === false &&
    attemptState({}, [{ scorePercent: 25, date: todayIso }, { scorePercent: 50, date: todayIso }]).reason === 'daily_limit'
)
check('Deneme: gün değişince hak yenilenir', attemptState({}, [{ scorePercent: 25, date: yesterdayIso }]).leftToday === 2)
check(
  'Deneme: eşik geçilince tekrar yok',
  attemptState({ passThreshold: 60 }, [{ scorePercent: 80, date: todayIso }]).reason === 'passed' &&
    attemptState({ passThreshold: 60 }, [{ scorePercent: 80, date: todayIso }]).canAttempt === false
)
check(
  'Deneme: en iyi skor bildirilir',
  attemptState({}, [{ scorePercent: 25, date: todayIso }, { scorePercent: 50, date: todayIso }]).bestScore === 50
)
check('Deneme: günlük hak ayarlanabilir (3)', attemptState({ dailyAttempts: 3 }, [{ scorePercent: 25, date: todayIso }]).leftToday === 2)
// Ledger: bakiye = toplam; harcama negatif.
const txA = earnTransaction({ studentId: 's1', source: 'exam', refType: 'exam', refId: 't1', amount: 21, label: examEarnLabel('Matematik', 85) })
const txB = earnTransaction({ studentId: 's1', source: 'reading', refType: 'reading', refId: 'r1', amount: 9, label: readingEarnLabel('Kırlangıç') })
const txC = spendTransaction({ studentId: 's1', refId: 'rd1', amount: 10, label: redeemLabel('Kırmızı kalem') })
const txD = adjustTransaction({ studentId: 's2', amount: -5, label: 'Düzeltme' })
check('Kazanım satırı pozitif', txA.amount > 0 && txB.amount > 0 && txA.kind === 'earn' && txA.source === 'exam')
check('Harcama satırı negatif', txC.amount === -10 && txC.kind === 'spend' && txC.source === 'catalog')
check('Düzeltme işareti korunuyor', txD.amount === -5 && txD.kind === 'adjust')
check('Bakiye toplamı', balanceOf([txA, txB, txC]) === 20)
check('Boş ledger bakiyesi 0', balanceOf([]) === 0 && balanceOf() === 0)
check('Öğrenciye göre bakiye', studentBalance([txA, txB, txC, txD], 's1') === 20 && studentBalance([txA, txD], 's2') === -5)
check('Etiketler Türkçe ve içerikli', examEarnLabel('Matematik', 85).includes('%85') && readingEarnLabel('Kırlangıç').includes('Kırlangıç') && redeemLabel('Kalem').startsWith('Ödül:'))
// İdempotent kazanım: aynı kaynak ikinci kez sayılmaz.
check('Aynı kaynak ikinci kez sayılmıyor', earnedAlready([txA], 'exam', 't1') && !earnedAlready([txA], 'exam', 't2') && !earnedAlready([], 'exam', 't1'))
// Harcama: uygunluk + stok durumları.
check('canAfford sınırda doğru', canAfford(10, 10) && !canAfford(9, 10) && canAfford(100, 10))
const rw = { name: 'Kırmızı kalem', cost: 10, quantity: 10, active: true }
check('Ödül durumu: uygun', redeemState(rw, 15) === 'affordable')
check('Ödül durumu: yetersiz bakiye', redeemState(rw, 5) === 'unaffordable')
check('Ödül durumu: tükendi', redeemState({ ...rw, quantity: 0 }, 100) === 'sold_out')
check('Ödül durumu: pasif', redeemState({ ...rw, active: false }, 100) === 'inactive')
check('Biriktirme ilerlemesi %0-100', progressToward(rw, 0) === 0 && progressToward(rw, 15) === 100 && progressToward(rw, 5) === 50)
// Sınıf bazlı katalog (kullanıcı kararı: sınıf havuzları ayrıdır).
const allRewards = seed.rewards || []
check('Seed ödül havuzları var', allRewards.length >= 30, `(${allRewards.length})`)
check('Her sınıf (1-6) kendi havuzuna sahip', [1, 2, 3, 4, 5, 6].every((g) => catalogForClass(allRewards, `grade:${g}`).length >= 4))
check('Sınıf 4 ve sınıf 5 havuzları farklı', JSON.stringify(catalogForClass(allRewards, 'grade:4').map((r) => r.name)) !== JSON.stringify(catalogForClass(allRewards, 'grade:5').map((r) => r.name)))
const pen = allRewards.find((r) => r.name === 'Kırmızı kalem')
check('Kırmızı kalem 10 puan / 10 adet (ilk 10 öğrenci)', pen?.cost === 10 && pen?.quantity === 10)
check('Katalog maliyete göre sıralı + pasifler eleniyor', (() => {
  const rows = catalogForClass([...allRewards, { id: 'x', classKey: 'grade:4', name: 'Pasif', cost: 1, active: false }], 'grade:4')
  return rows.every((r, i) => i === 0 || rows[i - 1].cost <= r.cost) && rows.every((r) => r.active !== false)
})())
check('Farklı sınıf anahtarı boş katalog döner', catalogForClass(allRewards, 'grade:99').length === 0)
// Puan + ödül yedeği round-trip.
const backupWithPoints = exportBackup({ ...seed, pointTransactions: [txA, txC], redemptions: [{ id: 'rd1', studentId: 's1', rewardId: pen?.id, cost: 10 }] })
const restoredPoints = importBackup(backupWithPoints)
check('Backup puan ledger round-trip', restoredPoints.pointTransactions.length === 2 && balanceOf(restoredPoints.pointTransactions) === 11)
check('Backup ödül havuzu korunuyor', restoredPoints.rewards.length === allRewards.length)
check('Backup harcamaları round-trip', restoredPoints.redemptions.length === 1 && restoredPoints.redemptions[0].cost === 10)

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

console.log('\n8) Öğrenci takibi (matris)')
const trackStudents = [{ id: 's1', name: 'Ali' }, { id: 's2', name: 'Veli' }]
const trackItems = [
  { id: 'r1', title: 'Kırlangıç' },
  { id: 'r2', title: 'Bahar', endsAt: '2020-01-01T00:00:00Z' },
  { id: 'r3', title: 'Gelecek', startsAt: '2030-01-01T00:00:00Z' }
]
const trackAttempts = [
  { studentId: 's1', itemId: 'r1', read: true, scorePercent: 90 },
  { studentId: 's2', itemId: 'r1', read: false, scorePercent: 40 }
]
const trackNow = new Date('2026-10-01T00:00:00Z')
const track = buildTrackingMatrix({ students: trackStudents, items: trackItems, attempts: trackAttempts, kind: 'reading', now: trackNow })
check('Takip: okundu → done', track.rows[0].cells[0].status === 'done')
check('Takip: denendi ama tamamlanmadı → incomplete', track.rows[1].cells[0].status === 'incomplete')
check('Takip: süresi dolmuş → expired', track.rows[0].cells[1].status === 'expired' && track.rows[1].cells[1].status === 'expired')
check('Takip: henüz başlamamış → upcoming', track.rows[0].cells[2].status === 'upcoming')
check('Takip: satır toplamları ve yüzde', track.rows[0].done === 1 && track.rows[0].total === 3 && track.rows[0].percent === 33)
check(
  'Takip: sütun istatistikleri (kim yapmadı)',
  track.itemStats[0].done === 1 &&
    track.itemStats[0].missingStudents.length === 0 &&
    track.itemStats[0].incompleteStudents.length === 1 &&
    track.itemStats[0].incompleteStudents[0].name === 'Veli'
)
check('Takip: genel tamamlanma yüzdesi', track.totals.done === 1 && track.totals.cells === 6 && track.totals.percent === 17)
const examTrack = buildTrackingMatrix({
  students: trackStudents,
  items: [{ id: 'a1', title: 'Test' }],
  attempts: [{ studentId: 's1', itemId: 'a1', scorePercent: 80 }],
  kind: 'exam'
})
check('Takip: test çözüldü/yapılmadı', examTrack.rows[0].cells[0].status === 'done' && examTrack.rows[1].cells[0].status === 'missed')
check(
  'Takip: en iyi deneme seçilir',
  buildTrackingMatrix({
    students: [{ id: 's1', name: 'Ali' }],
    items: [{ id: 'a1', title: 'Test' }],
    attempts: [
      { studentId: 's1', itemId: 'a1', scorePercent: 40 },
      { studentId: 's1', itemId: 'a1', scorePercent: 90 }
    ],
    kind: 'exam'
  }).rows[0].cells[0].scorePercent === 90
)
check(
  'Takip: boş girdi güvenli',
  buildTrackingMatrix().totals.percent === 0 &&
    buildTrackingMatrix({ students: [], items: [] }).rows.length === 0 &&
    buildTrackingMatrix({ students: trackStudents, items: [] }).rows[0].percent === 0
)

const compareRows = summarizeStudents({
  students: [
    { id: 's1', name: 'Ali', classId: 'c3', schoolNumber: '101' },
    { id: 's2', name: 'Veli', classId: 'c5', schoolNumber: '501' }
  ],
  classes: [
    { id: 'c3', name: '3-A', grade: 3 },
    { id: 'c5', name: '5-A', grade: 5 }
  ],
  readings: [
    { id: 'r1', classId: 'c3', title: 'A' },
    { id: 'r2', classId: 'c5', title: 'B' },
    { id: 'r3', classId: 'c5', title: 'C' }
  ],
  exams: [
    { id: 'e1', classId: 'c3', title: 'T3' },
    { id: 'e2', classId: 'c5', title: 'T5' }
  ],
  readingAttempts: [{ studentId: 's1', itemId: 'r1', read: true, scorePercent: 80 }],
  examAttempts: [{ studentId: 's2', itemId: 'e2', scorePercent: 60 }],
  transactions: [
    { studentId: 's1', amount: 15 },
    { studentId: 's1', amount: -5 }
  ]
})
check('Karşılaştırma: sınıf ve sınıf düzeyi', compareRows[0].grade === 3 && compareRows[0].className === '3-A' && compareRows[1].grade === 5)
check(
  'Karşılaştırma: her öğrenci kendi sınıfının atamalarıyla ölçülür',
  compareRows[0].readingTotal === 1 && compareRows[1].readingTotal === 2 && compareRows[1].examTotal === 1
)
check(
  'Karşılaştırma: tamamlama sayıları',
  compareRows[0].readingDone === 1 && compareRows[0].examDone === 0 && compareRows[1].examDone === 1 && compareRows[1].readingDone === 0
)
check(
  'Karşılaştırma: test ortalaması ve puan bakiyesi',
  compareRows[1].avgExamScore === 60 && compareRows[0].balance === 10 && compareRows[1].balance === 0
)
check(
  'Karşılaştırma: okunan kitap listesi (hangi kitaplar)',
  compareRows[0].readTitles.length === 1 &&
    compareRows[0].readTitles[0].title === 'A' &&
    compareRows[0].readTitles[0].scorePercent === 80 &&
    compareRows[1].readTitles.length === 0
)
check(
  'Karşılaştırma: okunmayan kitap listesi',
  compareRows[1].missingTitles.length === 2 && compareRows[0].missingTitles.length === 0
)
check('Karşılaştırma: boş girdi güvenli', summarizeStudents().length === 0 && summarizeStudents({ students: [] }).length === 0)

console.log(failures === 0 ? '\nTÜM TESTLER GEÇTİ' : `\n${failures} TEST BAŞARISIZ`)
process.exit(failures === 0 ? 0 : 1)
