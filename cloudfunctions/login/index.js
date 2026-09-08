const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  console.log('login openid:', openid)
  let isAdmin = false
  try {
    const db = cloud.database()
    const res = await db.collection('admins').where({ openid }).get()
    isAdmin = res.data.length > 0
  } catch (e) {
    isAdmin = false
  }
  return { code: 0, data: { openid, isAdmin } }
}