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
  - Sağlayıcı: OpenAI, DeepSeek, OpenRouter, Vercel Backend (OpenRouter) veya Özel
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

### Vercel Backend ile güvenli AI çağrısı (önerilen)

Projede Next.js kullanmak zorunlu değildir. Mevcut Vite + React uygulamasına
`api/ai/report.js` adlı bir Vercel Serverless Function eklenmiştir. Bu endpoint
OpenRouter çağrısını sunucu tarafında yapar; API anahtarı tarayıcıya gönderilmez.

1. Projeyi Vercel'e bağlayın veya GitHub repository'sini Vercel'de içe aktarın.
2. Vercel proje ayarlarında şu ortam değişkenlerini tanımlayın:
   - `OPENROUTER_API_KEY`: OpenRouter API anahtarınız.
   - `OPENROUTER_MODEL`: örn. `openai/gpt-4o-mini` (opsiyonel).
   - `OPENROUTER_SITE_URL`: Vercel proje adresiniz (opsiyonel).
   - `OPENROUTER_SITE_NAME`: `Sınıf Test` (opsiyonel).
3. Deploy sonrası uygulamada `Ayarlar → AI Raporlama` bölümünden
   **Vercel Backend (OpenRouter)** sağlayıcısını seçin.
4. **Bağlantıyı Test Et** ile `/api/ai/report` endpoint'ini kontrol edin.

Vercel Functions için yerel geliştirme sırasında `vercel dev` kullanılabilir.
Normal `npm run dev` yalnızca Vite frontend'ini başlatır; backend endpoint'i
deploy edilmiş Vercel adresinde veya Vercel CLI üzerinden çalışır.

Bu ilk backend katmanı yalnızca AI anahtarını korur. Öğrenci, test ve sonuç
verileri mevcut davranış korunarak tarayıcı `localStorage` alanında tutulmaya
devam eder. Merkezi kullanıcı hesabı/veritabanı gerektiğinde ayrıca eklenebilir.

## ☁️ Supabase cloud veri altyapısı (kurulum hazırlığı)

Öğretmen hesapları, sınıflar, öğrenciler, test atamaları ve sonuçlar için
Supabase PostgreSQL şeması hazırlanmıştır. Migration dosyası:

```text
supabase/migrations/20260909140000_initial_schema.sql
```

Kurulum:

1. Supabase'te yeni bir proje oluşturun.
2. Supabase **SQL Editor** ekranında migration dosyasının tamamını çalıştırın.
3. Supabase Authentication ayarlarında email/password girişi varsayılan olarak
   etkindir. Email doğrulama davranışını **Authentication → Providers** (bazı
   dashboard sürümlerinde **Auth Providers**) ekranından kontrol edin.
4. Vercel'de şu public frontend değişkenlerini tanımlayın:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`)
5. Yalnızca serverless function'lar için şu secret değişkenlerini tanımlayın:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (`sb_secret_...`)

`SUPABASE_SECRET_KEY` kesinlikle `VITE_` ile başlamamalı ve frontend
koduna gönderilmemelidir. Bu anahtar RLS kurallarını aşabildiği için sadece
Vercel Functions ortamında tutulmalıdır.

Supabase'in yeni dashboard'ında **Settings → API Keys** altında:

- `Publishable key` frontend için güvenlidir ve `VITE_SUPABASE_PUBLISHABLE_KEY`
  olarak kullanılır.
- `Secret key` yalnızca backend içindir ve `SUPABASE_SECRET_KEY` olarak
  kullanılır.
- Proje URL'sini Supabase **Connect** dialog'undan alabilirsiniz.

Eski projelerde görülen `anon` ve `service_role` anahtarları legacy isimlerdir;
yeni projelerde publishable/secret key adlarını kullanın.

Not: **API Keys / JWT Keys** ekranı Supabase ekranıdır; Vercel environment
variable ekranı değildir. Vercel'de ilgili projeyi açıp **Settings → Environment
Variables** bölümüne aynı değerleri ekleyin. Bu bölüm görünmüyorsa Vercel
hesabında projeye erişim yetkisini veya açılan dashboard'un gerçekten Vercel
olduğunu kontrol edin.

Öğretmen e-posta/parola kayıt ve giriş ekranı Supabase Auth'a bağlanmıştır.
Supabase'te email doğrulama açıksa kayıt sonrasında doğrulama bağlantısı
gerekir. Migration çalıştırılmadan kayıt trigger'ı ve profil oluşturma akışı
çalışmayacaktır.

Bu aşamada mevcut test ve sonuç ekranlarının eski localStorage akışı tamamen
cloud repository'ye taşınmamıştır. Cloud atama akışı, seçilen testi assignment
oluşturulurken Supabase'e aktarır.

Sınıf yönetimi ve öğretmen tarafında öğrenci oluşturma akışı da Supabase'e
bağlanmıştır. `Sınıflar` ekranından sınıf oluşturabilir, `Öğrenciler`
ekranından okul numarası + ad + soyad ile öğrenci hesabı oluşturabilirsiniz.
Öğrenci hesabı için üretilen giriş kodu ve dört haneli PIN yalnızca oluşturma
ve PIN yenileme yanıtında gösterilir.

Öğrenci hesabı oluşturma endpoint'inin çalışması için Vercel'de
`SUPABASE_URL` ve `SUPABASE_SECRET_KEY` tanımlı olmalıdır. Secret key yalnızca
`api/students/provision.js` gibi serverless function'larda kullanılır; PIN
plaintext olarak veritabanına yazılmaz.

`Test Atama` ekranında sınıf ve test seçerek başlangıç/bitiş zamanı belirlenebilir.
İlk sürümde her öğrenci bir atama için yalnızca bir deneme yapabilir. Öğrenciler
giriş yaptıktan sonra `Öğrenci` sekmesinden yayınlanmış testlerini görür; cevaplar
ve sonuçlar `attempts` tablosuna RLS üzerinden kaydedilir.

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

Vercel'de GitHub repository'sini içe aktardığınızda frontend build'i otomatik
algılanır ve `api/` altındaki Serverless Function ayrıca yayınlanır. AI backend
kullanacaksanız ortam değişkenlerini Vercel dashboard'undan ekleyin; `.env`
dosyasını repository'ye commit etmeyin.

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
  lib/supabase.js             Supabase browser client yapılandırması
api/ai/report.js               Vercel Serverless Function, OpenRouter proxy
supabase/migrations/…          PostgreSQL tabloları ve RLS politikaları
  state/store.jsx             React context + storage senkronu
  ui/screens/…                ekranlar
  ui/components/…             ortak bileşenler
```

## 🧪 Test

```bash
node verify.tmp.mjs   # çekirdek mantık (seed, puanlama, rapor, JSON round-trip) doğrulaması
```
##8.59