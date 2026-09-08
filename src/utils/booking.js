// 预约业务规则（纯函数，可在 Node 中直接测试）
import { hasOverlap } from './time.js'
import { NORMAL_MAX_HOURS, SEAT_MAX_HOURS, zoneBySeat } from '../config/index.js'

// 普通房间：≤3h 直接预约，>3h 转申请
export function classifyRoomBooking(hours) {
  return hours <= NORMAL_MAX_HOURS ? 'normal' : 'apply'
}

// 校验选座合法性：返回 { ok, reason }
export function validateSeatSelection(seatIds) {
  if (!seatIds || !seatIds.length) {
    return { ok: false, reason: '请至少选择一个座位 / Please select at least one seat' }
  }
  const unique = [...new Set(seatIds)]
  if (unique.length !== seatIds.length) {
    return { ok: false, reason: '座位重复 / Duplicate seats' }
  }
  const zoneIds = new Set(unique.map(s => (zoneBySeat(s) || {}).id))
  if (zoneIds.size > 1) {
    return { ok: false, reason: '不能跨座区选择 / Cannot select across zones' }
  }
  const zone = zoneBySeat(unique[0])
  if (!zone) {
    return { ok: false, reason: '无效座位 / Invalid seat' }
  }
  if (zone.mode === 'single' && unique.length !== 1) {
    return { ok: false, reason: '单独座位每次只能选 1 个 / Single seats can only be booked one at a time' }
  }
  if (zone.mode === 'group' && (unique.length < 1 || unique.length > zone.maxSelect)) {
    return { ok: false, reason: '座区内可选 1~4 个座位 / Select 1 to 4 seats within a zone' }
  }
  return { ok: true }
}

// 普通房间冲突：同一房间时间区间重叠即为冲突
export function isRoomConflict(existing, startTs, endTs) {
  return hasOverlap(existing.startTs, existing.endTs, startTs, endTs)
}

// 座位冲突：时间重叠且存在任一座位交集
export function isSeatConflict(existing, seatIds, startTs, endTs) {
  if (!hasOverlap(existing.startTs, existing.endTs, startTs, endTs)) return false
  const list = existing.seatIds || []
  return seatIds.some(s => list.indexOf(s) >= 0)
}

// 座位预约时长是否在 10h 以内
export function seatDurationOk(hours) {
  return hours <= SEAT_MAX_HOURS
}
// 报到窗口：预约开始前 10 分钟起，至预约结束为止
export function checkinWindow(startTs, endTs, now = Date.now(), leadMs = 10 * 60 * 1000) {
  return now >= startTs - leadMs && now <= endTs
}