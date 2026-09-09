// OpenAI-uyumlu AI istemci katmanı.
// Tek bir arayüz: { baseUrl, apiKey, model } yapılandırmasıyla
// OpenAI, DeepSeek, OpenRouter, Ollama (proxy), LM Studio gibi /chat/completions uyumlu
// sağlayıcıların tümüyle çalışır. Tarayıcıdan çağrıldığı için CORS'a dikkat.
import { buildPrompt } from './prompts.js'

/**
 * AI istemci arayüzü (soyut sözleşme — dokümantasyon amaçlı):
 * interface AIClient {
 *   generateReport(ctx: ReportContext): Promise<{ ok: true, text: string } | { ok: false, error: string }>
 * }
 * ReportContext: { studentName, grade, subjectStats: [...], threshold, reportDate }
 */

export const OPENAI_COMPATIBLE_DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini'
}

export const OPENROUTER_DEFAULTS = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-4o-mini'
}

export const VERCEL_BACKEND_DEFAULTS = {
  baseUrl: '/api/ai/report',
  model: ''
}

export const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'openrouter', label: 'OpenRouter', ...OPENROUTER_DEFAULTS },
  { id: 'vercel', label: 'Vercel Backend (OpenRouter)', ...VERCEL_BACKEND_DEFAULTS },
  { id: 'custom', label: 'Özel (OpenAI-uyumlu)', baseUrl: '', model: '' }
]

const responseText = (content) => {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim()
}

const safeFetch = async (url, options) => {
  try {
    return { response: await fetch(url, options) }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Bilinmeyen ağ hatası'
    return { error: `Bağlantı kurulamadı: ${detail}` }
  }
}

const parseResponse = async (res) => {
  let data
  try {
    data = await res.json()
  } catch {
    return { error: 'Sunucu yanıtı JSON olarak okunamadı.' }
  }
  return { data }
}

const createVercelBackendClient = (config) => {
  const endpoint = String(config.baseUrl || VERCEL_BACKEND_DEFAULTS.baseUrl).trim()
  return {
    async generateReport(ctx) {
      if (!endpoint) return { ok: false, error: 'Vercel backend endpointi tanımlı değil.' }

      const request = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ctx,
          ...(String(config.model || '').trim() ? { model: String(config.model).trim() } : {})
        })
      })
      if (request.error) return { ok: false, error: request.error }

      const parsed = await parseResponse(request.response)
      if (parsed.error) return { ok: false, error: parsed.error }
      if (!request.response.ok) return { ok: false, error: parsed.data?.error || `Backend hatası (${request.response.status}).` }
      if (!parsed.data?.text) return { ok: false, error: 'Backend boş AI yanıtı döndü.' }
      return { ok: true, text: String(parsed.data.text).trim() }
    }
  }
}

export const createOpenAICompatibleClient = (config) => {
  const { baseUrl, apiKey, model } = config
  return {
    async generateReport(ctx) {
      if (!apiKey) return { ok: false, error: 'API anahtarı tanımlı değil.' }
      const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '')
      if (!normalizedBaseUrl) return { ok: false, error: 'AI Base URL tanımlı değil.' }
      if (!String(model || '').trim()) return { ok: false, error: 'AI modeli tanımlı değil.' }

      const request = await safeFetch(`${normalizedBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: String(model).trim(),
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content: 'Sen deneyimli bir ilkokul öğretmeni ve eğitim koçusun. Türkçe yanıt verirsin.'
            },
            {
              role: 'user',
              content: buildPrompt(ctx)
            }
          ]
        })
      })
      if (request.error) return { ok: false, error: request.error }
      const res = request.response

      if (!res.ok) {
        let detail = ''
        try {
          const err = await res.json()
          detail = err?.error?.message || err?.message || ''
        } catch {
          /* yoksay */
        }
        return { ok: false, error: `API hatası (${res.status}): ${detail}`.trim() }
      }

      const parsed = await parseResponse(res)
      if (parsed.error) return { ok: false, error: parsed.error.replace('Sunucu', 'AI') }
      const data = parsed.data
      const text = responseText(data?.choices?.[0]?.message?.content)
      if (!text) return { ok: false, error: 'AI boş yanıt döndü.' }
      return { ok: true, text }
    }
  }
}

export const createAIClient = (config) => {
  if (config?.provider === 'vercel' || config?.baseUrl === VERCEL_BACKEND_DEFAULTS.baseUrl) {
    return createVercelBackendClient(config)
  }
  // İleride başka sağlayıcılar (anthropic vb.) eklenebilir — sağlayıcı kayıt defteri
  return createOpenAICompatibleClient(config)
}
