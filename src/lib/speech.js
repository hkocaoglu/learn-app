// Tarayıcı yerleşik seslendirme (Web Speech API) yardımcıları.
// Sesler işletim sisteminden gelir (macOS/iOS: Yelda, Emel • Windows: Tolga).
// Burada yalnızca saf metin işleme ve ses seçimi var; çalma kontrolü ekran tarafında.

const MAX_SEGMENT_LENGTH = 240
export const SPEECH_RATE = 0.95
export const SPEECH_RATE_MIN = 0.5
export const SPEECH_RATE_MAX = 1.6
export const SPEECH_RATE_STEP = 0.1

const RATE_KEY = 'learn_app_speech_rate_v1'

export const clampRate = (rate) => {
  const value = Number(rate)
  if (!Number.isFinite(value)) return SPEECH_RATE
  const bounded = Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, value))
  return Math.round(bounded * 100) / 100
}

// Cihaz tercihi: aynı tablette her seferinde yeniden ayarlanmasın.
export const loadSpeechRate = () => {
  if (typeof localStorage === 'undefined') return SPEECH_RATE
  try {
    const stored = localStorage.getItem(RATE_KEY)
    return stored === null ? SPEECH_RATE : clampRate(stored)
  } catch (error) {
    console.error('Okuma hızı okunamadı:', error)
    return SPEECH_RATE
  }
}

export const saveSpeechRate = (rate) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RATE_KEY, String(clampRate(rate)))
  } catch (error) {
    console.error('Okuma hızı kaydedilemedi:', error)
  }
}

export const formatRate = (rate) => `${String(Number(clampRate(rate).toFixed(2)))}×`

// Saf: tarayıcı API'sine dokunmaz (Node'da da test edilebilir).
// Ayırıcı karakter (cümle sonu / satır sonu) kendisinden önceki parçada kalır,
// böylece parçaların birleşimi her zaman metnin aynısıdır (white-space: pre-wrap korunur).
const splitAtSoftBoundaries = (text, limit) => {
  const enders = new Set(['.', '!', '?', '…', ':', ';'])
  const parts = []
  let current = ''
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    current += char
    const next = text[i + 1]
    const isSentenceEnd = enders.has(char) && (next === undefined || /\s/.test(next))
    if (isSentenceEnd) {
      parts.push(current)
      current = ''
    }
  }
  if (current) parts.push(current)
  return parts.flatMap((part) => hardWrap(part, limit))
}

// Sınır bulunamazsa kelime ortasından bölmemek için son boşluğu tercih eder.
const hardWrap = (text, limit) => {
  if (text.length <= limit) return [text]
  const chunks = []
  let rest = text
  while (rest.length > limit) {
    const window = rest.slice(0, limit)
    const space = window.lastIndexOf(' ')
    const cut = space > limit * 0.5 ? space + 1 : limit
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest) chunks.push(rest)
  return chunks
}

// Metni satır sonlarına saygı göstererek seslendirme parçalarına böler.
// Safari uzun utterance'ları kesebildiği için her parça MAX_SEGMENT_LENGTH ile sınırlıdır.
export const buildSpeechSegments = (text, limit = MAX_SEGMENT_LENGTH) => {
  const source = String(text || '')
  if (!source.trim()) return []
  const segments = []
  let line = ''
  for (const char of source) {
    line += char
    if (char === '\n') {
      segments.push(line)
      line = ''
    }
  }
  if (line) segments.push(line)
  return segments.flatMap((item) => (item.length <= limit ? [item] : splitAtSoftBoundaries(item, limit)))
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

const TURKISH_HINTS = ['turkish', 'türkçe', 'yelda', 'emel', 'tolga', 'filiz']

// Türkçe ses bulunamazsa null döner; çağıran taraf lang='tr-TR' ile devam eder.
export const pickTurkishVoice = () => {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices() || []
  const describe = (voice) => `${voice.lang || ''} ${voice.name || ''}`.toLowerCase()
  return (
    voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith('tr')) ||
    voices.find((voice) => TURKISH_HINTS.some((hint) => describe(voice).includes(hint))) ||
    null
  )
}

export const stopSpeech = () => {
  if (!speechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch (error) {
    console.error('Seslendirme durdurulamadı:', error)
  }
}
