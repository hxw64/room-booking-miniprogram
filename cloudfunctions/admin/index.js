const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
  return { list: res.data }
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
  return { list: res.data }
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
      default: return { code: 1, message: '未知操作 / Unknown action' }
    }
  } catch (e) {
    return { code: 1, message: e.message || '服务错误 / Service error' }
  }
}