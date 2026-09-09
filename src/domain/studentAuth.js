const TURKISH_LETTERS = {
  ı: 'i',
  İ: 'I',
  ğ: 'g',
  Ğ: 'G',
  ş: 's',
  Ş: 'S',
  ç: 'c',
  Ç: 'C',
  ö: 'o',
  Ö: 'O',
  ü: 'u',
  Ü: 'U'
}

const STUDENT_EMAIL_DOMAIN = 'students.sinif-test.local'

const transliterate = (value) =>
  String(value || '')
    .replace(/[ıİğĞşŞçÇöÖüÜ]/g, (letter) => TURKISH_LETTERS[letter] || letter)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

export const normalizeStudentPart = (value) =>
  transliterate(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

export const studentCodeBase = (schoolNumber, firstName, lastName) => {
  const schoolPart = normalizeStudentPart(schoolNumber)
  const firstPart = normalizeStudentPart(firstName).slice(0, 1)
  const lastPart = normalizeStudentPart(lastName).slice(0, 1)
  return `${schoolPart}${firstPart}${lastPart}`.slice(0, 60)
}

export const studentAuthEmail = (loginCode) => {
  const normalizedCode = normalizeStudentPart(loginCode)
  if (!normalizedCode) throw new Error('Öğrenci giriş kodu boş olamaz.')
  return `${normalizedCode}@${STUDENT_EMAIL_DOMAIN}`
}

export { STUDENT_EMAIL_DOMAIN }
