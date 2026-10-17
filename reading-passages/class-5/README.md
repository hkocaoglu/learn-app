# 5. Sınıf Türkçe Okuma Parçaları (Maarif Modeli)

Bu klasör, 5. sınıf Türkçe için hazırlanmış okuma parçalarını ve bunların uygulamaya
doğrudan aktarılabilen JSON karşılıklarını içerir.

- `okuma-anlama-1.md`, `yardimci-dusunce-1.md` — kaynak çalışma metinleri (düz metin).
- `*.json` — `kind: "reading-passage"` şemasında, **#/okumalar → İçe aktar → Dosya seç**
  ile tek tek aktarılabilen dosyalar. Her dosya tek bir metin içerir.

## Kaynak eşleşmesi

| JSON dosyası | Konu etiketi | Soru |
| --- | --- | --- |
| `okuma-anlama-01-ataturk.json` … `okuma-anlama-10-teknoloji-ve-hayatimiz.json` | `okuma-anlama` | 6 |
| `yardimci-dusunce-a1-…` … `yardimci-dusunce-a6-gobeklitepe.json` | `yardimci-dusunce` | 1 |
| `yardimci-dusunce-b1-…` … `yardimci-dusunce-b7-gocmen-kuslar.json` | `yardimci-dusunce` | 1 |

Tüm dosyalar `grade: 5`, `subject: "turkce"`, `quizThreshold: 60`, `showPassageDuringQuiz: true`
ile üretilmiştir.

## Maarif Modeli tema uyumu

5. sınıf Türkçe dersinin (Türkiye Yüzyılı Maarif Modeli) altı teması vardır:

1. Oyun Dünyası
2. Atatürk'ü Tanımak
3. Duygularımı Tanıyorum
4. Geleneklerimiz
5. İletişim ve Sosyal İlişkiler
6. Sağlıklı Yaşıyorum

| Metin | En yakın tema | Uyum |
| --- | --- | --- |
| Mustafa Kemal Atatürk | 2 — Atatürk'ü Tanımak | Tam |
| Türk Mutfağı | 4 — Geleneklerimiz | Tam |
| İpek Yolu | 4 — Geleneklerimiz | Kısmi (kültürel miras) |
| İstanbul'un Büyüklüğü | 4 — Geleneklerimiz | Kısmi (gezi/kültür) |
| Su Kaynağı | 6 — Sağlıklı Yaşıyorum | Kısmi (çevre) |
| Ormanların Önemi | 6 — Sağlıklı Yaşıyorum | Kısmi (çevre) |
| Doğal Afetler | 6 — Sağlıklı Yaşıyorum | Kısmi (güvenlik) |
| Teknoloji ve Hayatımız | 5 — İletişim ve Sosyal İlişkiler | Kısmi |
| Uzay Keşfi | — | Tema dışı (bilgilendirici) |
| Mehmet'in Deneyi | — | Tema dışı (bilgilendirici) |
| Yardımcı düşünce metinleri (13) | — | Tema dışı (bilgilendirici); yalnızca Göbeklitepe → 4 |

**Değerlendirme.** Set, ağırlıklı olarak bilgilendirici metinlerden oluşur ve okuma
becerisinde *yüzey anlamı belirleme*, *ana fikir* ile *çıkarım yapma / ulaşılamayacak
yargıyı ayırt etme* basamaklarını çalıştırır. Buna karşılık **Tema 1 (Oyun Dünyası)** ve
**Tema 3 (Duygularımı Tanıyorum)** hiç temsil edilmez; tema 2 ve 4 dışındaki metinler
ders kitabı teması bağlamında değil, ek okuma (Okuma Keyfi) niteliğindedir. Eksik temalar
için yeni metin eklenmesi önerilir.

## Yapılan düzeltmeler

Kaynak `.md` dosyaları olduğu gibi aktarılamadı; uygulama şeması ve içerik doğruluğu
için şu düzeltmeler yapıldı:

1. **Soru sınırı.** Kaynakta her okuma-anlama metni için 8 soru vardı; uygulama en fazla 6
   soruya izin verir (`validateReading`). Her metinde 1–5. sorular ile ana fikir/sentez
   sorusu korundu, aradaki iki soru çıkarıldı.
2. **Atatürk metni (01).** Uydurma "…diye haykırarak vefat etti" ifadesi kaldırıldı;
   yerine Gençliğe Hitabe'den gerçek alıntı ve 10 Kasım 1938 tarihi eklendi. Bunlara
   dayanan iki soru (gençlere sesleniş biçimi, vefat biçimi) metinden çıkarıldı.
3. **Yazım/dil hataları.** "yüzde yetmi sudır" → "yüzde yetmişi sudur"; "Mehmet bilim
   fuarında deneyecekti" → "Mehmet bilim fuarı için bir deney hazırladı"; "Hz. altısı" gibi
   bozuk seçenekler onarıldı.
4. **Çelişkili sorular.** Su Kaynağı'nda metinle örtüşen iki doğru seçenek ("Su azalan bir
   kaynak değildir") ve çift olumsuz "Nehirleri ne yapmamalıyız?" sorusu düzeltildi/çıkarıldı.
   Uzay Keşfi'nde metinle çelişen "Uzay istasyonunda kim yaşar?" sorusu çıkarıldı.
5. **Yardımcı düşünce B bölümü.** Kaynak dosyada bu bölüm açık uçlu ("ikişer yargı yazınız")
   ve cevap anahtarı yoktu. Uygulamada açık uçlu soru tipi bulunmadığından bu metinler
   "hangisine ulaşılamaz?" biçiminde tek soruluk MCQ'ya dönüştürüldü. **A bölümündeki
   sorular kaynaktandır; B bölümündeki 7 soru bu dönüşüm için üretilmiştir.**
6. **Konu etiketi.** Sorular metinle aynı konu etiketini taşır (`okuma-anlama` /
   `yardimci-dusunce`); aksi hâlde eksik konu raporlarında "genel" altında toplanır.

## Doğrulama

Dosyalar uygulamanın kendi `importPassage` yolundan geçirilerek doğrulandı: 23/23 dosya
hatasız aktarılıyor, soru sayısı sınırı ve `correctIndex` değerleri geçerli.

```bash
node --input-type=module -e '
import {readdirSync,readFileSync} from "node:fs";
const {importPassage} = await import("./src/domain/model.js");
let ok=0,bad=0;
for (const f of readdirSync("reading-passages/class-5").filter(f=>f.endsWith(".json"))) {
  try { importPassage(readFileSync(`reading-passages/class-5/${f}`,"utf8")); ok++ }
  catch (e) { bad++; console.log(f, e.message) }
}
console.log(`ok=${ok} bad=${bad}`);
'
```

## Ek metinler (16–18) — eksik temalar

İlk sette (01–10 + yardımcı düşünce) Maarif Modeli'nin altı temasından **1. Oyun Dünyası**
ve **3. Duygularımı Tanıyorum** hiç temsil edilmiyor, **2. Atatürk'ü Tanımak** ise yalnızca
kısa metinle (01, 452 kr) yer alıyordu. Bu boşluk aşağıdaki üç metinle kapatıldı.
Metinler **MEB 5. Sınıf Türkçe Ders Kitabı**'ndan (2026-2027, 1. kitap) alınmış ve
uygulama şemasına uyarlanmıştır. Kitabın kendi etkinlik soruları **kullanılmamış**;
beşer soru bu proje için yeniden yazılmıştır.

| Dosya | Metin | Tema | Yazar | Gövde |
| --- | --- | --- | --- | --- |
| `okuma-anlama-16-topsuz-basketbol-oyunu.json` | Topsuz Basketbol Oyunu | 1 — Oyun Dünyası | Mert Arık | 2.425 kr |
| `okuma-anlama-17-her-yurege-nakis-gerek.json` | Her Yüreğe Nakış Gerek | 3 — Duygularımı Tanıyorum | Mustafa Akgün | 3.200 kr |
| `okuma-anlama-18-gazi-mustafa-kemal-ve-sigirtmac-mustafa.json` | Gazi Mustafa Kemal ve Sığırtmaç Mustafa | 2 — Atatürk'ü Tanımak | Hikmet Ulusoy | 4.688 kr |

Bu üç metin kitaptaki hâlinden **kısaltılmıştır** (`sourceLabel` alanı tema bilgisini taşır).
Uzunlukları diğerlerinden fazla olduğu için atama sırasında `minDwellSeconds` alanıyla
okuma süresi sınırlandırılabilir; aksi hâlde süre kelime sayısından (150 wpm) türetilir.

## Tema durumu (özet)

| Tema | Durum |
| --- | --- |
| 1 — Oyun Dünyası | ✅ 16 |
| 2 — Atatürk'ü Tanımak | ✅ 01 (kısa) + 18 (uzun) |
| 3 — Duygularımı Tanıyorum | ✅ 17 |
| 4 — Geleneklerimiz | ✅ 11 (Karagöz) + 03, 09 |
| 5 — İletişim ve Sosyal İlişkiler | ✅ 14 |
| 6 — Sağlıklı Yaşıyorum | ✅ 15 + 02, 05, 08 |
