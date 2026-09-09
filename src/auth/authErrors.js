export const formatAuthError = (message) => {
  const text = String(message || '')
  if (/invalid login credentials/i.test(text)) return 'E-posta veya parola hatalı.'
  if (/email not confirmed/i.test(text)) return 'E-posta adresinizi doğruladıktan sonra giriş yapabilirsiniz.'
  if (/user already registered/i.test(text)) return 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.'
  if (/password should be at least/i.test(text)) return 'Parola en az 6 karakter olmalıdır.'
  if (/same password/i.test(text)) return 'Yeni parola mevcut paroladan farklı olmalıdır.'
  if (/unable to validate email/i.test(text)) return 'Geçerli bir e-posta adresi girin.'
  if (/rate limit/i.test(text)) return 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.'
  if (/redirect|redirect url/i.test(text)) return 'Parola sıfırlama bağlantısı için Supabase yönlendirme adresini kontrol edin.'
  if (/expired|invalid.*token|token.*invalid/i.test(text)) {
    return 'Parola sıfırlama bağlantısının süresi dolmuş veya bağlantı geçersiz.'
  }
  return text || 'İşlem sırasında beklenmeyen bir hata oluştu.'
}
