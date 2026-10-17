# 3. Sınıf Türkçe Okuma Parçaları (Maarif Modeli)

Bu klasör, 3. sınıf Türkçe için hazırlanmış okuma parçalarını ve bunların uygulamaya
doğrudan aktarılabilen JSON karşılıklarını içerir.

Her `*.json` dosyası `kind: "reading-passage"` şemasında **tek bir metin** içerir ve
**#/okumalar → İçe aktar → Dosya seç** ile aktarılır. Tümü tek seferde
`../okumalar-class3.json` paketiyle de aktarılabilir.

Tüm dosyalar `grade: 3`, `subject: "turkce"`, `topic: "okuma-anlama"`,
`quizThreshold: 60`, `showPassageDuringQuiz: true` ile üretilmiştir.

## Maarif Modeli tema uyumu (3. sınıf — 7 tema)

| Tema | Dosya | Metin | Kaynak |
| --- | --- | --- | --- |
| 1 — Değerlerimizle Yaşıyoruz | `okuma-anlama-01-yeni-okulda-ilk-gun.json` | Yeni Okulda İlk Gün | Özgün |
| 1 — Değerlerimizle Yaşıyoruz | `okuma-anlama-03-kayip-anahtar.json` | Kayıp Anahtar | Özgün |
| 2 — Atatürk ve Kahramanlarımız | `okuma-anlama-06-ataturkun-cocuk-sevgisi.json` | Atatürk'ün Çocuk Sevgisi | MEB ders kitabı |
| 3 — Doğayı Tanıyoruz | `okuma-anlama-02-karinca-koyunde-bir-gun.json` | Karınca Köyünde Bir Gün | Özgün |
| 3 — Doğayı Tanıyoruz | `okuma-anlama-04-dedemin-bahcesindeki-fidan.json` | Dedemin Bahçesindeki Fidan | Özgün |
| 3 — Doğayı Tanıyoruz | `okuma-anlama-05-bir-damla-suyun-yolculugu.json` | Bir Damla Suyun Yolculuğu | Özgün |
| 4 — Bilgi Hazinemiz | `okuma-anlama-07-kitaplar-bize-ne-soyler.json` | Kitaplar Bize Ne Söyler? | MEB ders kitabı (Bilge Minik dergisi) |
| 5 — Yeteneklerimizi Kullanıyoruz | `okuma-anlama-09-benim-yetenegim-hangisi.json` | Benim Yeteneğim Hangisi? | Özgün |
| 6 — Bilim Yolculuğu | `okuma-anlama-10-golgem-neden-uzuyor.json` | Gölgem Neden Uzuyor? | Özgün |
| 7 — Millî Kültürümüz | `okuma-anlama-08-dun-gibi.json` | Dün Gibi | MEB ders kitabı (Özel Eğitim Çocuk dergisi) |

**Not.** 3. sınıf Türkçe ders kitabının yayımlanmış cildi yalnızca **1–4. temaları**
kapsar; 5, 6 ve 7. temalar için kitap metni bulunmadığından bu üç metin özgün olarak
yazılmıştır.

## Metin kaynakları

- **MEB ders kitabı metinleri** (06, 07, 08): *3. Sınıf Türkçe Ders Kitabı* (MEB,
  2026-2027, `cdn.eba.gov.tr`) içinden alınmış ve uygulama şemasına uyarlanmıştır.
  Metinler kitaptaki hâlinden **kısaltılmıştır**; soruların tamamı bu proje için
  yeniden yazılmıştır (kitaptaki etkinlik soruları kullanılmamıştır).
- **Özgün metinler** (01–05, 09, 10): Bu proje için yazılmıştır.

## Kalite kuralları

- Her metinde **5 soru**; sorular yüzey anlamla sınırlı değil, **çıkarım** düzeyindedir
  (sebep-sonuç, kahramanın amacı, sözün anlamı, ana fikir).
- Her soruda dört seçenek ve bir **`explanation`** (doğru cevabın gerekçesi) vardır.
- **Cevap konumları dengelidir** (A/B/C/D eşit dağılır), böylece öğrenci tek bir şıkka
  yönelmez.

## Doğrulama

Tüm dosyalar uygulamanın kendi `importPassage`/`importPassages` yolundan geçirilerek
doğrulanmıştır (soru sayısı sınırı, seçenek tipi, `correctIndex` aralığı):

```bash
node --input-type=module -e '
import {readdirSync,readFileSync} from "node:fs";
const {importPassage} = await import("./src/domain/model.js");
let ok=0,bad=0;
for (const f of readdirSync("reading-passages/class-3").filter(f=>f.endsWith(".json"))) {
  try { importPassage(readFileSync(`reading-passages/class-3/${f}`,"utf8")); ok++ }
  catch (e) { bad++; console.log(f, e.message) }
}
console.log(`ok=${ok} bad=${bad}`);
'
```

Beklenen çıktı: `ok=10 bad=0`.
