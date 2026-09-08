// 微信云开发封装
import { CLOUD_ENV } from '@/config/index.js'

let inited = false

export function cloudAvailable() {
  return typeof wx !== 'undefined' && !!wx.cloud
}

function ensureCloud() {
  if (typeof wx === 'undefined' || !wx.cloud) return false
  if (!inited) {
    wx.cloud.init({ env: CLOUD_ENV || undefined, traceUser: true })
    inited = true
  }
  return true
}

export function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    if (!ensureCloud()) {
      reject(new Error('当前环境不支持微信云开发 / WeChat Cloud is not available'))
      return
    }
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        const r = res.result || {}
        if (r.code !== 0) {
          reject(new Error(r.message || '服务错误 / Service error'))
        } else {
          resolve(r.data)
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '调用失败 / Call failed'))
      }
    })
  })
}

export function getDb() {
  if (!ensureCloud()) throw new Error('当前环境不支持微信云开发 / WeChat Cloud is not available')
  return wx.cloud.database()
}

// 读取某个集合（自动处理 20 条上限，loop 拉全量）
export function fetchAll(query) {
  return new Promise((resolve, reject) => {
    query.get({
      success: async (res) => {
        try {
          const db = getDb()
          let list = res.data || []
          let batch = res.data || []
          while (batch.length === 20) {
            const next = await new Promise((rs, rj) => {
              query.skip(list.length).get({ success: r => rs(r), fail: e => rj(e) })
            })
            batch = next.data || []
            list = list.concat(batch)
          }
          resolve(list)
        } catch (e) {
          reject(e)
        }
      },
      fail: reject
    })
  })
}