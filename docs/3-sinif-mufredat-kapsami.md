# 3. Sınıf Müfredat Kapsamı ve Test Envanteri

> **Amaç:** MEB 3. sınıf öğretim programlarını kaynağından doğrulayıp, uygulamada hangi derslerden
> test üretildiğini ve MEB tema/ünitelerinin ne kadarının kapsandığını tek yerde takip etmek.
>
> **Kaynaklar (son kontrol: 2025-2026 eğitim öğretim yılı):**
> - Türkiye Yüzyılı Maarif Modeli öğretim programları — <https://tymm.meb.gov.tr/ogretim-programlari>
>   (3. sınıf: [Matematik](https://tymm.meb.gov.tr/ogretim-programlari/ilkokul-matematik-dersi/4),
>   [Türkçe](https://tymm.meb.gov.tr/ogretim-programlari/ilkokul-turkce-dersi/4),
>   [Hayat Bilgisi](https://tymm.meb.gov.tr/ogretim-programlari/hayat-bilgisi-dersi/4),
>   [Fen Bilimleri](https://tymm.meb.gov.tr/ogretim-programlari/fen-bilimleri-dersi/4),
>   [İngilizce](https://tymm.meb.gov.tr/ogretim-programlari/ingilizce-dersi-temel-egitim/4))
> - İlköğretim Kurumları (İlkokul ve Ortaokul) Haftalık Ders Çizelgesi, TTKB 4 no'lu karar (2025) —
>   <https://ttkb.meb.gov.tr/meb_iys_dosyalar/2025_05/16094742_4nolukararilkogretimkurumlariilkokulveortaokulhaftalikderscizelgesi.pdf>

## 1. 3. sınıfta okutulan dersler (2025-2026)

| Ders | Test edilebilir? | Uygulamadaki ders kodu | Durum |
| --- | --- | --- | --- |
| Türkçe | Evet | `turkce` | ⚠️ test yok |
| Matematik | Evet | `matematik` (+ `geometri`) | ✅ 9 test / 128 soru |
| Hayat Bilgisi | Evet | `hayat-bilgisi` | ❌ test yok |
| Fen Bilimleri | Evet | `fen-bilimleri` | ❌ test yok |
| Yabancı Dil (İngilizce) | Evet | `yabanci-dil` | ❌ test yok |
| Görsel Sanatlar | Hayır (beceri dersi) | — | kapsam dışı |
| Müzik | Hayır (beceri dersi) | — | kapsam dışı |
| Beden Eğitimi ve Oyun | Hayır (beceri dersi) | — | kapsam dışı |
| Serbest Etkinlikler (masal ve geleneksel oyun) | Hayır | — | kapsam dışı |

Toplam süre: 3. sınıf **30 ders saati**. Serbest Etkinlikler 2 ve 3. sınıflarda 1 ders saati olup
"masal ve geleneksel oyun" saatidir.

Uygulamada sınıf filtresi (`SUBJECT_GRADES`) 3. sınıf için şu dersleri gösterir:
`turkce`, `matematik`, `geometri`, `hayat-bilgisi`, `fen-bilimleri`, `yabanci-dil`.

## 2. MEB temaları ↔ bizim sorularımız

### 2.1 Matematik — 6 tema (✅ tümü en az kısmi kapsandı)

| # | MEB teması | Kapsam | Kaynak (test/soru) |
| --- | --- | --- | --- |
| 1 | Sayılar ve Nicelikler (1) — 1000'e kadar sayılar, basamak değeri, çözümleme, sıralama | ✅ tam | `3-sinif-muhakeme-1-sayilar` (15), seed `sayılar` (1) |
| 2 | Sayılar ve Nicelikler (2) — ritmik sayma, örüntü, sayı ilişkileri | ✅ tam | `3-sinif-muhakeme-7-mantik-oruntu` (örüntüler) |
| 3 | İşlemlerden Cebirsel Düşünmeye — toplama/çıkarma/çarpma/bölme, eşitlik | ✅ tam | `-2-toplama-cikarma` (15), `-3-carpma-bolme` (15), seed `çarpma/bölme` (4) |
| 4 | Nesnelerin Geometrisi (1) — şekiller, açı, simetri | ⚠️ kısmi | yalnızca seed `geometri` (6); ayrı test yok |
| 5 | Nesnelerin Geometrisi (2) — çevre, alan, cisimler | ⚠️ zayıf | seed `alan` (1); çevre/cisim sorusu yok |
| 6 | Veriye Dayalı Araştırma — tablo, grafik, yorumlama | ✅ tam | `3-sinif-muhakeme-6-veri-tablo` (15) |
| — | Ölçme (uzunluk, kütle, sıvı, zaman, para) | ✅ tam | `3-sinif-muhakeme-5-olcme` (15), seed `uzunluk` (1) |
| — | Kesirler (MEB'de sayılar teması içinde) | ✅ tam | `3-sinif-kesir-problemleri` (15), `3-sinif-kesir-resimli` (8), `-4-kesirler` (15) |
| — | Mantık/muhakeme (MEB beceri alanı) | ✅ tam | `3-sinif-muhakeme-7-mantik-oruntu` (15) |

### 2.2 Türkçe — 7 tema (❌ test yok, yalnızca 7 seed sorusu)

MEB temaları: 1) Değerlerimizle Yaşıyoruz, 2) Atatürk ve Kahramanlarımız, 3) Doğayı Tanıyoruz,
4) Bilgi Hazinemiz, 5) Yeteneklerimizi Kullanıyoruz, 6) Bilim Yolculuğu, 7) Millî Kültürümüz.

Elimizde: seed `okuma-anlama` (2), `dil bilgisi` (2), `yazım kuralları` (1), `noktalama` (1),
`eş ve zıt anlam` (1). Ayrıca `reading-passages/class-3/` altında okuma-anlama metinleri var —
bunlar **okuma görevi**, çoktan seçmeli test değil.

### 2.3 Hayat Bilgisi — 6 öğrenme alanı (❌ tamamen kapsam dışı)

1) Ben ve Okulum, 2) Sağlığım ve Güvenliğim, 3) Ailem ve Toplum, 4) Yaşadığım Yer ve Ülkem,
5) Doğa ve Çevre, 6) Bilim, Teknoloji ve Sanat. Hiç soru/test yok.

### 2.4 Fen Bilimleri — 8 ünite (❌ tamamen kapsam dışı)

1) Bilimsel Keşif Yolculuğu, 2) Canlılar Dünyasına Yolculuk, 3) Yer Bilimciler İş Başında,
4) Maddeyi Tanıyalım, Karıştırıp Ayıralım, 5) Hareketi Keşfediyorum, 6) Yaşamımızı
Kolaylaştıran Elektrik, 7) Toprağı Tanıyorum, Tarımı Keşfediyorum, 8) Canlıların Yaşam
Alanlarına Yolculuk. Hiç soru/test yok.

### 2.5 İngilizce (Yabancı Dil) — temalar (❌ tamamen kapsam dışı)

Theme 1 School Life, 2 Classroom Life, 3 Personal Life, 4 Family Life,
5 Homes & Houses & The Neighbourhood (…). Hiç soru/test yok.

## 3. Test envanteri (3. sınıf)

| Dosya | Ders | Konu etiketi | Soru |
| --- | --- | --- | --- |
| `ornek-test-3-sinif-kesir-problemleri.json` | matematik | kesirler | 15 |
| `ornek-test-3-sinif-kesir-resimli.json` | matematik | kesirler (SVG görselli) | 8 |
| `ornek-testler/3-sinif-muhakeme-1-sayilar.json` | matematik | sayilar | 15 |
| `ornek-testler/3-sinif-muhakeme-2-toplama-cikarma.json` | matematik | problemler | 15 |
| `ornek-testler/3-sinif-muhakeme-3-carpma-bolme.json` | matematik | carpma-bolme | 15 |
| `ornek-testler/3-sinif-muhakeme-4-kesirler.json` | matematik | kesirler | 15 |
| `ornek-testler/3-sinif-muhakeme-5-olcme.json` | matematik | olcme | 15 |
| `ornek-testler/3-sinif-muhakeme-6-veri-tablo.json` | matematik | veri | 15 |
| `ornek-testler/3-sinif-muhakeme-7-mantik-oruntu.json` | matematik | mantik | 15 |
| **Toplam** | | | **128** |

Ayrıca uygulama ilk açılışta 3. sınıf için 19 seed sorusu yükler: `matematik` (6),
`geometri` (6), `turkce` (7). Bunlar test değil, soru bankası tohumudur.

## 4. Öncelikli eksikler

1. **Türkçe testleri** — 3. sınıfın en yüksek saatli dersi; okuma-anlama + dil bilgisi + yazım.
2. **Fen Bilimleri testleri** — 8 ünitenin tamamı boş.
3. **Hayat Bilgisi testleri** — 6 öğrenme alanının tamamı boş.
4. **İngilizce testleri** — kelime/dil bilgisi düzeyinde başlanabilir.
5. **Geometri testleri** — MEB'in 4. ve 5. teması (şekiller, açı, simetri, çevre, alan) ayrı test
   olarak yok; yalnızca seed soruları var.

## 5. Notlar

- MEB programlarında "geometri" ayrı bir ders değildir; Matematik'in 4. ve 5. temasıdır. Uygulamada
  `geometri` ayrı ders kodu olarak korunuyor (geriye dönük uyumluluk).
- Ölçme kazanımları yeni programda temaların içine dağıtılmıştır; pratikte "Ölçme" başlığı altında
  toplanmıştır.
- Test soruları 4 seçenekli olup her soruda açıklama ve konu etiketi bulunur.
