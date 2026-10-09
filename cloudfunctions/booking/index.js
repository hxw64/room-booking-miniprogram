const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const SLOT_MS = 30 * 60 * 1000
const NORMAL_MAX_MS = 3 * 3600000
const APPLY_MAX_MS = 24 * 3600000
const SEAT_MAX_MS = 10 * 3600000

const SEAT_ZONES = [
  { id: 'single', seats: [1, 2, 3], mode: 'single', max: 1 },
  { id: 'zone1', seats: [4, 5, 6, 7], mode: 'group', max: 4 },
  { id: 'zone2', seats: [8, 9, 10, 11], mode: 'group', max: 4 }
]

function zoneBySeat(n) {
  return SEAT_ZONES.find(z => z.seats.indexOf(n) >= 0) || null
}

function overlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

function slotKeys(roomId, seatIds, startTs, endTs) {
  const keys = []
  for (let t = startTs; t < endTs; t += SLOT_MS) {
    if (seatIds && seatIds.length) {
      seatIds.forEach(s => keys.push('seat_' + roomId + '_' + s + '_' + t))
    } else {
      keys.push('room_' + roomId + '_' + t)
    }
  }
  return keys
}

function validateSeatSelection(seatIds) {
  if (!seatIds || !seatIds.length) return { ok: false, reason: '请至少选择一个座位 / Please select at least one seat' }
  const unique = [...new Set(seatIds)]
  if (unique.length !== seatIds.length) return { ok: false, reason: '座位重复 / Duplicate seats' }
  const zoneIds = new Set(unique.map(s => (zoneBySeat(s) || {}).id))
  if (zoneIds.size > 1) return { ok: false, reason: '不能跨座区选择 / Cannot select across zones' }
  const zone = zoneBySeat(unique[0])
  if (!zone) return { ok: false, reason: '无效座位 / Invalid seat' }
  if (zone.mode === 'single' && unique.length !== 1) return { ok: false, reason: '单独座位每次只能选 1 个 / Single seats: one at a time' }
  if (zone.mode === 'group' && (unique.length < 1 || unique.length > zone.max)) return { ok: false, reason: '座区内可选 1~4 个座位 / Select 1-4 seats in a zone' }
  return { ok: true }
}

function fail(message) {
  throw new Error(message)
}

// ---------------------------------------------------------------------------
// 隐私拆分（V3）：
//   bookings        只保存占用信息，集合设为“所有用户可读”，供前端展示/实时监听占用
//   booking_details 保存姓名/手机号/申请原因/openid，集合保持默认权限（仅云函数可读）
//   两表用同一个 _id 关联，_id 即 bookingId
// ---------------------------------------------------------------------------

async function getDetail(bookingId) {
  try {
    const res = await db.collection('booking_details').doc(bookingId).get()
    return res.data || null
  } catch (e) {
    return null
  }
}

async function saveDetail(bookingId, openid, contact) {
  await db.collection('booking_details').add({
    data: {
      _id: bookingId,
      _openid: openid,
      name: contact.name || '',
      phone: contact.phone || '',
      reason: contact.reason || '',
      createdAt: Date.now()
    }
  })
}

// 判断预约是否属于该用户：新数据看 booking_details，历史数据兜底看 bookings._openid
function isOwner(booking, detail, openid) {
  if (detail && detail._openid) return detail._openid === openid
  return !!booking && booking._openid === openid
}

async function myBookingIds(openid) {
  const ids = []
  try {
    const res = await db.collection('booking_details').where({ _openid: openid }).limit(1000).get()
    res.data.forEach(d => ids.push(d._id))
  } catch (e) {}
  return ids
}

async function bookingsByIds(ids) {
  if (!ids.length) return []
  try {
    const res = await db.collection('bookings').where({ _id: _.in(ids) }).limit(1000).get()
    return res.data
  } catch (e) {
    return []
  }
}

// 兼容拆分前遗留的旧数据（旧记录仍带 _openid）
async function legacyMine(openid) {
  try {
    const res = await db.collection('bookings').where({ _openid: openid }).limit(1000).get()
    return res.data
  } catch (e) {
    return []
  }
}

function dedupeById(lists) {
  const seen = {}
  const out = []
  lists.forEach(list => {
    ;(list || []).forEach(b => {
      if (!b || seen[b._id]) return
      seen[b._id] = 1
      out.push(b)
    })
  })
  return out
}

async function allMine(openid) {
  const ids = await myBookingIds(openid)
  const byDetail = await bookingsByIds(ids)
  const legacy = await legacyMine(openid)
  return dedupeById([byDetail, legacy])
}

async function findConflict(roomId, seatIds, startTs, endTs, excludeId) {
  const res = await db.collection('bookings').where({ roomId }).limit(1000).get()
  for (const b of res.data) {
    if (excludeId && b._id === excludeId) continue
    if (b.status !== 'approved' && b.status !== 'pending') continue
    if (!overlap(b.startTs, b.endTs, startTs, endTs)) continue
    if (seatIds && seatIds.length) {
      const bs = b.seatIds || []
      if (!seatIds.some(s => bs.indexOf(s) >= 0)) continue
    }
    return b
  }
  return null
}

async function findMineConflict(openid, startTs, endTs, excludeId) {
  const mine = await allMine(openid)
  for (const b of mine) {
    if (excludeId && b._id === excludeId) continue
    if (b.status !== 'approved' && b.status !== 'pending') continue
    if (overlap(b.startTs, b.endTs, startTs, endTs)) return b
  }
  return null
}

async function insertWithSlots(doc, keys, slotMeta, openid, contact) {
  const addRes = await db.collection('bookings').add({ data: doc })
  const bookingId = addRes._id
  try {
    await saveDetail(bookingId, openid, contact)
    for (const key of keys) {
      await db.collection('slots').add({ data: { _id: key, bookingId, ...slotMeta } })
    }
    return { id: bookingId }
  } catch (e) {
    try { await db.collection('booking_details').doc(bookingId).remove() } catch (e2) {}
    try { await db.collection('bookings').doc(bookingId).remove() } catch (e2) {}
    for (const key of keys) {
      try { await db.collection('slots').doc(key).remove() } catch (e2) {}
    }
    fail('该时段已被占用 / Time slot already booked')
  }
}

async function removeSlots(b) {
  const keys = b.slotKeys || []
  for (const key of keys) {
    try { await db.collection('slots').doc(key).remove() } catch (e) {}
  }
}

async function createRoomBooking(event, openid) {
  const { roomId, startTs, endTs, name, phone, reason } = event
  if (!roomId || !startTs || !endTs) fail('参数缺失 / Missing params')
  if (!name || !phone) fail('请填写姓名和手机号 / Name and phone required')
  const dur = endTs - startTs
  if (dur <= 0) fail('时间无效 / Invalid time')
  if (dur > APPLY_MAX_MS) fail('单次申请最长 24 小时 / Max 24 hours')

  let type, status
  if (dur <= NORMAL_MAX_MS) {
    type = 'normal'
    status = 'approved'
  } else {
    type = 'apply'
    status = 'pending'
    if (!reason) fail('请填写申请原因 / Reason required')
  }

  const conflict = await findConflict(roomId, null, startTs, endTs, null)
  if (conflict) fail('该时段已被占用 / Time slot already booked')
  const mineConflict = await findMineConflict(openid, startTs, endTs, null)
  if (mineConflict) fail('同一时段已有预约 / Overlapping booking exists')

  const keys = slotKeys(roomId, null, startTs, endTs)
  const doc = {
    roomId,
    seatIds: [],
    startTs,
    endTs,
    type,
    status,
    slotKeys: keys,
    autoApproved: false,
    createdAt: Date.now()
  }
  return await insertWithSlots(doc, keys, { roomId, seatNo: null, startTs, endTs }, openid, { name, phone, reason })
}

async function createSeatBooking(event, openid) {
  const { roomId, seatIds, startTs, endTs, name, phone } = event
  if (!roomId || !startTs || !endTs) fail('参数缺失 / Missing params')
  if (!name || !phone) fail('请填写姓名和手机号 / Name and phone required')
  const sel = validateSeatSelection(seatIds)
  if (!sel.ok) fail(sel.reason)
  const dur = endTs - startTs
  if (dur <= 0) fail('时间无效 / Invalid time')
  if (dur > SEAT_MAX_MS) fail('座位单次最长 10 小时 / Max 10 hours for seats')

  const conflict = await findConflict(roomId, seatIds, startTs, endTs, null)
  if (conflict) fail('该座位时段已被占用 / Seat time already booked')
  const mineConflict = await findMineConflict(openid, startTs, endTs, null)
  if (mineConflict) fail('同一时段已有预约 / Overlapping booking exists')

  const sorted = seatIds.slice().sort((a, b) => a - b)
  const keys = slotKeys(roomId, sorted, startTs, endTs)
  const doc = {
    roomId,
    seatIds: sorted,
    startTs,
    endTs,
    type: 'normal',
    status: 'approved',
    slotKeys: keys,
    autoApproved: false,
    createdAt: Date.now()
  }
  return await insertWithSlots(doc, keys, { roomId, seatNo: null, startTs, endTs }, openid, { name, phone, reason: '' })
}

async function cancel(event, openid) {
  const { bookingId } = event
  const res = await db.collection('bookings').doc(bookingId).get()
  const b = res.data
  const detail = await getDetail(bookingId)
  if (!b || !isOwner(b, detail, openid)) fail('无权操作 / Not allowed')
  if (b.status !== 'approved') fail('当前状态不可取消 / Cannot cancel')
  if (Date.now() >= b.startTs) fail('预约已开始，不可取消 / Already started')
  await db.collection('bookings').doc(bookingId).update({ data: { status: 'cancelled' } })
  await removeSlots(b)
  return { id: bookingId }
}

async function withdraw(event, openid) {
  const { bookingId } = event
  const res = await db.collection('bookings').doc(bookingId).get()
  const b = res.data
  const detail = await getDetail(bookingId)
  if (!b || !isOwner(b, detail, openid)) fail('无权操作 / Not allowed')
  if (b.status !== 'pending') fail('当前状态不可撤销 / Cannot withdraw')
  await db.collection('bookings').doc(bookingId).update({ data: { status: 'cancelled' } })
  await removeSlots(b)
  return { id: bookingId }
}

async function listMine(openid) {
  const list = await allMine(openid)
  list.sort((a, b) => b.startTs - a.startTs)
  return { list }
}

async function getRoomCode(roomId) {
  try {
    const res = await db.collection('roomCodes').where({ roomId }).get()
    return res.data.length ? res.data[0].code : ''
  } catch (e) {
    return ''
  }
}

async function getBooking(event, openid) {
  const { bookingId } = event
  if (!bookingId) fail('参数缺失 / Missing params')
  const res = await db.collection('bookings').doc(bookingId).get()
  const b = res.data
  const detail = await getDetail(bookingId)
  if (!b || !isOwner(b, detail, openid)) fail('无权操作 / Not allowed')
  return b
}

async function checkIn(event, openid) {
  const { bookingId } = event
  if (!bookingId) fail('参数缺失 / Missing params')
  const res = await db.collection('bookings').doc(bookingId).get()
  const b = res.data
  const detail = await getDetail(bookingId)
  if (!b || !isOwner(b, detail, openid)) fail('无权操作 / Not allowed')
  if (b.status !== 'approved') fail('预约未生效，无法报到 / Booking is not active')
  const now = Date.now()
  const leadMs = 10 * 60 * 1000
  if (now < b.startTs - leadMs) fail('尚未到报到时间 / Check-in not open yet')
  if (now > b.endTs) fail('预约已结束 / Booking has ended')
  const code = await getRoomCode(b.roomId)
  if (!code) fail('房间密码未设置，请联系管理员 / Room code not set, contact admin')
  if (b.checkedInAt) {
    return { code, checkedInAt: b.checkedInAt }
  }
  await db.collection('bookings').doc(bookingId).update({ data: { checkedInAt: now } })
  return { code, checkedInAt: now }
}

function ok(data) {
  return { code: 0, data }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  try {
    switch (event.action) {
      case 'createRoomBooking': return ok(await createRoomBooking(event, openid))
      case 'createSeatBooking': return ok(await createSeatBooking(event, openid))
      case 'cancel': return ok(await cancel(event, openid))
      case 'withdraw': return ok(await withdraw(event, openid))
      case 'listMine': return ok(await listMine(openid))
      case 'getBooking': return ok(await getBooking(event, openid))
      case 'checkIn': return ok(await checkIn(event, openid))
      default: return { code: 1, message: '未知操作 / Unknown action' }
    }
  } catch (e) {
    return { code: 1, message: e.message || '服务错误 / Service error' }
  }
}