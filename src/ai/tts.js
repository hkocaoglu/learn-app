// Sunucu taraflı seslendirme istemcisi.
// API anahtarı sunucuda (Vercel ortam değişkenleri) kalır; tarayıcı yalnızca metin gönderir.
// Sağlayıcı yapılandırılmamışsa { ok: false, unavailable: true } döner ve ekran
// otomatik olarak tarayıcının yerleşik sesine düşer.

export const TTS_ENDPOINT = '/api/tts/speak'

export const synthesizeSpeech = async ({ text, speed }) => {
  try {
    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speed })
    })

    // 503: anahtar yok • 404/501: endpoint yok (yerel vite) → bulut kullanılamıyor
    if (response.status === 503 || response.status === 501 || response.status === 404) {
      return { ok: false, unavailable: true, error: 'Sunucu seslendirmesi yapılandırılmamış.' }
    }

    const contentType = String(response.headers.get('content-type') || '')
    // Yerel geliştirmede /api/* SPA'nın HTML'ini dönebilir; ses sanıp çalmayalım.
    if (!contentType.startsWith('audio/')) {
      if (!response.ok) {
        let message = `Seslendirme başarısız (${response.status})`
        try {
          const data = await response.json()
          if (data && data.error) message = data.error
        } catch {
          /* gövde JSON değilse varsayılan mesaj kalır */
        }
        return { ok: false, error: message }
      }
      return { ok: false, unavailable: true, error: 'Seslendirme sunucusu ses döndürmedi.' }
    }

    const blob = await response.blob()
    if (!blob.size) return { ok: false, error: 'Ses verisi boş geldi.' }
    return { ok: true, blob }
  } catch {
    return { ok: false, unavailable: true, error: 'Seslendirme sunucusuna ulaşılamadı.' }
  }
}
