// Hızlı kelime akışı (RSVP) zamanlama çekirdeği — saf, tarayıcısız test edilebilir.
//
// Öğretmen "kelime başına süre"yi (sn) belirler; metin bu hızda kelime kelime akar.
// Zamanlama TEK bir kümülatif plana dönüştürülür (her kelimenin başlangıç/bitiş ms'i).
// Oynatıcı bu planı `performance.now()` ile karşılaştırır: kelime başına zamanlayıcı
// kurmak yerine tek bir referans saat kullanıldığı için akış kaymaz (drift yok).
import { formatSeconds, normalizeSecondsPerWord, RSVP_DEFAULT_SECONDS_PER_WORD } from './model.js'

export { RSVP_DEFAULT_SECONDS_PER_WORD, normalizeSecondsPerWord }

// Metni akış kelimelerine böler. Noktalama kelimenin parçası olarak kalır
// (akış sırasında cümle sonu görsel ipucudur); boş parçalar atılır.
export const splitWords = (body) => String(body ?? '').trim().split(/\s+/).filter(Boolean)

// Dakikadaki kelime karşılığı — öğretmen formunda hızı okunur kılar.
export const wordsPerMinute = (secondsPerWord) => Math.round(60 / normalizeSecondsPerWord(secondsPerWord))

// Toplam akış süresi (sn, yukarı yuvarlanır).
export const estimateRsvpSeconds = (wordCount, secondsPerWord) =>
  Math.ceil(Math.max(0, Number(wordCount) || 0) * normalizeSecondsPerWord(secondsPerWord))

// Akış planı: { secondsPerWord, msPerWord, words: [{ index, text, startMs, endMs }], totalMs, wordCount }
export const buildRsvpPlan = (body, secondsPerWord) => {
  const seconds = normalizeSecondsPerWord(secondsPerWord)
  const msPerWord = Math.round(seconds * 1000)
  const words = splitWords(body).map((text, index) => ({
    index,
    text,
    startMs: index * msPerWord,
    endMs: (index + 1) * msPerWord
  }))
  return {
    secondsPerWord: seconds,
    msPerWord,
    words,
    wordCount: words.length,
    totalMs: words.length * msPerWord
  }
}

// Geçen süreye karşılık gelen kelime sırası; metin bittiğinde son kelimede sabitlenir.
export const rsvpWordIndexAt = (plan, elapsedMs) => {
  if (!plan || plan.wordCount === 0 || plan.msPerWord <= 0) return -1
  const index = Math.floor(Math.max(0, Number(elapsedMs) || 0) / plan.msPerWord)
  return index >= plan.wordCount ? plan.wordCount - 1 : index
}

export const rsvpFinished = (plan, elapsedMs) =>
  Boolean(plan) && plan.wordCount > 0 && Number(elapsedMs) >= plan.totalMs

// '0,8 sn/kelime' — Türkçe ondalık ayracı.
export const formatSecondsPerWord = (secondsPerWord) =>
  `${String(normalizeSecondsPerWord(secondsPerWord)).replace('.', ',')} sn/kelime`

// '1 kelime / 0,8 sn (≈ 75 kelime/dk)'
export const formatWordSpeed = (secondsPerWord) =>
  `1 kelime / ${String(normalizeSecondsPerWord(secondsPerWord)).replace('.', ',')} sn (≈ ${wordsPerMinute(secondsPerWord)} kelime/dk)`

// Akış planının okunur özeti: '120 kelime • 1 dk 36 sn'
export const describeRsvpPlan = (plan) =>
  `${plan?.wordCount ?? 0} kelime • ${formatSeconds(Math.ceil((plan?.totalMs ?? 0) / 1000))}`
