// Seslendirme (TTS) proxy'si: API anahtarı tarayıcıya gitmesin diye sunucu tarafında çağrılır.
//
// Sağlayıcı seçimi ortam değişkeniyle yapılır (Ayarlar ekranı admin'e kapalı olduğu için):
//   TTS_PROVIDER=azure|google   (varsayılan: azure)
//   Azure:  AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_SPEECH_VOICE (varsayılan tr-TR-AhmetNeural)
//   Google: GOOGLE_TTS_API_KEY, GOOGLE_TTS_VOICE (varsayılan tr-TR-Wavenet-B)
//
// Anahtar tanımlı değilse 503 döner; öğrenci ekranı otomatik olarak tarayıcı sesine düşer.

const DEFAULT_PROVIDER = 'azure'
const DEFAULT_AZURE_VOICE = 'tr-TR-AhmetNeural'
const DEFAULT_GOOGLE_VOICE = 'tr-TR-Wavenet-B'
const MAX_TEXT_LENGTH = 2000

const sendJson = (res, status, body) => {
  res.status(status).json(body)
}

const readBody = (body) => {
  if (!body) return null
  if (typeof body === 'object') return body
  if (typeof body !== 'string') return null
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

const readUpstreamError = async (response) => {
  try {
    const text = await response.text()
    return String(text || '').slice(0, 300)
  } catch {
    return ''
  }
}

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

// Azure: SSML ile düz metin → MP3 (nöral sesler)
const synthesizeAzure = async ({ text, speed }) => {
  const key = process.env.AZURE_SPEECH_KEY
  const region = String(process.env.AZURE_SPEECH_REGION || '').trim()
  const voice = String(process.env.AZURE_SPEECH_VOICE || DEFAULT_AZURE_VOICE).trim()
  if (!region) throw new Error('AZURE_SPEECH_REGION tanımlı değil.')

  const ratePercent = Math.round((Number(speed) || 1) * 100 - 100)
  const ssml =
    `<speak version="1.0" xml:lang="tr-TR"><voice name="${escapeXml(voice)}">` +
    `<prosody rate="${ratePercent >= 0 ? '+' : ''}${ratePercent}%">${escapeXml(text)}</prosody>` +
    '</voice></speak>'

  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'sinif-test'
    },
    body: ssml
  })

  if (!response.ok) throw new Error(`Azure TTS hatası (${response.status}): ${await readUpstreamError(response)}`)
  return Buffer.from(await response.arrayBuffer())
}

// Google Cloud TTS: REST v1 text:synthesize → MP3
const synthesizeGoogle = async ({ text, speed }) => {
  const key = process.env.GOOGLE_TTS_API_KEY
  const voice = String(process.env.GOOGLE_TTS_VOICE || DEFAULT_GOOGLE_VOICE).trim()

  const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'tr-TR', name: voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: Number(speed) || 1 }
    })
  })

  if (!response.ok) throw new Error(`Google TTS hatası (${response.status}): ${await readUpstreamError(response)}`)
  const data = await response.json()
  if (!data || typeof data.audioContent !== 'string' || !data.audioContent) {
    throw new Error('Google TTS boş ses döndü.')
  }
  return Buffer.from(data.audioContent, 'base64')
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(204).end()
  }

  if (req.method === 'GET') {
    const provider = String(process.env.TTS_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase()
    const configured =
      provider === 'google'
        ? Boolean(process.env.GOOGLE_TTS_API_KEY)
        : Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION)
    return sendJson(res, 200, { ok: true, provider, configured })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return sendJson(res, 405, { error: 'Yalnızca POST desteklenir.' })
  }

  const provider = String(process.env.TTS_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase()
  const azureReady = Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION)
  const googleReady = Boolean(process.env.GOOGLE_TTS_API_KEY)

  if (provider === 'google' ? !googleReady : !azureReady) {
    return sendJson(res, 503, {
      error:
        provider === 'google'
          ? 'GOOGLE_TTS_API_KEY ortam değişkeni tanımlı değil.'
          : 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION ortam değişkenleri tanımlı değil.'
    })
  }

  const body = readBody(req.body)
  if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'Geçerli bir JSON gövdesi gönderin.' })
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return sendJson(res, 400, { error: 'text alanı zorunludur.' })
  if (text.length > MAX_TEXT_LENGTH) {
    return sendJson(res, 413, { error: `Metin çok uzun (en fazla ${MAX_TEXT_LENGTH} karakter).` })
  }

  const speed = Number(body.speed) > 0 ? Number(body.speed) : 1

  let audio
  try {
    audio =
      provider === 'google'
        ? await synthesizeGoogle({ text, speed })
        : await synthesizeAzure({ text, speed })
  } catch (error) {
    return sendJson(res, 502, { error: `Ses üretilemedi: ${error.message}` })
  }

  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Length', String(audio.length))
  res.setHeader('Cache-Control', 'private, max-age=86400')
  return res.status(200).send(audio)
}
