// Öğrenci bazlı takip matrisi — saf mantık.
//
// Satır: öğrenci, sütun: okuma veya test ataması.
// Hücre durumları:
//   done       → okuma tamamlandı (read=true) / test çözüldü
//   incomplete → denenmiş ama tamamlanmamış (okumada kapı geçilememiş)
//   missed     → hiç yapılmamış (süre penceresi açık)
//   upcoming   → başlangıç tarihi henüz gelmemiş
//   expired    → bitiş tarihi geçmiş ve yapılmamış

export const TRACKING_STATUS = {
  done: 'done',
  incomplete: 'incomplete',
  missed: 'missed',
  upcoming: 'upcoming',
  expired: 'expired'
}

const toTime = (value) => {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export const trackingStatus = ({ kind = 'reading', attempt = null, startsAt = null, endsAt = null, now = new Date() } = {}) => {
  const nowTime = toTime(now) ?? Date.now()
  if (kind === 'reading') {
    if (attempt && attempt.read === true) return TRACKING_STATUS.done
    if (attempt) return TRACKING_STATUS.incomplete
  } else if (attempt) {
    return TRACKING_STATUS.done
  }
  const starts = toTime(startsAt)
  if (starts !== null && nowTime < starts) return TRACKING_STATUS.upcoming
  const ends = toTime(endsAt)
  if (ends !== null && nowTime > ends) return TRACKING_STATUS.expired
  return TRACKING_STATUS.missed
}

const scoreOf = (attempt) => Number(attempt?.scorePercent ?? attempt?.score_percent ?? 0) || 0

// En iyi denemeyi seçer (aynı öğrenci + atama için birden çok deneme olabilir).
const bestAttempt = (attempts) => {
  const index = new Map()
  for (const attempt of attempts) {
    const key = `${attempt.studentId}::${attempt.itemId}`
    const previous = index.get(key)
    if (!previous || scoreOf(attempt) > scoreOf(previous)) index.set(key, attempt)
  }
  return index
}

export const buildTrackingMatrix = ({ students = [], items = [], attempts = [], kind = 'reading', now = new Date() } = {}) => {
  const index = bestAttempt(attempts)

  const rows = students.map((student) => {
    const cells = items.map((item) => {
      const attempt = index.get(`${student.id}::${item.id}`) || null
      const status = trackingStatus({ kind, attempt, startsAt: item.startsAt, endsAt: item.endsAt, now })
      return {
        itemId: item.id,
        status,
        scorePercent: attempt ? scoreOf(attempt) : null,
        date: attempt?.date ?? attempt?.submittedAt ?? null
      }
    })
    const count = (status) => cells.filter((cell) => cell.status === status).length
    const done = count(TRACKING_STATUS.done)
    return {
      student,
      cells,
      done,
      incomplete: count(TRACKING_STATUS.incomplete),
      missed: count(TRACKING_STATUS.missed),
      upcoming: count(TRACKING_STATUS.upcoming),
      expired: count(TRACKING_STATUS.expired),
      total: items.length,
      percent: items.length ? Math.round((done / items.length) * 100) : 0
    }
  })

  const itemStats = items.map((item, column) => {
    const doneStudents = rows.filter((row) => row.cells[column].status === TRACKING_STATUS.done)
    const incompleteStudents = rows.filter((row) => row.cells[column].status === TRACKING_STATUS.incomplete)
    const missingStudents = rows.filter((row) => row.cells[column].status === TRACKING_STATUS.missed)
    return {
      item,
      done: doneStudents.length,
      doneStudents: doneStudents.map((row) => row.student),
      incompleteStudents: incompleteStudents.map((row) => row.student),
      missingStudents: missingStudents.map((row) => row.student),
      percent: rows.length ? Math.round((doneStudents.length / rows.length) * 100) : 0
    }
  })

  const totalCells = rows.length * items.length
  const doneCells = rows.reduce((sum, row) => sum + row.done, 0)
  return {
    rows,
    itemStats,
    totals: {
      students: rows.length,
      items: items.length,
      done: doneCells,
      cells: totalCells,
      percent: totalCells ? Math.round((doneCells / totalCells) * 100) : 0
    }
  }
}

// Farklı sınıflardan öğrencileri aynı sayfada karşılaştırmak için özet.
// Her öğrencinin kendi sınıfındaki atamalara göre tamamlanması hesaplanır.
export const summarizeStudents = ({
  students = [],
  classes = [],
  readings = [],
  exams = [],
  readingAttempts = [],
  examAttempts = [],
  transactions = []
} = {}) => {
  const classesById = new Map(classes.map((item) => [item.id, item]))
  const groupByClass = (items) => {
    const map = new Map()
    for (const item of items) {
      const list = map.get(item.classId) || []
      list.push(item)
      map.set(item.classId, list)
    }
    return map
  }
  const readingsByClass = groupByClass(readings)
  const examsByClass = groupByClass(exams)
  const balanceByStudent = new Map()
  for (const tx of transactions) {
    balanceByStudent.set(tx.studentId, (balanceByStudent.get(tx.studentId) || 0) + (Number(tx.amount) || 0))
  }

  return students.map((student) => {
    const classInfo = classesById.get(student.classId)
    const readingItems = readingsByClass.get(student.classId) || []
    const examItems = examsByClass.get(student.classId) || []
    const myReadingAttempts = readingAttempts.filter((attempt) => attempt.studentId === student.id)
    const myExamAttempts = examAttempts.filter((attempt) => attempt.studentId === student.id)
    const readingMatrix = buildTrackingMatrix({ students: [student], items: readingItems, attempts: myReadingAttempts, kind: 'reading' })
    const examMatrix = buildTrackingMatrix({ students: [student], items: examItems, attempts: myExamAttempts, kind: 'exam' })
    const scores = myExamAttempts.map((attempt) => Number(attempt.scorePercent) || 0)
    // Hangi kitaplar okundu / okunmadı (karşılaştırma ekranındaki listeler için).
    const cells = readingMatrix.rows[0]?.cells || []
    const titleOf = (index) => ({ id: readingItems[index]?.id, title: readingItems[index]?.title || 'Okuma' })
    const readTitles = cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.status === 'done')
      .map(({ cell, index }) => ({ ...titleOf(index), scorePercent: cell.scorePercent }))
    const missingTitles = cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.status === 'missed')
      .map(({ index }) => titleOf(index))
    const incompleteTitles = cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.status === 'incomplete')
      .map(({ cell, index }) => ({ ...titleOf(index), scorePercent: cell.scorePercent }))
    return {
      student,
      className: classInfo?.name || '',
      grade: classInfo?.grade ?? student.grade ?? null,
      readingDone: readingMatrix.rows[0]?.done ?? 0,
      readingTotal: readingItems.length,
      readTitles,
      missingTitles,
      incompleteTitles,
      examDone: examMatrix.rows[0]?.done ?? 0,
      examTotal: examItems.length,
      avgExamScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
      balance: balanceByStudent.get(student.id) || 0
    }
  })
}
