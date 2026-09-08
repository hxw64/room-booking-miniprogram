// 登录态与用户资料本地缓存
import { callFunction } from './cloud.js'

const USER_KEY = 'rb_user'
const PROFILE_KEY = 'rb_profile'

export function getLocalUser() {
  return uni.getStorageSync(USER_KEY) || null
}

export function setLocalUser(user) {
  uni.setStorageSync(USER_KEY, user)
}

export function getLocalProfile() {
  return uni.getStorageSync(PROFILE_KEY) || null
}

export function setLocalProfile(profile) {
  uni.setStorageSync(PROFILE_KEY, profile)
}

// 每次调用都向服务端获取最新 openid 与 isAdmin，
// 保证管理员在 admins 集合中变更后能立即生效。
export async function ensureLogin() {
  const data = await callFunction('login', {})
  const user = { openid: data.openid, isAdmin: !!data.isAdmin }
  setLocalUser(user)
  return user
}