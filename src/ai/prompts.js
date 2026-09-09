// AI raporlama için prompt şablonları (Türkçe)
import { subjectLabel, topicLabel, gradeLabel } from '../domain/model.js'

export const buildPrompt = (ctx) => {
  const { studentName, grade, subjectStats, threshold = 60, reportDate } = ctx
  const lines = subjectStats.map((s) => {
    let line = `- Ders: ${subjectLabel(s.subject)} | Konu: ${topicLabel(s.topic)} | Doğru: ${s.correct}/${s.total} | Başarı: %${s.percent}`
    if (s.avgSeconds) line += ` | Soru başına ortalama süre: ${s.avgSeconds} sn`
    return line
  })
  return `
Aşağıda bir öğrencinin konu bazlı test sonuçları verilmiştir.
Görevin: Bu verileri analiz edip **eksik olduğu konuları** tespit etmek ve her eksik konu için somut, yaşına uygun çalışma önerileri sunmaktır.

ÖĞRENCİ: ${studentName}
SINIF: ${grade ? gradeLabel(grade) : 'Belirtilmemiş'}
EKSİK KONU EŞİĞİ: %${threshold} altı (en az 3 soru çözülen konular dikkate alınır)
RAPOR TARİHİ: ${reportDate || ''}

KONU SONUÇLARI:
${lines.length ? lines.join('\n') : '(Veri yok)'}

Süre notu: Verilen "soru başına ortalama süre" değerleri 7-11 yaş grubu için değerlendirilir.
Yalnızca doğruluk (başarı yüzdesi) değil, hız da ipucudur: Yüksek başarı + yavaş tempo otomatikleşmemiş
beceriye, düşük başarı + hızlı tempo ise acelecilik/soruyu anlamamaya işaret edebilir. Bunları yorumla.

Yanıtın şu bölümlerden oluşsun:
1. Kısa genel değerlendirme (2-3 cümle)
2. "Eksik Konular" başlığı altında madde madde: hangi derste/hangi konuda, ne oranda eksik olduğu
3. "Güçlü Olduğu Konular" başlığı altında kısa liste
4. "Zamanlama Gözlemi" başlığı altında süre verilerinden çıkarımlar
5. "Öneriler" başlığı altında her eksik konu için öğretmene ve öğrenciye somut öneriler
Markdown kullanma; düz metin yaz.`
}
