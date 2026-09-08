<template>
  <view class="page">
    <view v-if="loading" class="center">
      <text class="c-zh">加载中</text>
      <text class="c-en">Loading...</text>
    </view>

    <template v-else-if="booking">
      <view class="card">
        <view class="room-name">{{ booking.roomName }}</view>
        <view class="room-en">{{ booking.roomNameEn }}</view>
        <view class="line">时间 / Time: {{ timeRange }}</view>
        <view v-if="seatText" class="line">座位 / Seats: {{ seatText }}</view>
      </view>

      <view class="status-card" :class="statusClass">
        <template v-if="checkedIn">
          <view class="st-zh">已报到，房间密码</view>
          <view class="st-en">Checked in, room code</view>
          <view class="code">{{ code }}</view>
          <view class="st-hint">请在预约时段内使用 / Use within your booking time</view>
          <view class="btn checkin" @click="doCheckIn">重新查看密码 / View Code</view>
        </template>
        <template v-else-if="inWindow">
          <view class="st-zh">当前可报到</view>
          <view class="st-en">Check-in is open now</view>
          <view class="btn checkin" @click="doCheckIn">报到 / Check In</view>
        </template>
        <template v-else-if="notStarted">
          <view class="st-zh">尚未到报到时间</view>
          <view class="st-en">Check-in opens 10 minutes before start</view>
          <view class="st-hint">报到时间：{{ openTime }} / Opens at {{ openTime }}</view>
        </template>
        <template v-else>
          <view class="st-zh">预约已结束</view>
          <view class="st-en">Booking has ended</view>
        </template>
      </view>
    </template>

    <view v-else class="center">
      <text class="c-zh">未找到预约</text>
      <text class="c-en">Booking not found</text>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { roomById } from '@/config/index.js'
import { ensureLogin } from '@/utils/auth.js'
import { callFunction } from '@/utils/cloud.js'
import { tsToDateStr, tsToTimeStr } from '@/utils/time.js'
import { checkinWindow } from '@/utils/booking.js'
import ContactFooter from '@/components/ContactFooter.vue'

const LEAD_MS = 10 * 60 * 1000

export default {
  components: { ContactFooter },
  data() {
    return {
      bookingId: '',
      booking: null,
      code: '',
      checkedIn: false,
      loading: true
    }
  },
  computed: {
    timeRange() {
      if (!this.booking) return ''
      const s = tsToDateStr(this.booking.startTs) + ' ' + tsToTimeStr(this.booking.startTs)
      const e = tsToDateStr(this.booking.endTs) + ' ' + tsToTimeStr(this.booking.endTs)
      return s + ' ~ ' + e
    },
    seatText() {
      if (!this.booking) return ''
      return (this.booking.seatIds && this.booking.seatIds.length) ? this.booking.seatIds.join(', ') : ''
    },
    now() {
      return Date.now()
    },
    inWindow() {
      if (!this.booking || this.checkedIn) return false
      return checkinWindow(this.booking.startTs, this.booking.endTs, this.now)
    },
    notStarted() {
      if (!this.booking) return false
      return this.now < this.booking.startTs - LEAD_MS
    },
    statusClass() {
      if (this.checkedIn) return 'st-ok'
      if (this.inWindow) return 'st-open'
      if (this.notStarted) return 'st-wait'
      return 'st-end'
    },
    openTime() {
      if (!this.booking) return ''
      return tsToTimeStr(this.booking.startTs - LEAD_MS)
    }
  },
  async onLoad(options) {
    this.bookingId = options.bookingId || ''
    try {
      await ensureLogin()
      await this.load()
    } catch (e) {
      this.loading = false
      uni.showToast({ title: e.message || '加载失败 / Load failed', icon: 'none' })
    }
  },
  methods: {
    async load() {
      const b = await callFunction('booking', { action: 'getBooking', bookingId: this.bookingId })
      const room = roomById(b.roomId) || { name: b.roomId, nameEn: '' }
      this.booking = { ...b, roomName: room.name, roomNameEn: room.nameEn }
      this.checkedIn = !!b.checkedInAt
      if (this.checkedIn) {
        try {
          const r = await callFunction('booking', { action: 'checkIn', bookingId: this.bookingId })
          this.code = r.code || ''
        } catch (e) {}
      }
      this.loading = false
    },
    async doCheckIn() {
      uni.showLoading({ title: '报到中 / Checking in' })
      try {
        const r = await callFunction('booking', { action: 'checkIn', bookingId: this.bookingId })
        this.code = r.code || ''
        this.checkedIn = true
        uni.hideLoading()
        uni.showToast({ title: '报到成功 / Checked in', icon: 'success' })
      } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: e.message || '报到失败 / Failed', icon: 'none' })
        this.load()
      }
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.center { padding: 120rpx 0; display: flex; flex-direction: column; align-items: center; }
.c-zh { font-size: 30rpx; color: #8a919c; }
.c-en { font-size: 24rpx; color: #c0c4cc; margin-top: 6rpx; }
.card { margin: 20rpx 24rpx; background: #ffffff; border-radius: 16rpx; padding: 24rpx; }
.room-name { font-size: 36rpx; font-weight: 700; color: #1f2329; }
.room-en { font-size: 24rpx; color: #8a919c; margin-top: 4rpx; }
.line { font-size: 26rpx; color: #4a5058; margin-top: 14rpx; }
.status-card {
  margin: 20rpx 24rpx; border-radius: 16rpx; padding: 48rpx 24rpx;
  display: flex; flex-direction: column; align-items: center;
}
.st-open { background: #e8f5ee; }
.st-ok { background: #fff4dd; }
.st-wait { background: #eef4ff; }
.st-end { background: #f0f1f3; }
.st-zh { font-size: 32rpx; font-weight: 600; color: #1f2329; }
.st-en { font-size: 24rpx; color: #8a919c; margin-top: 6rpx; }
.code {
  margin-top: 32rpx; font-size: 96rpx; font-weight: 800; letter-spacing: 16rpx;
  color: #1f2329; font-family: 'Courier New', monospace;
}
.st-hint { font-size: 24rpx; color: #8a919c; margin-top: 16rpx; text-align: center; }
.btn {
  margin-top: 32rpx; padding: 20rpx 80rpx; border-radius: 999rpx;
  font-size: 32rpx; font-weight: 600; color: #ffffff; background: #07c160;
}
</style>