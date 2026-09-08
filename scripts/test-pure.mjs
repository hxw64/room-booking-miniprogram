// 纯函数单元测试：node scripts/test-pure.mjs
import assert from 'node:assert'
import {
  generateSlots, hasOverlap, bookingOnDate, toTs, addDaysStr, hoursBetween
} from '../src/utils/time.js'
import {
  classifyRoomBooking, validateSeatSelection, isRoomConflict, isSeatConflict, seatDurationOk, checkinWindow
} from '../src/utils/booking.js'

let pass = 0
let fail = 0

function test(name, fn) {
  try {
    fn()
    pass++
    console.log('PASS ' + name)
  } catch (e) {
    fail++
    console.error('FAIL ' + name + ' -> ' + e.message)
  }
}

// 时间工具
test('generateSlots 1h -> 2 slots', () => {
  const s = toTs('2026-08-28', '09:00')
  const e = toTs('2026-08-28', '10:00')
  assert.strictEqual(generateSlots(s, e, 30).length, 2)
})
test('hasOverlap 重叠', () => {
  const a = toTs('2026-08-28', '09:00')
  const b = toTs('2026-08-28', '10:00')
  const c = toTs('2026-08-28', '09:30')
  const d = toTs('2026-08-28', '10:30')
  assert.strictEqual(hasOverlap(a, b, c, d), true)
})
test('hasOverlap 边界不重叠', () => {
  const a = toTs('2026-08-28', '09:00')
  const b = toTs('2026-08-28', '10:00')
  const c = toTs('2026-08-28', '10:00')
  const d = toTs('2026-08-28', '11:00')
  assert.strictEqual(hasOverlap(a, b, c, d), false)
})
test('bookingOnDate 跨天两天均可见', () => {
  const s = toTs('2026-08-28', '22:00')
  const e = toTs('2026-08-29', '02:00')
  assert.strictEqual(bookingOnDate(s, e, '2026-08-28'), true)
  assert.strictEqual(bookingOnDate(s, e, '2026-08-29'), true)
  assert.strictEqual(bookingOnDate(s, e, '2026-08-30'), false)
})
test('addDaysStr', () => {
  assert.strictEqual(addDaysStr('2026-08-28', 1), '2026-08-29')
})
test('hoursBetween', () => {
  const s = toTs('2026-08-28', '09:00')
  const e = toTs('2026-08-28', '12:00')
  assert.strictEqual(hoursBetween(s, e), 3)
})

// 预约规则
test('classifyRoomBooking 3h 内为 normal', () => {
  assert.strictEqual(classifyRoomBooking(3), 'normal')
  assert.strictEqual(classifyRoomBooking(2.5), 'normal')
})
test('classifyRoomBooking 超过 3h 为 apply', () => {
  assert.strictEqual(classifyRoomBooking(3.5), 'apply')
})
test('validateSeatSelection 单座只能 1 个', () => {
  assert.strictEqual(validateSeatSelection([1]).ok, true)
  assert.strictEqual(validateSeatSelection([1, 2]).ok, false)
})
test('validateSeatSelection 座区 1~4 个', () => {
  assert.strictEqual(validateSeatSelection([4, 5]).ok, true)
  assert.strictEqual(validateSeatSelection([4, 5, 6, 7]).ok, true)
  assert.strictEqual(validateSeatSelection([4, 5, 6, 7, 8]).ok, false)
})
test('validateSeatSelection 禁跨座区', () => {
  assert.strictEqual(validateSeatSelection([4, 8]).ok, false)
  assert.strictEqual(validateSeatSelection([3, 4]).ok, false)
})
test('isRoomConflict', () => {
  const s = toTs('2026-08-28', '09:00')
  const e = toTs('2026-08-28', '10:00')
  const c = toTs('2026-08-28', '09:30')
  const d = toTs('2026-08-28', '10:30')
  assert.strictEqual(isRoomConflict({ startTs: c, endTs: d }, s, e), true)
  assert.strictEqual(isRoomConflict({ startTs: toTs('2026-08-28', '10:00'), endTs: toTs('2026-08-28', '11:00') }, s, e), false)
})
test('isSeatConflict 座位交集才冲突', () => {
  const s = toTs('2026-08-28', '09:00')
  const e = toTs('2026-08-28', '10:00')
  assert.strictEqual(isSeatConflict({ seatIds: [1], startTs: s, endTs: e }, [1], s, e), true)
  assert.strictEqual(isSeatConflict({ seatIds: [2], startTs: s, endTs: e }, [1], s, e), false)
})
test('seatDurationOk 10h 上限', () => {
  assert.strictEqual(seatDurationOk(10), true)
  assert.strictEqual(seatDurationOk(10.5), false)
})

test('checkinWindow 提前10分钟内可报到', () => {
  const s = toTs('2026-08-31', '10:00')
  const e = toTs('2026-08-31', '11:00')
  const now = toTs('2026-08-31', '09:52') // 提前 8 分钟
  assert.strictEqual(checkinWindow(s, e, now), true)
})
test('checkinWindow 提前超过10分钟不可报到', () => {
  const s = toTs('2026-08-31', '10:00')
  const e = toTs('2026-08-31', '11:00')
  const now = toTs('2026-08-31', '09:40') // 提前 20 分钟
  assert.strictEqual(checkinWindow(s, e, now), false)
})
test('checkinWindow 结束后不可报到', () => {
  const s = toTs('2026-08-31', '10:00')
  const e = toTs('2026-08-31', '11:00')
  const now = toTs('2026-08-31', '11:05')
  assert.strictEqual(checkinWindow(s, e, now), false)
})
test('checkinWindow 时段内可报到', () => {
  const s = toTs('2026-08-31', '10:00')
  const e = toTs('2026-08-31', '11:00')
  const now = toTs('2026-08-31', '10:30')
  assert.strictEqual(checkinWindow(s, e, now), true)
})
console.log('')
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项')
if (fail > 0) process.exit(1)