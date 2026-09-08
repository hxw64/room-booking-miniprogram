const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const AUTO_APPROVE_MS = 4 * 3600000

exports.main = async (event, context) => {
  const threshold = Date.now() - AUTO_APPROVE_MS
  let res
  try {
    res = await db.collection('bookings')
      .where({ type: 'apply', status: 'pending', createdAt: _.lte(threshold) })
      .limit(1000)
      .get()
  } catch (e) {
    return { code: 0, data: { updated: 0, note: 'query failed: ' + e.message } }
  }
  let updated = 0
  for (const b of res.data) {
    try {
      await db.collection('bookings').doc(b._id).update({
        data: { status: 'approved', autoApproved: true, handledAt: Date.now() }
      })
      updated++
    } catch (e) {}
  }
  return { code: 0, data: { updated } }
}