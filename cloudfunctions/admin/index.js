const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const ROOM_NAMES = {
  '801': '静心驿站',
  '802': '律动空间',
  '803': '公共自习室',
  '804': '知心小筑',
  '805': '音悦工坊',
  '806': '创想天地',
  '807': '愈见空间',
  '808': '乐活空间'
}

function fail(message) {
  throw new Error(message)
}

function ok(data) {
  return { code: 0, data }
}

async function isAdmin(openid) {
  const res = await db.collection('admins').where({ openid }).get()
  return res.data.length > 0
}

async function removeSlots(b) {
  const keys = b.slotKeys || []
  for (const key of keys) {
    try { await db.collection('slots').doc(key).remove() } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// 联系方式从 booking_details（私有集合，仅云函数可读）读取后合并，
// 前端管理页字段不变，仍可看到姓名 / 手机号 / 申请原因。
// 兼容拆分前遗留的旧数据：旧记录的联系方式仍内联在 bookings 里。
// ---------------------------------------------------------------------------
async function attachContacts(list) {
  if (!list || !list.length) return []
  let details = []
  try {
    const ids = list.map(b => b._id)
    const res = await db.collection('booking_details').where({ _id: _.in(ids) }).limit(1000).get()
    details = res.data || []
  } catch (e) {
    details = []
  }
  const map = {}
  details.forEach(d => { map[d._id] = d })
  return list.map(b => {
    const d = map[b._id] || {}
    return {
      ...b,
      name: d.name || b.name || '',
      phone: d.phone || b.phone || '',
      reason: d.reason || b.reason || ''
    }
  })
}

async function updateRoom(openid, event) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const { roomId, images, intro } = event
  if (!roomId) fail('参数缺失 / Missing params')
  const data = { roomId, images: images || [], intro: intro || '', updatedAt: Date.now() }
  const res = await db.collection('rooms').where({ roomId }).get()
  if (res.data.length) {
    await db.collection('rooms').doc(res.data[0]._id).update({ data })
  } else {
    await db.collection('rooms').add({ data: { ...data, name: ROOM_NAMES[roomId] || roomId } })
  }
  return { roomId }
}

async function listAllBookings(openid) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const res = await db.collection('bookings').orderBy('startTs', 'desc').limit(1000).get()
  return { list: await attachContacts(res.data) }
}

async function adminCancel(openid, event) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const { bookingId } = event
  const res = await db.collection('bookings').doc(bookingId).get()
  const b = res.data
  if (!b) fail('记录不存在 / Not found')
  await db.collection('bookings').doc(bookingId).update({ data: { status: 'cancelled' } })
  await removeSlots(b)
  return { id: bookingId }
}

async function listApplications(openid) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const res = await db.collection('bookings').where({ type: 'apply', status: 'pending' }).orderBy('createdAt', 'asc').limit(1000).get()
  return { list: await attachContacts(res.data) }
}

async function approve(openid, event) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const { bookingId } = event
  const res = await db.collection('bookings').doc(bookingId).get()
  const b = res.data
  if (!b) fail('记录不存在 / Not found')
  if (b.status !== 'pending') fail('当前状态不可批准 / Cannot approve')
  await db.collection('bookings').doc(bookingId).update({ data: { status: 'approved', handledAt: Date.now(), autoApproved: false } })
  return { id: bookingId }
}

async function getRoomCode(openid, event) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const { roomId } = event
  if (!roomId) fail('参数缺失 / Missing params')
  let code = ''
  try {
    const res = await db.collection('roomCodes').where({ roomId }).get()
    code = res.data.length ? res.data[0].code : ''
  } catch (e) {
    code = ''
  }
  return { roomId, code }
}

async function updateRoomCode(openid, event) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const { roomId, code } = event
  if (!roomId) fail('参数缺失 / Missing params')
  if (!/^\d{4}$/.test(code)) fail('房间密码需为 4 位数字 / Room code must be 4 digits')
  const res = await db.collection('roomCodes').where({ roomId }).get()
  const data = { roomId, code, updatedAt: Date.now() }
  if (res.data.length) {
    await db.collection('roomCodes').doc(res.data[0]._id).update({ data })
  } else {
    await db.collection('roomCodes').add({ data })
  }
  return { roomId, code }
}
async function reject(openid, event) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const { bookingId } = event
  const res = await db.collection('bookings').doc(bookingId).get()
  const b = res.data
  if (!b) fail('记录不存在 / Not found')
  if (b.status !== 'pending') fail('当前状态不可拒绝 / Cannot reject')
  await db.collection('bookings').doc(bookingId).update({ data: { status: 'rejected', handledAt: Date.now() } })
  await removeSlots(b)
  return { id: bookingId }
}

// 一次性迁移：把拆分前旧记录里内联的姓名/手机号/原因搬到 booking_details，
// 并从公开可读的 bookings 中移除这些字段（以及 _openid）。
async function migrateBookingDetails(openid) {
  if (!(await isAdmin(openid))) fail('无管理员权限 / No admin access')
  const res = await db.collection('bookings').limit(1000).get()
  let scanned = 0
  let moved = 0
  let cleaned = 0
  for (const b of res.data) {
    scanned++
    const hasInline = !!(b.name || b.phone || b.reason || b._openid)
    if (!hasInline) continue
    let existing = null
    try {
      const d = await db.collection('booking_details').doc(b._id).get()
      existing = d.data || null
    } catch (e) {
      existing = null
    }
    if (!existing && (b.name || b.phone || b.reason)) {
      try {
        await db.collection('booking_details').add({
          data: {
            _id: b._id,
            _openid: b._openid || '',
            name: b.name || '',
            phone: b.phone || '',
            reason: b.reason || '',
            createdAt: b.createdAt || Date.now()
          }
        })
        moved++
      } catch (e) {}
    }
    try {
      await db.collection('bookings').doc(b._id).update({
        data: { name: _.remove(), phone: _.remove(), reason: _.remove(), _openid: _.remove() }
      })
      cleaned++
    } catch (e) {
      // _openid 可能无法作为普通字段移除，退一步只清理联系方式
      try {
        await db.collection('bookings').doc(b._id).update({
          data: { name: _.remove(), phone: _.remove(), reason: _.remove() }
        })
        cleaned++
      } catch (e2) {}
    }
  }
  return { scanned, moved, cleaned }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  try {
    switch (event.action) {
      case 'updateRoom': return ok(await updateRoom(openid, event))
      case 'listAllBookings': return ok(await listAllBookings(openid))
      case 'adminCancel': return ok(await adminCancel(openid, event))
      case 'listApplications': return ok(await listApplications(openid))
      case 'approve': return ok(await approve(openid, event))
      case 'reject': return ok(await reject(openid, event))
      case 'getRoomCode': return ok(await getRoomCode(openid, event))
      case 'updateRoomCode': return ok(await updateRoomCode(openid, event))
      case 'migrateBookingDetails': return ok(await migrateBookingDetails(openid))
      default: return { code: 1, message: '未知操作 / Unknown action' }
    }
  } catch (e) {
    return { code: 1, message: e.message || '服务错误 / Service error' }
  }
}