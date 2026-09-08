// 时间工具（纯函数，可在 Node 中直接测试）
export function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

export function formatDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

export function todayStr() {
  return formatDate(new Date())
}

export function addDaysStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return formatDate(dt)
}

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 组合日期与时间字符串为本地时间戳(ms)
export function toTs(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime()
}

export function tsToTimeStr(ts) {
  const d = new Date(ts)
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

export function tsToDateStr(ts) {
  return formatDate(new Date(ts))
}

export function minutesBetween(startTs, endTs) {
  return Math.round((endTs - startTs) / 60000)
}

export function hoursBetween(startTs, endTs) {
  return (endTs - startTs) / 3600000
}

// 生成两个时间戳之间的半小时槽位起点（左闭右开）
export function generateSlots(startTs, endTs, slotMinutes = 30) {
  const slots = []
  for (let t = startTs; t < endTs; t += slotMinutes * 60000) {
    slots.push(t)
  }
  return slots
}

// 时间区间是否重叠（半开区间）
export function hasOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

// 给定日期的 00:00 与次日 00:00 时间戳
export function dayRange(dateStr) {
  const start = toTs(dateStr, '00:00')
  return { start, end: start + 24 * 3600000 }
}

// 某预约（跨天也适用）是否落在指定日期
export function bookingOnDate(startTs, endTs, dateStr) {
  const { start, end } = dayRange(dateStr)
  return hasOverlap(startTs, endTs, start, end)
}
// 某日期当天可预约的起始时间戳（毫秒）
// 今天：当前时刻之后的下一个半小时槽；未来日期：当天 00:00
export function availableStartTs(dateStr, slotMinutes = 30) {
  const start = toTs(dateStr, '00:00')
  const end = start + 24 * 3600000
  const now = Date.now()
  if (now < start) return start
  if (now >= end) return end
  const slotMs = slotMinutes * 60000
  const idx = Math.ceil((now - start) / slotMs)
  return start + idx * slotMs
}