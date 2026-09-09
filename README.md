# 🎓 Sınıf Test — 1-4. Sınıf Ölçme ve Değerlendirme Platformu

Tamamı **statik** (sunucusuz) çalışan, öğretmen odaklı bir web uygulaması.
1-4. sınıf öğrencileri için **konu bazlı çoktan seçmeli testler** hazırlar, uygular,
sonuçları saklar ve **eksik konu raporu** çıkarır.

- **Sınıflar:** 1, 2, 3, 4
- **Dersler:** Matematik, Geometri, Türkçe (her ders kendi testlerine sahiptir)
- **Konular:** her soru bir konu etiketine sahiptir (örn. toplama, çarpma, şekiller, simetri, okuma-anlama…)
- **Veri:** tamamı tarayıcıda (localStorage) saklanır — sunucu/veritabanı **gerekmez**

---

## ✨ Özellikler

1. **Soru Bankası** — sınıf + ders + konu etiketli sorular; elle ekleme/düzenleme/silme,
   sınıf/ders/konu filtreleri, toplu JSON yükleme.
   - Sorulara **görsel** eklenebilir (dosya yükleme, JPEG/PNG/GIF/WebP ≤ 800 KB);
     görsel soru metninin üstünde gösterilir ve JSON dışa aktarımına gömülür.
2. **Testler** — her sınıf × ders için istenen sayıda soru içeren testler.
   - Elle soru yazarak **veya** soru bankasından seçerek oluşturulur.
   - **JSON dosyasından içe aktarılabilir** ve import sonrası editörde **elle düzenlenebilir**.
   - Her test **JSON olarak dışa aktarılabilir** (yedek/paylaşım).
   - Farklı testler **farklı sayıda soru** içerebilir.
   - Her teste **maksimum süre sınırı** (1-240 dk) tanımlanabilir; süresiz de bırakılabilir.
3. **Sınav Modu** — öğrenci seçilir, sorular tek tek cevaplanır, anında sonuç + konu dökümü gösterilir.
   - Testin süresi varsa **canlı geri sayım** gösterilir; son 1 dakikada kırmızı uyarıya döner.
   - Süre dolunca sınav **otomatik teslim edilir** ("Süre Doldu" ekranı).
   - **Her soru için harcanan süre** ölçülür ve kaydedilir.
4. **Sonuçlar** — her öğrencinin tüm denemeleri saklanır; soru bazlı inceleme (doğru/yanlış/cevap anahtarı)
   + soru başına harcanan süre.
5. **Raporlar** — öğrencinin tüm denemeleri birleştirilerek konu bazlı başarı yüzdesi hesaplanır;
   eşiğin altındaki konular **"eksik konu"** olarak işaretlenir.
   - **Süre istatistikleri:** toplam çözüm süresi, soru başına ortalama süre, test başına ortalama süre ve
     konu başına ortalama süre; 90 sn üzeri konular "yavaş" rozeti alır.
   - **Kural tabanlı rapor** (AI'sız) varsayılandır ve süre verisini de içerir.
   - **AI ile derin analiz** (OpenAI-uyumlu) isteğe bağlıdır; süre verisini yorumlar.
6. **Örnek veri** — ilk açılışta ~80 soruluk banka + 12 hazır test (her sınıf × ders) yüklenir.

## 📋 Örnek Veri

İlk açılışta otomatik yüklenir:

- **Soru bankası:** 4 sınıf × 3 ders × 6-8 soru (konu etiketli)
- **Hazır testler:** her (sınıf, ders) çifti için 1 test = 12 test

`Ayarlar → Örnek Veriyi Geri Yükle` ile tüm veri sıfırlanıp örneğe döndürülebilir.

## 🔌 JSON Şemaları

### Test içe/dışa aktarma (`kind: "test"`)

```json
{
  "version": 1,
  "kind": "test",
  "test": {
    "title": "2. Sınıf Matematik — Toplama",
    "grade": 2,
    "subject": "matematik",
    "durationMinutes": 20,
    "questions": [
      {
        "topic": "toplama",
        "text": "7 + 5 işleminin sonucu kaçtır?",
        "options": ["10", "11", "12", "13"],
        "correctIndex": 2,
        "explanation": "7 + 5 = 12",
        "image": ""
      }
    ]
  }
}
```

- `grade`: `1`-`4` • `subject`: `matematik` | `geometri` | `turkce`
- `durationMinutes` (opsiyonel): testin süre sınırı (dakika); yoksa/`null` ise süresizdir
- Her soruda: `text`, en az 2 seçenekli `options`, geçerli `correctIndex`, `topic`
- `image` (opsiyonel): soru görseli. `data:image/png;base64,...` (uygulama içinde dosya
  yüklenerek üretilir) veya `https://...` görsel adresi olabilir; boş ise görsel yoktur.
  Görsel soru metninin üstünde gösterilir. Boyut sınırı: JPEG/PNG/GIF/WebP, 800 KB.
- Hazır bir örnek: **`ornek-test-2-sinif-matematik.json`** (uygulamaya "JSON İçe Aktar" ile yüklenebilir)

### Soru bankası toplu yükleme (`kind: "questions"`)

```json
{
  "kind": "questions",
  "questions": [
    {
      "grade": 3,
      "subject": "geometri",
      "topic": "açılar",
      "text": "Dik açı kaç derecedir?",
      "options": ["45", "90", "120", "180"],
      "correctIndex": 1
    }
  ]
}
```

## 🤖 AI Raporlama (opsiyonel)

Raporlar ekranındaki **"AI ile Derin Analiz"** butonu, öğrencinin konu istatistiklerini
bir yapay zekâ modeline gönderir ve Türkçe eksik-konu analizi + öneri üretir.

- **OpenAI-uyumlu** tek arayüz: OpenAI, DeepSeek, OpenRouter, Ollama (proxy), LM Studio vb.
  `{baseUrl}/chat/completions` uç noktasını kullanan her sağlayıcı çalışır.
- Yapılandırma: `Ayarlar → AI Raporlama`
  - Sağlayıcı: OpenAI, DeepSeek, OpenRouter veya Özel
  - Base URL (örn. `https://api.openai.com/v1`, `https://api.deepseek.com/v1`,
    `https://openrouter.ai/api/v1`)
  - API anahtarı (tarayıcıda saklanır; **yalnızca bu cihazda**)
  - Model (örn. `gpt-4o-mini`, `deepseek-chat`, `openai/gpt-4o-mini`)
- OpenRouter seçildiğinde model adı genellikle `sağlayıcı/model` biçiminde yazılır
  (örn. `openai/gpt-4o-mini`). OpenRouter'ın `/api/v1/chat/completions` ve `/api/v1/models`
  uçları doğrudan kullanılabilir.
- **Anahtar yoksa veya AI çağrısı başarısızsa** kural tabanlı rapor gösterilir — uygulama tam çalışır.
- Not: Tarayıcıdan doğrudan API çağrısı bazı ağlarda CORS nedeniyle engellenebilir;
  böyle durumda CORS açık bir sağlayıcı/proxy kullanın.

## 🚀 Çalıştırma

Gereksinim: [Node.js](https://nodejs.org) 18+

```bash
npm install
npm run dev        # geliştirme: http://localhost:5173
```

## 📦 Yayınlama (ücretsiz statik hostlar)

### Netlify Drop / Vercel / GitHub Pages

```bash
npm run build      # dist/ klasörü üretilir
```

`dist/` klasörünü sürükleyip [Netlify Drop](https://app.netlify.com/drop)'a bırakın
veya GitHub Pages'e yükleyin. Sunucu kodu olmadığı için ek yapılandırma gerekmez
(router hash tabanlıdır).

### Blogger (tek sayfa)

```bash
npm run build:single   # dist-single/index.html → TEK dosya (tüm JS/CSS gömülü)
```

`dist-single/index.html` içeriğini Blogger'da yeni bir **Sayfa/HTML** olarak yapıştırın.
Tek dosya yaklaşımı sayesinde harici kaynak bağımlılığı yoktur.

## 🗄️ Veri ve Yedekleme

- Tüm veriler tarayıcının **localStorage** alanındadır (`learn_app_db_v1` anahtarı).
- **Yedek:** `Ayarlar → Veri Yönetimi → Yedeği İndir` (tüm veri tek JSON)
- **Geri yükle:** `Ayarlar → Yedekten Geri Yükle` (aynı cihazda veya başka cihazda)
- **Aktif sınav koruması:** Devam eden sınavın cevapları ve süre bilgileri geçici olarak
  `sessionStorage` içinde tutulur. Sayfa yenilenirse sınav kaldığı yerden geri yüklenir;
  sınav tamamlandığında bu taslak otomatik olarak temizlenir. Sınav devam ederken sayfa
  kapatılmak veya yenilenmek istenirse tarayıcı uyarı gösterir.
- Tarayıcı verisi temizlenirse veriler kaybolur — düzenli yedek alın.

## 🧩 Dosya Yapısı

```
src/
  main.jsx / App.jsx          giriş + hash router + düzen
  styles.css                  tema, responsive, yazdırma stilleri
  db/storage.js               localStorage, seed, yedek import/export
  data/seedQuestions.js       1-4. sınıf × 3 ders örnek soru bankası
  domain/model.js             sabitler, doğrulama, normalizasyon
  domain/scoring.js           puanlama, konu istatistikleri
  domain/report.js            kural tabanlı eksik-konu raporu
  ai/client.js                OpenAI-uyumlu AI istemci (arayüz)
  ai/prompts.js               Türkçe AI prompt şablonu
  state/store.jsx             React context + storage senkronu
  ui/screens/…                ekranlar
  ui/components/…             ortak bileşenler
```

## 🧪 Test

```bash
node verify.tmp.mjs   # çekirdek mantık (seed, puanlama, rapor, JSON round-trip) doğrulaması
```
##8.59