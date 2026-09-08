<template>
  <view class="page">
    <view class="header">
      <view class="h-title">房间预约</view>
      <view class="h-en">Room Booking</view>
    </view>

    <view class="room-list">
      <view v-for="r in rooms" :key="r.roomId" class="room-card" @click="goRoom(r)">
        <image v-if="r.cover" :src="r.cover" class="room-img" mode="aspectFill" />
        <view v-else class="room-img placeholder">{{ r.roomId }}</view>
        <view class="room-info">
          <view class="room-name">{{ r.name }}</view>
          <view class="room-en">{{ r.nameEn }}</view>
          <view class="room-no">房间号 / Room No. {{ r.roomId }}</view>
          <view class="room-tag">{{ r.openAccess ? '开放使用 / Open' : (r.roomType === 'seat' ? '座位预约 / Seat' : '整房预约 / Room') }}</view>
        </view>
      </view>
    </view>

    <view v-if="isAdmin" class="admin-entry" @click="goAdmin">
      <text class="ae-zh">管理后台</text>
      <text class="ae-en">Admin Console</text>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { ROOMS } from '@/config/index.js'
import { ensureLogin, getLocalUser } from '@/utils/auth.js'
import { getDb } from '@/utils/cloud.js'
import ContactFooter from '@/components/ContactFooter.vue'

export default {
  components: { ContactFooter },
  data() {
    return { rooms: [], isAdmin: false }
  },
  async onShow() {
    this.isAdmin = !!(getLocalUser() || {}).isAdmin
    this.buildDefaultRooms()
    try {
      await ensureLogin()
      this.isAdmin = !!(getLocalUser() || {}).isAdmin
      await this.loadRooms()
    } catch (e) {
      console.warn('login/load failed', e)
    }
  },
  methods: {
    buildDefaultRooms() {
      this.rooms = ROOMS.map(r => ({ ...r, cover: '', images: [], intro: '' }))
    },
    async loadRooms() {
      try {
        const db = getDb()
        const res = await new Promise((resolve, reject) => {
          db.collection('rooms').get({ success: resolve, fail: reject })
        })
        const docs = res.data || []
        const map = {}
        docs.forEach(d => { map[d.roomId] = d })
        this.rooms = ROOMS.map(r => {
          const d = map[r.roomId] || {}
          return {
            ...r,
            cover: (d.images && d.images.length) ? d.images[0] : '',
            images: d.images || [],
            intro: d.intro || ''
          }
        })
      } catch (e) {
        console.warn('rooms not initialized', e)
      }
    },
    goRoom(r) {
      const url = r.roomType === 'seat'
        ? '/pages/seat/seat?roomId=' + r.roomId
        : '/pages/room/room?roomId=' + r.roomId
      uni.navigateTo({ url })
    },
    goAdmin() {
      uni.navigateTo({ url: '/pages/admin/admin' })
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.header { padding: 40rpx 32rpx 20rpx; background: #ffffff; }
.h-title { font-size: 44rpx; font-weight: 700; color: #1f2329; }
.h-en { font-size: 26rpx; color: #8a919c; margin-top: 6rpx; }
.room-list { padding: 24rpx; }
.room-card {
  display: flex; background: #ffffff; border-radius: 16rpx;
  margin-bottom: 24rpx; overflow: hidden; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.room-img { width: 220rpx; height: 220rpx; flex-shrink: 0; }
.placeholder {
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #e8f5ee, #d3ede0);
  color: #07c160; font-size: 48rpx; font-weight: 700;
}
.room-info { flex: 1; padding: 24rpx; display: flex; flex-direction: column; justify-content: center; }
.room-name { font-size: 34rpx; font-weight: 600; color: #1f2329; }
.room-en { font-size: 24rpx; color: #8a919c; margin-top: 4rpx; }
.room-no { font-size: 24rpx; color: #8a919c; margin-top: 12rpx; }
.room-tag {
  margin-top: 12rpx; align-self: flex-start; font-size: 22rpx; color: #07c160;
  background: #e8f5ee; padding: 4rpx 16rpx; border-radius: 999rpx;
}
.admin-entry {
  margin: 0 24rpx 24rpx; padding: 28rpx; background: #1f2329; border-radius: 16rpx;
  display: flex; flex-direction: column; align-items: center;
}
.ae-zh { color: #ffffff; font-size: 32rpx; font-weight: 600; }
.ae-en { color: #b8bdc4; font-size: 24rpx; margin-top: 4rpx; }
</style>