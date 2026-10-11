# Hızlı Kelime Akışı (RSVP) Okuma Modu

Durum: **UYGULANDI** — domain + cloud (migration/RLS/trigger) + öğretmen/öğrenci UI.
Doğrulama: `npm test` (144 kontrol, 31'i akış modu) + `bash scripts/verify-points-db.sh`
(19 SQL doğrulaması, 1'i akış modu puan kapısı).

## 1. Amaç

Öğrencinin **hızlı akan kelimelerden** ne anladığını ve hangi ayrıntıları hatırladığını ölçmek.
Metin sabit hızda kelime kelime gösterilir; akış bittikten sonra (metin bir daha gösterilmeden)
anlama soruları sorulur. Metin normal hızda okunamadığı için ölçüm, kısa süreli dikkat ve
ayrıntı hatırlamaya dayanır — mevcut "normal okuma" modunun (dwell + kaydırma + quiz) yanında
**ikinci bir gösterim modudur**, onun yerine geçmez.

## 2. Model

Okuma verisine (hem `reading_passages` kütüphanesi hem `reading_assignments` ataması) iki alan eklenir:

| Alan (DB) | Alan (JS) | Anlam |
| --- | --- | --- |
| `display_mode` | `displayMode` | `static` (varsayılan) veya `rsvp` |
| `rsvp_seconds_per_word` | `rsvpSecondsPerWord` | Kelime başına ekranda kalma süresi (sn), 0,10-5,00; varsayılan 0,80 |

Öğretmen formunda hız **"kelime başına sn"** olarak girilir (`word/xx sec`), ekranda
`1 kelime / 0,8 sn (≈ 75 kelime/dk)` biçiminde okunur. Hazır kademeler: 1,2 / 0,8 / 0,6 / 0,4 / 0,25 sn.

`reading_attempts` tablosuna eklenen tek kolon:

| Alan (DB) | Anlam |
| --- | --- |
| `rsvp_plays` | Akış kaç kez izlendi (1 = tek sefer). Ölçümün güvenilirliğini öğretmene gösterir. |

Migration: `supabase/migrations/20261013120000_rsvp_reading_mode.sql`.
Kolonlar yoksa (migration çalıştırılmadıysa) `cloud/schemaFallback.js` sorguları kolonsuz
tekrarlar, mod `static`'e düşer, öğretmen formunda uyarı görünür ve akış modu seçilemez.

## 3. Kanıt kapıları (`src/domain/readingGates.js`)

| Mod | Kapılar |
| --- | --- |
| `static` | dwell (en az okuma süresi) **+** kaydırma (metnin sonu) **+** quiz eşiği |
| `rsvp` | akış tamamlandı (`flowCompleted`) **+** quiz eşiği |

- Akış modunda `requiredDwellSeconds` (150 kelime/dk formülü) **uygulanmaz**: süre öğretmenin
  seçtiği hızdan gelir. Bu yüzden `dwellOk` ve `scrollOk` akış bayrağına bağlanır; `read`
  değişmezi (`dwellOk && scrollOk && quizOk`) aynı kalır.
- `attempts.scrolled_bottom` akış modunda **"akışın sonuna kadar izlendi"** anlamına gelir;
  raporda sütun başlığı bu yüzden "Kaydırma / akış"tır.
- Puanlar sunucuda (trigger) yazılır: `award_reading_points` artık mod farkındalıklıdır. Aksi
  halde hızlı ayarlarda dwell formülü sağlanmadığı için **tamamlanmış bir okuma sessizce
  0 puan** kazanırdı (`scripts/verify-points.sql` TEST 9 bunu doğrular).

## 4. Zamanlama: kaymayan tek saat (`src/domain/rsvp.js`)

`buildRsvpPlan(body, secondsPerWord)` metni kelimelere böler ve **kümülatif** bir plan üretir:

```
{ secondsPerWord, msPerWord, words: [{ index, text, startMs, endMs }], wordCount, totalMs }
```

`RsvpPlayer` (`src/ui/components/RsvpPlayer.jsx`) kelime başına `setTimeout` kurmaz; tek bir
`requestAnimationFrame` döngüsünde `performance.now() - başlangıç` değerini planın `startMs`
değerleriyle karşılaştırır. Böylece:

- akış **kaymaz** (kelime başına zamanlayıcıların birikmiş gecikmesi oluşmaz),
- toplam süre = `plan.totalMs` (ilk kelimeden son kelimenin bitişine kadar kesin),
- sekme arka plana alınırsa (tarayıcı rAF'i durdurur) `visibilitychange` akışı **duraklatır** —
  aksi halde geri dönüldüğünde referans saat sıçrayıp akış "izlenmeden" tamamlanırdı.

## 5. Ölçüm bütünlüğü (akış modunda kapatılanlar)

| Kapatılan | Neden |
| --- | --- |
| Quiz sırasında metin | Metni normal hızda okumak hızlı akış ölçümünü tamamen bozar |
| Sesli okuma (TTS) | Dinlemek, hızı öğrencinin kontrolüne verir |
| Metin görseli (`image`) | Görsel çoğu zaman metnin kendisidir (öğretmenler metni görsel olarak yükler) |
| Tam metnin DOM'da bulunması | Akış modunda yalnızca aktif kelime DOM'dadır; kopyalanacak bir metin yoktur |

Akış **tekrar izlenebilir** (öğrenci kaçırırsa); kaç kez izlediği `rsvp_plays` olarak kaydedilir ve
öğretmen tablosunda "İzleme" sütununda görünür. Tekrar izleme yeni metin bilgisi vermez, yalnızca
ölçümün gücünü düşürür — bu yüzden öğretmene görünür kılınmıştır.

## 6. Sorular

- Akış modunda **en fazla 3** anlama sorusu (`RSVP_QUESTION_COUNT`). Normal modda sınır 6'dır.
- Doğrulama (`validateReading`) moddan bağımsız çalışır; akış modunda 4. soru kaydı reddeder.
- Öğretmen formu sayacı `3/3` gösterir ve sınıra gelince "Soru ekle" düğmesini gizler. Mod
  değiştirilirken elde 3'ten fazla soru varsa uyarı + "İlk 3 soruyu tut" düğmesi çıkar.
- Sorular öğretmen tarafından yazılır (AI üretimi yok). Otomatik soru üretimi istenirse ayrı bir
  iş kalemidir: `api/` altında yeni bir uç nokta + prompt gerekir.

## 7. Dosya haritası

| Dosya | Rol |
| --- | --- |
| `src/domain/rsvp.js` | Saf zamanlama çekirdeği (kelime bölme, plan, indeks, etiketler) |
| `src/domain/readingGates.js` | Kapı mantığı (cloud + test aynı kodu kullanır) |
| `src/domain/model.js` | `DISPLAY_MODES`, RSVP sabitleri, doğrulama/normalizasyon, JSON alanları |
| `src/ui/components/RsvpPlayer.jsx` | Akış oynatıcısı (duraklat, ilerleme, otomatik duraklama) |
| `src/ui/screens/ReadingsScreen.jsx` | Mod seçimi + hız girişi/kademeleri + 3 soru sınırı |
| `src/ui/screens/StudentReadingScreen.jsx` | Akış fazı, akışa bağlı quiz kilidi, moda göre rozetler |
| `src/cloud/readings.js`, `src/cloud/passages.js` | Kolon eşleme + tolerans + migration ipuçları |

## 8. Doğrulama

```bash
npm test                        # 144 kontrol (31 akış modu: hız, plan, kapılar, JSON, sınırlar)
bash scripts/verify-points-db.sh # 19 SQL doğrulaması (akış modu puan kapısı dahil)
npm run build                   # üretim derlemesi
```

Bu repoda React UI için test altyapısı yoktur (bkz. `AGENTS.md`). Akış ekranının render yolu
elle şu şekilde doğrulandı: `RsvpPlayer` ve `StudentReadingScreen` esbuild ile derlenip
`react-dom/server` ile (akış öncesi / akış tamamlandı / quiz / normal mod durumlarında) render
edildi; metnin quiz sırasında DOM'da bulunmadığı, sesli okuma ve görselin çizilmediği, normal
modun bozulmadığı kontrol edildi.

## 9. Sınırlamalar

- **İstemci kanıtı:** akışın tamamlandığı istemci tarafından bildirilir; kararlı bir öğrenci
  DevTools ile `read: true` gönderebilir. Bu, `BACKLOG.md` **BL-1** ile aynı sınıftır ve akış
  modu o işi genişletmez (puanlar yine sunucu trigger'ı ile yazılır ve akış kapısı sunucuda
  doğrulanır, ama `scrolled_bottom` alanı istemci beyanıdır).
- **Erişilebilirlik:** RSVP görsel bir görevdir; kelime sahnesi ekran okuyucudan gizlenir ve
  akış yalnızca görsel hızıyla ölçülür. Ekran okuyucu kullanan öğrenciler için doğru araç
  **normal moddur** (metin + sesli okuma). Öğretmen bu modu yalnızca ölçüm amacıyla seçmelidir.
