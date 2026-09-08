<template>
  <view class="page">
    <view class="header">
      <view class="h-title">管理后台</view>
      <view class="h-en">Admin Console</view>
    </view>

    <view class="menu" @click="go('/pages/admin/room-edit')">
      <text class="m-zh">编辑房间</text>
      <text class="m-en">Edit Rooms</text>
    </view>
    <view class="menu" @click="go('/pages/admin/bookings')">
      <text class="m-zh">预约管理</text>
      <text class="m-en">Manage Bookings</text>
    </view>
    <view class="menu" @click="go('/pages/admin/applications')">
      <text class="m-zh">申请审核</text>
      <text class="m-en">Review Applications</text>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { ensureLogin } from '@/utils/auth.js'
import ContactFooter from '@/components/ContactFooter.vue'

export default {
  components: { ContactFooter },
  async onShow() {
    try {
      const u = await ensureLogin()
      if (!u.isAdmin) {
        uni.showToast({ title: '无管理员权限 / No admin access', icon: 'none' })
        setTimeout(() => uni.navigateBack(), 800)
      }
    } catch (e) {
      uni.showToast({ title: '请先登录 / Please sign in', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 800)
    }
  },
  methods: {
    go(url) {
      uni.navigateTo({ url })
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.header { padding: 40rpx 32rpx 24rpx; background: #ffffff; }
.h-title { font-size: 44rpx; font-weight: 700; color: #1f2329; }
.h-en { font-size: 26rpx; color: #8a919c; margin-top: 6rpx; }
.menu {
  margin: 20rpx 24rpx; padding: 32rpx; background: #ffffff; border-radius: 16rpx;
  display: flex; flex-direction: column;
}
.m-zh { font-size: 34rpx; font-weight: 600; color: #1f2329; }
.m-en { font-size: 24rpx; color: #8a919c; margin-top: 6rpx; }
</style>