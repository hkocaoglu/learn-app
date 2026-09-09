// 1-4. sınıf × 3 ders için örnek soru bankası (Türkçe MEB müfredatına uygun seviye)
// Her soru: { subject, grade, topic, text, options, correctIndex, explanation }

const mk = (subject, grade, topic, text, options, correctIndex, explanation = '') => ({
  subject,
  grade,
  topic,
  text,
  options,
  correctIndex,
  explanation
})

export const SEED_QUESTIONS = [
  // ════════════ 1. SINIF ════════════
  // --- Matematik ---
  mk('matematik', 1, 'sayılar', 'Aşağıdaki sayılardan hangisi en büyüktür?', ['4', '7', '9', '5'], 2, '9, verilen sayıların en büyüğüdür.'),
  mk('matematik', 1, 'sayılar', '10 sayısından bir önce gelen sayı hangisidir?', ['11', '9', '8', '12'], 1, '10 sayısından bir önce gelen sayı 9\'dur.'),
  mk('matematik', 1, 'toplama', '3 + 4 işleminin sonucu kaçtır?', ['6', '8', '7', '9'], 2, '3 + 4 = 7 eder.'),
  mk('matematik', 1, 'çıkarma', '8 - 3 işleminin sonucu kaçtır?', ['4', '5', '6', '3'], 1, '8 - 3 = 5 eder.'),
  mk('matematik', 1, 'toplama', 'Annem marketten 5 yumurta, sonra 4 yumurta daha aldı. Toplam kaç yumurta aldı?', ['8', '10', '7', '9'], 3, '5 + 4 = 9 yumurta.'),
  mk('matematik', 1, 'çıkarma', 'Sepette 9 elma vardı. 4 elma yedik. Geriye kaç elma kaldı?', ['5', '4', '6', '3'], 0, '9 - 4 = 5 elma kaldı.'),
  // --- Geometri ---
  mk('geometri', 1, 'şekiller', 'Aşağıdakilerden hangisi üçgendir?', ['⬜ Kare', '⬤ Daire', '△ Üçgen', '⬛ Dikdörtgen'], 2, 'Üç kenarı ve üç köşesi olan şekle üçgen denir.'),
  mk('geometri', 1, 'şekiller', 'Bir karenin kaç kenarı vardır?', ['3', '4', '5', '6'], 1, 'Kare 4 kenarlıdır.'),
  mk('geometri', 1, 'şekiller', 'Aşağıdakilerden hangisi köşesi olmayan bir şekildir?', ['Üçgen', 'Kare', 'Dikdörtgen', 'Daire'], 3, 'Dairenin köşesi ve kenarı yoktur.'),
  mk('geometri', 1, 'uzunluk', 'En kısa olan hangisidir?', ['1 m ip', '50 cm ip', '80 cm ip', '100 cm ip'], 1, '50 cm en kısadır. 1 m = 100 cm\'dir.'),
  mk('geometri', 1, 'simetri', 'Aşağıdaki harflerden hangisi simetriktir (ortadan ikiye katlanınca tam eşleşir)?', ['A', 'S', 'Z', 'J'], 0, 'A harfi dikey eksende simetriktir.'),
  mk('geometri', 1, 'şekiller', 'Bir üçgenin kaç köşesi vardır?', ['3', '4', '2', '5'], 0, 'Üçgenin 3 köşesi vardır.'),
  // --- Türkçe ---
  mk('turkce', 1, 'hece bilgisi', '"kalem" kelimesi kaç heceden oluşur?', ['1', '2', '3', '4'], 1, 'ka-lem → 2 hece.'),
  mk('turkce', 1, 'dil bilgisi', '"Kediler bahçede oynuyor." cümlesinde kaç kelime vardır?', ['2', '3', '4', '5'], 1, 'Kediler / bahçede / oynuyor → 3 kelime.'),
  mk('turkce', 1, 'yazım kuralları', 'Aşağıdaki kelimelerden hangisi büyük harfle başlamalıdır?', ['elma', 'ankara', 'kalem', 'masa'], 1, 'Özel isim olan "Ankara" büyük harfle başlar.'),
  mk('turkce', 1, 'okuma-anlama', '"Ali topu bahçede oynarken yere düşürdü." Ali topu nerede düşürdü?', ['Evde', 'Okulda', 'Bahçede', 'Parkta'], 2, 'Cümlede bahçede oynadığı söyleniyor.'),
  mk('turkce', 1, 'hece bilgisi', '"Anne" kelimesindeki sesli harfler hangileridir?', ['a, e', 'n, n', 'a, n', 'e, n'], 0, 'Anne kelimesindeki sesli harfler a ve e\'dir.'),
  mk('turkce', 1, 'dil bilgisi', 'Aşağıdakilerden hangisi bir varlığın adıdır (isim)?', ['Koştu', 'Güzel', 'Kitap', 'Hızlı'], 2, 'Kitap bir varlığın adıdır.'),
  mk('turkce', 1, 'okuma-anlama', '"Küçük kuzu annesini arıyordu." Cümlede kimi arıyordu?', ['Babamı', 'Annesini', 'Kardeşini', 'Çobanı'], 1, 'Kuzu annesini arıyordu.'),

  // ════════════ 2. SINIF ════════════
  // --- Matematik ---
  mk('matematik', 2, 'toplama', '27 + 15 işleminin sonucu kaçtır?', ['32', '42', '43', '41'], 1, '27 + 15 = 42.'),
  mk('matematik', 2, 'çıkarma', '54 - 28 işleminin sonucu kaçtır?', ['26', '24', '36', '25'], 0, '54 - 28 = 26.'),
  mk('matematik', 2, 'toplama', 'Bir sınıfta 19 kız, 16 erkek öğrenci vardır. Sınıf mevcudu kaçtır?', ['33', '34', '35', '36'], 2, '19 + 16 = 35 öğrenci.'),
  mk('matematik', 2, 'çıkarma', 'Kumbaramda 50 TL vardı. 35 TL harcadım. Geriye kaç TL kaldı?', ['10', '15', '20', '25'], 1, '50 - 35 = 15 TL.'),
  mk('matematik', 2, 'sayılar', 'Sayıları küçükten büyüğe sıralayınız: 34, 43, 29', ['34 - 43 - 29', '29 - 34 - 43', '43 - 34 - 29', '29 - 43 - 34'], 1, '29 < 34 < 43.'),
  mk('matematik', 2, 'sayılar', '37 sayısının onlar basamağındaki rakam kaçtır?', ['3', '7', '30', '70'], 0, '37\'de onlar basamağı 3\'tür (3 onluk).'),
  // --- Geometri ---
  mk('geometri', 2, 'şekiller', 'Dikdörtgenin kaç kenarı ve kaç köşesi vardır?', ['3 kenar, 3 köşe', '4 kenar, 4 köşe', '4 kenar, 3 köşe', '5 kenar, 4 köşe'], 1, 'Dikdörtgenin 4 kenarı ve 4 köşesi vardır.'),
  mk('geometri', 2, 'uzunluk', 'Bir karış yaklaşık olarak ne ile ölçülür?', ['Cetvelle', 'El ile', 'Metre ile', 'Kilometre ile'], 1, 'Karış, el ile yapılan ölçüdür.'),
  mk('geometri', 2, 'uzunluk', '1 metre kaç santimetredir?', ['10 cm', '50 cm', '100 cm', '1000 cm'], 2, '1 m = 100 cm.'),
  mk('geometri', 2, 'simetri', 'Aşağıdaki şekillerden hangisi iki eş parçaya katlanabilir (simetriktir)?', ['Kalp', 'Ok işareti', 'Yıldız', 'El'], 0, 'Kalp şekli dikey eksende simetriktir.'),
  mk('geometri', 2, 'şekiller', 'Üçgen, kare ve daireden hangisinin kenar sayısı en fazladır?', ['Üçgen', 'Kare', 'Daire', 'Hepsi aynı'], 1, 'Kare 4 kenarlıdır; üçgen 3, dairenin kenarı yoktur.'),
  mk('geometri', 2, 'uzunluk', 'Sınıf tahtasının uzunluğunu ölçmek için hangi araç uygundur?', ['Karış', 'Kulaç', 'Metre', 'Adım'], 2, 'Uzunluklar metre ile ölçülür.'),
  // --- Türkçe ---
  mk('turkce', 2, 'eş ve zıt anlam', '"Kara" kelimesinin zıt anlamlısı hangisidir?', ['Siyah', 'Beyaz', 'Gece', 'Kötü'], 1, 'Kara (siyah) kelimesinin zıt anlamlısı ak (beyaz)\'dır.'),
  mk('turkce', 2, 'eş ve zıt anlam', '"Büyük" kelimesinin zıt anlamlısı hangisidir?', ['Kocaman', 'İri', 'Küçük', 'Uzun'], 2, 'Büyük - küçük zıt anlamlıdır.'),
  mk('turkce', 2, 'dil bilgisi', '"çocuklar" kelimesinin sonuna hangi ek gelirse "çocuğun" olur?', ['-lar', '-ın', '-a', '-dan'], 1, 'çocuk + -ın = çocuğun (iyelik eki).'),
  mk('turkce', 2, 'okuma-anlama', '"Kitap okumayı çok seven Elif, her akşam bir hikaye bitiriyor." Elif neyi çok seviyor?', ['Resim yapmayı', 'Oyun oynamayı', 'Kitap okumayı', 'Şarkı söylemeyi'], 2, 'Elif kitap okumayı seviyor.'),
  mk('turkce', 2, 'yazım kuralları', 'Aşağıdaki cümlelerin hangisinde yazım yanlışı vardır?', ['Bugün hava çok güzel.', 'Ayşe okula gitti.', 'istanbul büyük bir şehirdir.', 'Kitabımı evde unuttum.'], 2, 'Özel isim "İstanbul" büyük harfle yazılmalıdır.'),
  mk('turkce', 2, 'noktalama', 'Cümlenin sonuna hangi noktalama işareti gelir?', ['Virgül (,)', 'Nokta (.)', 'Soru işareti (?)', 'İki nokta (:)'], 1, 'Cümle sonuna nokta konur.'),
  mk('turkce', 2, 'dil bilgisi', '"Yorgun" kelimesinin zıt anlamlısı hangisidir?', ['Uykulu', 'Bitkin', 'Dinç', 'Hasta'], 2, 'Yorgun kelimesinin zıt anlamlısı dinçtir.'),

  // ════════════ 3. SINIF ════════════
  // --- Matematik ---
  mk('matematik', 3, 'çarpma', '6 × 7 işleminin sonucu kaçtır?', ['36', '42', '48', '40'], 1, '6 × 7 = 42.'),
  mk('matematik', 3, 'bölme', '48 ÷ 6 işleminin sonucu kaçtır?', ['6', '7', '8', '9'], 2, '48 ÷ 6 = 8.'),
  mk('matematik', 3, 'çarpma', 'Bir kutuya 8 yumurta konuyor. 5 kutuda kaç yumurta olur?', ['35', '40', '42', '45'], 1, '8 × 5 = 40 yumurta.'),
  mk('matematik', 3, 'bölme', '36 kalemi 4 arkadaşa eşit paylaştırırsak her birine kaç kalem düşer?', ['8', '9', '10', '12'], 1, '36 ÷ 4 = 9 kalem.'),
  mk('matematik', 3, 'problemler', 'Bir otobüste 32 yolcu vardı. İlk durakta 12 yolcu indi, 5 yolcu bindi. Otobüste kaç yolcu oldu?', ['25', '27', '29', '24'], 0, '32 - 12 + 5 = 25 yolcu.'),
  mk('matematik', 3, 'sayılar', 'En yakın onluğa yuvarlandığında 40 olan sayı hangisidir?', ['34', '35', '43', '46'], 1, '35 en yakın onluğa yuvarlandığında 40 olur.'),
  // --- Geometri ---
  mk('geometri', 3, 'şekiller', 'Bir karenin bir kenarı 6 cm ise çevresi kaç cm\'dir?', ['18 cm', '24 cm', '30 cm', '36 cm'], 1, 'Çevre = 4 × 6 = 24 cm.'),
  mk('geometri', 3, 'açılar', 'Aşağıdakilerden hangisi bir dik açıdır?', ['45°', '90°', '120°', '180°'], 1, 'Dik açı 90 derecedir.'),
  mk('geometri', 3, 'simetri', 'Aşağıdaki harflerden hangisi hem yatay hem dikey simetriye sahiptir?', ['A', 'B', 'H', 'C'], 2, 'H harfi hem dikey hem yatay eksende simetriktir.'),
  mk('geometri', 3, 'alan', 'Bir kenarı 5 cm olan karenin alanı kaç cm²\'dir?', ['10', '20', '25', '30'], 2, 'Alan = 5 × 5 = 25 cm².'),
  mk('geometri', 3, 'şekiller', 'Bir üçgenin kenarları 5 cm, 7 cm ve 9 cm ise çevresi kaç cm\'dir?', ['19 cm', '20 cm', '21 cm', '22 cm'], 2, '5 + 7 + 9 = 21 cm.'),
  mk('geometri', 3, 'uzunluk', '3 m 25 cm kaç cm eder?', ['3025 cm', '325 cm', '350 cm', '352 cm'], 1, '3 m = 300 cm; 300 + 25 = 325 cm.'),
  // --- Türkçe ---
  mk('turkce', 3, 'dil bilgisi', '"Kitaplarını çantasına koydu." cümlesindeki "koydu" kelimesi hangi zaman kipindedir?', ['Geçmiş zaman', 'Şimdiki zaman', 'Gelecek zaman', 'Geniş zaman'], 0, 'Koy-du → görülen geçmiş zaman.'),
  mk('turkce', 3, 'yazım kuralları', '"19 mayıs 1919" tarihi nasıl yazılmalıdır?', ['19 mayıs 1919', '19 Mayıs 1919', '19 MAYIS 1919', '19. Mayıs. 1919'], 1, 'Ay adları tarih olarak kullanıldığında büyük harfle başlar.'),
  mk('turkce', 3, 'okuma-anlama', '"Karıncalar yaz boyunca kış için yiyecek toplarlar." Karıncalar neden yiyecek toplar?', ['Satmak için', 'Kış için', 'Paylaşmak için', 'Eğlenmek için'], 1, 'Kış için yiyecek toplarlar.'),
  mk('turkce', 3, 'noktalama', 'Karşılıklı konuşmalarda, konuşan kişinin sözünden önce hangi işaret kullanılır?', ['Uzun çizgi (—)', 'Virgül (,)', 'Noktalı virgül (;)', 'Tırnak (")'], 0, 'Konuşma çizgisi (—) kullanılır.'),
  mk('turkce', 3, 'eş ve zıt anlam', '"Okul" kelimesinin eş anlamlısı hangisidir?', ['Sınıf', 'Mektep', 'Dershane', 'Öğrenci'], 1, 'Okul = mektep.'),
  mk('turkce', 3, 'dil bilgisi', '"Bu soruyu çok hızlı çözdü." cümlesinde "hızlı" kelimesi hangi görevdedir?', ['İsim', 'Sıfat', 'Zarf', 'Fiil'], 2, '"Hızlı" burada çözme eylemini niteliyor (zarf).'),
  mk('turkce', 3, 'okuma-anlama', '"Atatürk, 19 Mayıs 1919\'da Samsun\'a çıkarak milli mücadeleyi başlattı." Milli mücadele nereden başladı?', ['Ankara', 'İstanbul', 'Samsun', 'İzmir'], 2, 'Samsun\'dan başladı.'),

  // ════════════ 4. SINIF ════════════
  // --- Matematik ---
  mk('matematik', 4, 'sayılar', 'Aşağıdaki sayılardan hangisi en büyüktür?', ['4350', '4305', '4530', '4053'], 2, '4530 en büyüktür.'),
  mk('matematik', 4, 'toplama', '2486 + 1975 işleminin sonucu kaçtır?', ['4361', '4461', '4451', '4460'], 1, '2486 + 1975 = 4461.'),
  mk('matematik', 4, 'çıkarma', '7000 - 3492 işleminin sonucu kaçtır?', ['3508', '3518', '3608', '3498'], 0, '7000 - 3492 = 3508.'),
  mk('matematik', 4, 'çarpma', '26 × 14 işleminin sonucu kaçtır?', ['354', '364', '374', '344'], 1, '26 × 14 = 364.'),
  mk('matematik', 4, 'bölme', '864 ÷ 8 işleminin sonucu kaçtır?', ['98', '108', '106', '118'], 1, '864 ÷ 8 = 108.'),
  mk('matematik', 4, 'problemler', 'Bir sınıftaki 36 öğrencinin 1/4\'ü kızdır. Sınıfta kaç kız öğrenci vardır?', ['8', '9', '10', '12'], 1, '36 ÷ 4 = 9 kız öğrenci.'),
  mk('matematik', 4, 'sayılar', '12 478 sayısının binler basamağındaki rakamın basamak değeri kaçtır?', ['2000', '4000', '200', '400'], 0, 'Binler basamağında 2 var; değeri 2000\'dir.'),

  // --- Geometri ---
  mk('geometri', 4, 'açılar', 'Bir doğru açı kaç derecedir?', ['90°', '180°', '270°', '360°'], 1, 'Doğru açı 180 derecedir.'),
  mk('geometri', 4, 'alan', 'Kısa kenarı 6 cm, uzun kenarı 9 cm olan dikdörtgenin alanı kaç cm²\'dir?', ['36', '45', '54', '60'], 2, 'Alan = 6 × 9 = 54 cm².'),
  mk('geometri', 4, 'hacim', 'Bir ayrıtı 3 cm olan küpün hacmi kaç cm³\'tür?', ['9', '18', '27', '36'], 2, 'Hacim = 3 × 3 × 3 = 27 cm³.'),
  mk('geometri', 4, 'şekiller', 'Bir karenin çevresi 48 cm ise bir kenarı kaç cm\'dir?', ['10 cm', '12 cm', '14 cm', '16 cm'], 1, '48 ÷ 4 = 12 cm.'),
  mk('geometri', 4, 'uzunluk', 'Bir kenarı 8 cm olan eşkenar üçgenin çevresi kaç cm\'dir?', ['16 cm', '24 cm', '32 cm', '64 cm'], 1, '8 × 3 = 24 cm.'),
  mk('geometri', 4, 'simetri', 'Bir karenin kaç simetri ekseni vardır?', ['1', '2', '4', '8'], 2, 'Karede 4 simetri ekseni vardır.'),
  mk('geometri', 4, 'alan', 'Bir kenarı 12 cm olan kare ile bir kenarı 10 cm olan eşkenar üçgenin çevreleri farkı kaç cm\'dir?', ['14', '16', '18', '20'], 2, 'Kare: 48 cm; üçgen: 30 cm; fark 18 cm.'),

  // --- Türkçe ---
  mk('turkce', 4, 'dil bilgisi', '"Öğretmenimiz yarın geziye gideceğiz." dedi. Cümlesinde kaç tane zamir vardır?', ['1', '2', '3', '0'], 0, 'Gideceğiz → biz zamiri gömülüdür; bir zamir vardır.'),
  mk('turkce', 4, 'dil bilgisi', 'Aşağıdaki cümlelerin hangisinde abartma (mübalağa) vardır?', ['Odamı temizledim.', 'Kardeşim çok hızlı koşuyor.', 'Seni dünyalar kadar seviyorum.', 'Sular soğuktu.'], 2, '"Dünyalar kadar" abartmadır.'),
  mk('turkce', 4, 'yazım kuralları', 'Aşağıdaki cümlelerin hangisinde "ki" nin yazımı doğrudur?', ['Sanki sen de geleceksin.', 'Dünkü maç çok güzeldi.', 'Evdeki hesap çarşıya uymaz.', 'Okuldaki arkadaşlarımı özledim.'], 0, 'Bağlaç olan "ki" ayrı yazılır: "Sanki".'),
  mk('turkce', 4, 'noktalama', '"Vatanını en çok seven, görevini en iyi yapandır." (Atatürk) Bu cümlede tırnak işareti neden kullanılmıştır?', ['Alıntı yapıldığı için', 'Cümle uzun olduğu için', 'Vurgu yapıldığı için', 'Başlık olduğu için'], 0, 'Başkasından alıntı yapılan sözler tırnak içine alınır.'),
  mk('turkce', 4, 'okuma-anlama', '"Uzun süredir yağmayan yağmur, bu gece şiddetli bir şekilde başladı." Cümleye göre yağmur için hangisi söylenebilir?', ['Her gece yağıyor', 'Uzun zamandır yağmamıştı', 'Çok hafif yağıyor', 'Yazın da yağmıştı'], 1, 'Uzun süredir yağmayan yağmur başladı.'),
  mk('turkce', 4, 'dil bilgisi', '"Kırık" kelimesi aşağıdaki cümlelerin hangisinde mecaz anlamda kullanılmıştır?', ['Kırık bardağı çöpe attım.', 'Kırık kolum çok ağrıyor.', 'Kırık kalbi onu üzgün gösteriyor.', 'Kırık camı değiştirdik.'], 2, '"Kırık kalp" mecaz anlamdır.'),
  mk('turkce', 4, 'eş ve zıt anlam', '"Vazgeçmek" kelimesinin zıt anlamlısı hangisidir?', ['Bırakmak', 'Sevgi', 'Devam etmek', 'İleri'], 2, 'Vazgeçmek kelimesinin zıt anlamlısı devam etmektir.'),
  mk('turkce', 4, 'okuma-anlama', '"Çocuklar, okuma alışkanlığı kazanmak için her gün düzenli olarak kitap okumalıdır." Paragrafta anlatılmak istenen nedir?', ['Kitap pahalıdır', 'Düzenli okumak alışkanlık kazandırır', 'Sadece çocuklar okur', 'Kitaplar kütüphanededir'], 1, 'Düzenli okuma alışkanlık kazandırır.')
]

export default SEED_QUESTIONS
