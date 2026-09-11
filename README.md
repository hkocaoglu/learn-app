# 🎓 Sınıf Test — 1-6. Sınıf Ölçme ve Değerlendirme Platformu

Tamamı **statik** (sunucusuz) çalışan, öğretmen odaklı bir web uygulaması.
1-6. sınıf öğrencileri için **konu bazlı çoktan seçmeli testler** hazırlar, uygular,
sonuçları saklar ve **eksik konu raporu** çıkarır.

- **Sınıflar:** 1, 2, 3, 4, 5, 6
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
6. **Okuma Ödevleri (`Okuma Ata`)** — sınıfa okuma metni + anlama quizi gönderilir; öğrenci okuduğunu
   **kanıtlar**.
   - **Okuma kütüphanesi:** metin bir kez kaydedilir (başlık, kaynak, metin, sınıf düzeyi, ders,
     0-6 anlama sorusu). Kütüphaneden seçip forma yükleyerek gönderilir; aynı başlıkla yeniden
     kaydetmek kaydı **günceller**.
   - **İçe/dışa aktarma:** metinler ve soruları `kind: "reading-passage"` JSON dosyası olarak
     dışa aktarılır / içe aktarılır.
   - **Görsel (opsiyonel):** metne görsel eklenebilir — dosyadan yükleme (JPEG/PNG/GIF/WebP ≤ 800 KB)
     veya `https://` bağlantısı. Görsel metnin üstünde gösterilir, JSON dışa aktarımına gömülür ve
     öğrenci ekranında kaydırılabilir metin alanının içinde yer alır.
   - **Kanıt kapıları (üçü birlikte):** metni **sonuna kadar kaydırma** + **en az okuma süresi**
     (öğretmen belirler; boşsa kelime sayısından 150 wpm, 30-600 sn) + **quiz eşiği** (varsayılan %60).
     Süre ölçümü sekme arka plandayken durur.
   - **Sınav davranışı:** quiz, okuma süresi dolana kadar kilitlidir; öğrenci **"Teste hazırım"**
     dedikten sonra açılır. Öğretmen, metnin quiz sırasında **görünür kalmasını** seçebilir
     (görünürse geniş ekranda metin ve sorular yan yana gösterilir).
   - **Sesli dinleme:** öğrenci metni tarayıcının yerleşik Türkçe sesiyle dinleyebilir (`speechSynthesis`,
     ek anahtar/ücret yok). Metin parçalara bölünüp sırayla okunur ve okunan parça vurgulanır;
     **kanıt kapıları değişmez** (süre + kaydırma + quiz aynen gereklidir). Ses yoksa veya tarayıcı
     engellerse düğme bilgilendirir, okuma akışı bozulmaz.
   - **Raporlama:** her atama için öğrenci bazında Okundu ✓ / — , quiz yüzdesi, süre ve kaydırma
     durumu; okuma listesinde satırın görsel taşıyıp taşımadığı (**🖼 var / — yok**) görünür.
   - Aynı başlıkla yeniden gönderim atamayı **yerinde günceller** (öğrencinin okuma kanıtı silinmez).
7. **Örnek veri** — ilk açılışta ~80 soruluk banka + 12 hazır test (her sınıf × ders) yüklenir.

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

- `grade`: `1`-`6` • `subject`: `matematik` | `geometri` | `turkce`
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

### Okuma metni içe/dışa aktarma (`kind: "reading-passage"`)

`Okuma Ata` ekranındaki **İçe aktar** / **Dışa aktar** bu şemayı kullanır. İçe aktarılan metin
kütüphaneye kaydedilir (aynı başlık varsa güncellenir); öğrencilere ulaşması için ayrıca
**Okumayı sınıfa ata** ile gönderilmelidir.

```json
{
  "version": 1,
  "kind": "reading-passage",
  "passage": {
    "title": "Kırlangıç",
    "sourceLabel": "Okuma Kitabı — 2. Sınıf",
    "body": "Metnin tamamı (50-20000 karakter)...",
    "grade": 2,
    "subject": "turkce",
    "topic": "okuma-anlama",
    "quizThreshold": 60,
    "showPassageDuringQuiz": true,
    "image": "",
    "questions": [
      {
        "topic": "okuma-anlama",
        "text": "Kırlangıçlar ne zaman göç eder?",
        "options": ["İlkbaharda", "Kışın"],
        "correctIndex": 0
      }
    ]
  }
}
```

- `grade`: `1`-`6` • `subject`: `matematik` | `geometri` | `turkce` • `body`: 50-20000 karakter
- `questions` (0-6): boş bırakılabilir; quiz yoksa kanıt yalnızca süre + kaydırmaya dayanır
- `quizThreshold`: quiz geçme eşiği (%) — varsayılan `60`
- `showPassageDuringQuiz`: quiz çözülürken metin görünür kalsın mı (varsayılan `true`)
- `image` (opsiyonel): metin görseli. `data:image/...;base64,...` (dosyadan yüklenir) veya
  `https://...` bağlantısı; boş ise görsel yoktur. JPEG/PNG/GIF/WebP, 800 KB.
- Metnin en az okuma süresi atama sırasında belirlenir (`minDwellSeconds`); boşsa kelime
  sayısından 150 kelime/dk ile 30-600 sn arasında hesaplanır.

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

Bu ilk backend katmanı AI anahtarını korur. Supabase cloud kurulumu
kullanılmıyorsa öğrenci, test ve sonuç verileri geriye dönük uyumluluk için
tarayıcı `localStorage` alanında tutulmaya devam eder.

## ☁️ Supabase cloud veri altyapısı

Öğretmen hesapları, sınıflar, öğrenciler, soru bankası, testler, test atamaları
ve sonuçlar Supabase PostgreSQL üzerinde tutulabilir. Migration dosyaları:

```text
supabase/migrations/20260909140000_initial_schema.sql
supabase/migrations/20260909153500_relax_student_login_code_check.sql
supabase/migrations/20260909160000_shared_question_bank.sql
supabase/migrations/20260909164000_require_nonempty_assignment_tests.sql
supabase/migrations/20260909173000_admin_console.sql
supabase/migrations/20260910090000_reading_assignments.sql
supabase/migrations/20260910120000_reading_passage_visibility.sql
supabase/migrations/20260911080000_grades_and_passages.sql
supabase/migrations/20260911090000_reading_images.sql
```

Kurulum:

1. Supabase'te yeni bir proje oluşturun.
2. Supabase **SQL Editor** ekranında migration dosyalarını tarih sırasıyla
   çalıştırın. İlk migration daha önce çalıştırıldıysa
   `20260909153500_relax_student_login_code_check.sql` ve
   `20260909160000_shared_question_bank.sql` ile
   `20260909164000_require_nonempty_assignment_tests.sql` ile
   `20260909173000_admin_console.sql` dosyalarını çalıştırmanız yeterlidir.
   Okuma ödevleri için ayrıca `20260910090000_reading_assignments.sql`,
   `20260910120000_reading_passage_visibility.sql`,
   `20260911080000_grades_and_passages.sql` ve
   `20260911090000_reading_images.sql` dosyalarını çalıştırın.
   Görsel kolonu eklenmemişse `#/okumalar` ekranı uyarı gösterir ve görselli
   gönderim, hangi dosyanın çalıştırılacağını söyleyen bir hata verir.
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

Öğretmen giriş ekranındaki **Parolamı unuttum** bağlantısı Supabase Auth ile
parola sıfırlama e-postası gönderir. Bağlantıdaki yeni parola ekranında parola
güncellenir. Bunun çalışması için Supabase **Authentication → URL Configuration**
ekranındaki **Redirect URLs** listesine uygulamanın adresini ekleyin; örneğin
`https://learn-app-livid.vercel.app` ve yerel geliştirme için
`http://localhost:5173`.

### Admin hesabı ve admin paneli

Öğretmen hesapları için **Ayarlar** menüsü pasif tutulur. Admin hesabı
`#/admin` menüsünden öğretmenleri, sınıfları, öğrencileri, soru bankasını,
testleri, atamaları ve sonuçları salt okunur olarak görebilir; admin ayarlarına
da yalnızca bu menüdeki **Admin Ayarları** bağlantısından ulaşabilir.

Admin rolü public kayıt formundan verilemez. Güvenli kurulum sırası:

1. Normal kayıt formundan admin olarak kullanılacak e-posta hesabını oluşturun.
2. Supabase **SQL Editor** ekranında aşağıdaki sorguda e-posta adresini değiştirip
   çalıştırın:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id
     from auth.users
     where lower(email) = lower('admin@okulunuz.com')
   );
   ```

   `email` alanı eski profiller için admin migration'ı tarafından
   `auth.users` tablosundan doldurulur. Sorgu `0 rows` döndürürse önce hesabın
   oluşturulduğunu ve `20260909173000_admin_console.sql` migration'ının
   çalıştırıldığını kontrol edin.
3. Admin hesabıyla yeniden giriş yapın. Üst menüde **Admin** bağlantısı
   görünecektir.

Admin görünürlüğü yalnızca frontend kontrolüne dayanmaz. Admin migration'ı
`profiles.role` değerini genişletir, öğretmenlerin kendi rollerini yükseltmesini
engeller ve tüm admin okuma yetkilerini Supabase RLS politikalarıyla sınırlar.

Cloud öğretmen oturumunda sınıflar, öğrenciler, soru bankası, testler ve sonuçlar
giriş yapan öğretmenin `auth.uid()` değeriyle sınırlandırılır. Soru bankasındaki
bir soru **Öğretmenlerle paylaş** seçeneğiyle diğer öğretmenlere salt okunur
olarak açılabilir; paylaşan öğretmen soru üzerinde düzenleme ve silme yetkisini
korur. Migration çalıştırılmamış bir projede soru bankası yüklenirken migration
dosyasının çalıştırılması gerektiği belirtilen bir hata gösterilir.

Öğretmen portalındaki **Uygula** akışı da cloud ile uyumludur. Test doğrudan
uygulanıyorsa seçilen öğrenci ve test için görünmez bir assignment kaydı
oluşturulur; böylece `attempts.assignment_id` zorunluluğu korunurken test
öğrenci portalında kendiliğinden yayınlanmaz.

Sınıf yönetimi ve öğretmen tarafında öğrenci oluşturma akışı da Supabase'e
bağlanmıştır. `Sınıflar` ekranından sınıf oluşturabilir, `Öğrenciler`
ekranından okul numarası + ad + soyad ile öğrenci hesabı oluşturabilirsiniz.
Öğrenci hesabı için üretilen giriş kodu ve Supabase Auth ile uyumlu altı haneli
PIN yalnızca oluşturma ve PIN yenileme yanıtında gösterilir.

Öğrenci giriş kodu okul numarası ile ad ve soyadın ilk harflerinden oluşur
(`12ac` gibi). Bu nedenle kod uzunluğu en az üç karakter olacak şekilde
doğrulanır.

Öğrenci hesabı oluşturma endpoint'inin çalışması için Vercel'de
`SUPABASE_URL` ve `SUPABASE_SECRET_KEY` tanımlı olmalıdır. Secret key yalnızca
`api/students/provision.js` gibi serverless function'larda kullanılır; PIN
plaintext olarak veritabanına yazılmaz.

`Test Atama` ekranında sınıf ve test seçerek başlangıç/bitiş zamanı belirlenebilir.
İlk sürümde her öğrenci bir atama için yalnızca bir deneme yapabilir. Öğrenciler
giriş yaptıktan sonra `Öğrenci` sekmesinden yayınlanmış testlerini görür; cevaplar
ve sonuçlar `attempts` tablosuna RLS üzerinden kaydedilir.
Soru içermeyen testler atama listesinde gösterilmez; ayrıca istemci ve Supabase
trigger katmanında da engellenir.

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

- Supabase cloud oturumunda sınıflar, öğrenciler, soru bankası, testler,
  atamalar ve sonuçlar sunucuda tutulur. Aynı öğretmenin tarayıcı önbelleği
  ayrıca öğretmen kullanıcı kimliğiyle ayrı bir anahtar altında tutulur.
  Ayarlar ve AI rapor geçmişi şu an öğretmen kapsamlı tarayıcı depolamasında
  tutulur; API anahtarları server'a gönderilmez.
- Supabase yapılandırılmamış yerel modda veriler tarayıcının **localStorage**
  alanındadır (`learn_app_db_v1` anahtarı).
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