// PostgREST, henüz uygulanmamış migration'lardaki kolonları 42703 / "does not exist"
// ile reddeder. İsteğe bağlı kolonları tespit edip sorguyu onlarsız tekrarlarız; böylece
// yeni kolonlar eklenmeden de uygulama çalışmaya devam eder.

export const detectMissingColumn = (error, optionalColumns) => {
  if (!error) return ''
  const message = String(error.message || '')
  if (error.code !== '42703' && !/does not exist/i.test(message)) return ''
  return optionalColumns.find((column) => new RegExp(`\\b${column}\\b`, 'i').test(message)) || ''
}

export const selectList = (fields, omitted = []) =>
  fields.filter((field) => !omitted.includes(field)).join(', ')

export const dropKeys = (row, omitted = []) => {
  if (omitted.length === 0) return row
  const next = { ...row }
  omitted.forEach((key) => delete next[key])
  return next
}

// İsteğe bağlı kolonların veritabanında var olup olmadığını tek satırlık okumayla yoklar.
// Dönen liste: BULUNMAYAN opsiyonel kolonlar. Yazma öncesi çağrılır ki veri sessizce
// düşmesin (ör. görsel kolonu yoksa görsel kaydedilemez).
export const probeMissingColumns = async ({ fields, optional, run }) => {
  const omitted = []
  for (;;) {
    const { error } = await run(selectList(fields, omitted))
    if (!error) return omitted
    const missing = detectMissingColumn(error, optional)
    if (!missing || omitted.includes(missing)) return omitted
    omitted.push(missing)
  }
}
