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
