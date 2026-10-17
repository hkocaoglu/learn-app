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
