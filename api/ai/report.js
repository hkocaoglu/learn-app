import { buildPrompt } from '../../src/ai/prompts.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4o-mini'

const sendJson = (res, status, body) => {
  res.status(status).json(body)
}

const responseText = (content) => {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim()
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
    const body = await response.json()
    return body?.error?.message || body?.message || ''
  } catch {
    return ''
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return sendJson(res, 204, {})
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  const model = String(process.env.OPENROUTER_MODEL || DEFAULT_MODEL).trim()

  if (req.method === 'GET') {
    if (!apiKey) return sendJson(res, 503, { error: 'OPENROUTER_API_KEY ortam değişkeni tanımlı değil.' })
    return sendJson(res, 200, { ok: true, provider: 'openrouter', model })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return sendJson(res, 405, { error: 'Yalnızca GET ve POST istekleri desteklenir.' })
  }

  if (!apiKey) return sendJson(res, 503, { error: 'OPENROUTER_API_KEY ortam değişkeni tanımlı değil.' })

  const body = readBody(req.body)
  if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'Geçerli bir JSON gövdesi gönderin.' })
  if (typeof body.studentName !== 'string' || !body.studentName.trim()) {
    return sendJson(res, 400, { error: 'studentName alanı zorunludur.' })
  }
  if (!Array.isArray(body.subjectStats)) {
    return sendJson(res, 400, { error: 'subjectStats alanı dizi olmalıdır.' })
  }

  const requestedModel = typeof body.model === 'string' ? body.model.trim() : ''
  const selectedModel = requestedModel || model
  if (!selectedModel) return sendJson(res, 500, { error: 'OpenRouter modeli tanımlı değil.' })

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-OpenRouter-Title': process.env.OPENROUTER_SITE_NAME || 'Sınıf Test'
  }
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL

  let upstream
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: selectedModel,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: 'Sen deneyimli bir ilkokul öğretmeni ve eğitim koçusun. Türkçe yanıt verirsin.'
          },
          {
            role: 'user',
            content: buildPrompt(body)
          }
        ]
      })
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Bilinmeyen ağ hatası'
    return sendJson(res, 502, { error: `OpenRouter bağlantısı kurulamadı: ${detail}` })
  }

  if (!upstream.ok) {
    const detail = await readUpstreamError(upstream)
    return sendJson(res, upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502, {
      error: `OpenRouter API hatası (${upstream.status})${detail ? `: ${detail}` : ''}`
    })
  }

  let data
  try {
    data = await upstream.json()
  } catch {
    return sendJson(res, 502, { error: 'OpenRouter yanıtı JSON olarak okunamadı.' })
  }

  const text = responseText(data?.choices?.[0]?.message?.content)
  if (!text) return sendJson(res, 502, { error: 'OpenRouter boş yanıt döndü.' })

  return sendJson(res, 200, { ok: true, text, model: selectedModel })
}
