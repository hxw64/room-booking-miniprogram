<template>
  <view class="page">
    <swiper v-if="room.images && room.images.length" class="banner" circular indicator-dots>
      <swiper-item v-for="(img, i) in room.images" :key="i">
        <image :src="img" class="banner-img" mode="aspectFill" />
      </swiper-item>
    </swiper>
    <view v-else class="banner banner-empty">{{ room.roomId }}</view>

    <view class="info">
      <view class="i-name">{{ room.name }}</view>
      <view class="i-en">{{ room.nameEn }}</view>
      <view class="i-no">房间号 / Room No. {{ room.roomId }}</view>
      <view class="i-intro">{{ room.intro || '暂无介绍 / No description yet' }}</view>
    </view>

    <view v-if="room.openAccess" class="open-panel">
      <view class="op-title">无需预约，完全开放</view>
      <view class="op-en">No booking required, fully open to everyone</view>
      <view class="op-line">请大家共同使用并维护环境卫生</view>
      <view class="op-en">Please use together and help keep the space clean</view>
    </view>
    <template v-else>

    <scroll-view scroll-x class="date-bar">
      <view
        v-for="d in days"
        :key="d"
        class="date-item"
        :class="{ active: d === selectedDate }"
        @click="selectDate(d)"
      >
        <text class="d-main">{{ d.slice(5) }}</text>
        <text class="d-sub">{{ d === today ? '今天 / Today' : '' }}</text>
      </view>
    </scroll-view>

    <view class="legend">
      <text class="lg-free">可预约 / Available</text>
      <text class="lg-busy">已预约 / Booked</text>
      <text class="lg-pending">待确认 / Pending</text>
      <text class="lg-past">已过期 / Past</text>
    </view>

    <view class="grid">
      <view
        v-for="s in slots"
        :key="s.ts"
        class="slot"
        :class="s.state"
        @click="tapSlot(s)"
      >
        <text class="slot-time">{{ s.time }}</text>
        <text class="slot-state">{{ stateLabel(s.state) }}</text>
      </view>
    </view>
    </template>

    <ContactFooter />
  </view>
</template>

<script>
import { roomById } from '@/config/index.js'
import { getDb } from '@/utils/cloud.js'
import { ensureLogin } from '@/utils/auth.js'
import { todayStr, addDaysStr, dayRange, generateSlots, tsToTimeStr, hasOverlap, bookingOnDate } from '@/utils/time.js'
import ContactFooter from '@/components/ContactFooter.vue'

export default {
  components: { ContactFooter },
  data() {
    return {
      roomId: '',
      room: { roomId: '', name: '', nameEn: '', roomType: 'room', openAccess: false, images: [], intro: '' },
      days: [],
      today: todayStr(),
      selectedDate: todayStr(),
      slots: [],
      bookings: [],
      watcher: null
    }
  },
  onLoad(options) {
    this.roomId = options.roomId || ''
    const base = roomById(this.roomId)
    if (base) this.room = { ...this.room, ...base }
    this.buildDays()
    if (!this.room.openAccess) {
      this.computeSlots()
      this.setupWatch()
    }
    this.loadRoomInfo()
    ensureLogin().catch(() => {})
  },
  onShow() {
    if (this.room.openAccess) return
    try {
      this.loadBookingsOnce()
    } catch (e) {}
  },
  onUnload() {
    if (this.watcher) {
      try { this.watcher.close() } catch (e) {}
      this.watcher = null
    }
  },
  methods: {
    buildDays() {
      const arr = []
      for (let i = 0; i < 7; i++) arr.push(addDaysStr(todayStr(), i))
      this.days = arr
    },
    selectDate(d) {
      this.selectedDate = d
      this.computeSlots()
    },
    async loadRoomInfo() {
      try {
        const db = getDb()
        const res = await new Promise((resolve, reject) => {
          db.collection('rooms').where({ roomId: this.roomId }).get({ success: resolve, fail: reject })
        })
        const docs = res.data || []
        if (docs.length) {
          const d = docs[0]
          this.room.images = d.images || []
          this.room.intro = d.intro || ''
        }
      } catch (e) {
        console.warn('load room info failed', e)
      }
    },
    setupWatch() {
      try {
        const db = getDb()
        this.watcher = db.collection('bookings')
          .where({ roomId: this.roomId })
          .watch({
            onChange: (snapshot) => {
              this.bookings = snapshot.docs || []
              this.computeSlots()
            },
            onError: (err) => {
              console.warn('watch error', err)
              this.loadBookingsOnce()
            }
          })
      } catch (e) {
        this.loadBookingsOnce()
      }
    },
    loadBookingsOnce() {
      try {
        const db = getDb()
        db.collection('bookings').where({ roomId: this.roomId }).get({
          success: (res) => {
            this.bookings = res.data || []
            this.computeSlots()
          },
          fail: () => {}
        })
      } catch (e) {}
    },
    validBookings() {
      return this.bookings.filter(b => b.status === 'approved' || b.status === 'pending')
    },
    computeSlots() {
      const { start, end } = dayRange(this.selectedDate)
      const starts = generateSlots(start, end, 30)
      const valid = this.validBookings()
      const now = Date.now()
      this.slots = starts.map(ts => {
        const slotEnd = ts + 30 * 60000
        const past = this.selectedDate === this.today && ts < now
        const pending = valid.some(b => b.status === 'pending' && hasOverlap(ts, slotEnd, b.startTs, b.endTs))
        const busy = valid.some(b => b.status === 'approved' && hasOverlap(ts, slotEnd, b.startTs, b.endTs))
        let state = busy ? 'busy' : (pending ? 'pending' : 'free')
        if (past) state = 'past'
        return { ts, time: tsToTimeStr(ts), state }
      })
    },
    stateLabel(state) {
      if (state === 'busy') return '已预约 / Booked'
      if (state === 'pending') return '待确认 / Pending'
      if (state === 'past') return '已过期 / Past'
      return '可约 / Free'
    },
    tapSlot(s) {
      if (s.state !== 'free') return
      uni.navigateTo({ url: `/pages/booking/booking?roomId=${this.roomId}&date=${this.selectedDate}&start=${s.time}` })
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.banner { height: 360rpx; }
.banner-img { width: 100%; height: 360rpx; }
.banner-empty {
  height: 360rpx; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #e8f5ee, #d3ede0); color: #07c160; font-size: 72rpx; font-weight: 700;
}
.info { padding: 24rpx 32rpx; background: #ffffff; }
.i-name { font-size: 40rpx; font-weight: 700; color: #1f2329; }
.i-en { font-size: 26rpx; color: #8a919c; margin-top: 4rpx; }
.i-no { font-size: 24rpx; color: #8a919c; margin-top: 10rpx; }
.i-intro { font-size: 28rpx; color: #4a5058; margin-top: 16rpx; line-height: 1.6; }
.date-bar { white-space: nowrap; background: #ffffff; padding: 16rpx 16rpx; border-top: 1rpx solid #f0f0f0; }
.date-item {
  display: inline-flex; flex-direction: column; align-items: center;
  padding: 12rpx 24rpx; margin-right: 12rpx; border-radius: 12rpx; background: #f5f6f8;
}
.date-item.active { background: #07c160; }
.d-main { font-size: 28rpx; color: #1f2329; }
.d-sub { font-size: 20rpx; color: #8a919c; }
.date-item.active .d-main, .date-item.active .d-sub { color: #ffffff; }
.legend { display: flex; gap: 24rpx; padding: 20rpx 32rpx 8rpx; font-size: 24rpx; color: #8a919c; }
.lg-free { color: #07c160; }
.lg-busy { color: #c0c4cc; }
.lg-pending { color: #faad14; }
.lg-past { color: #d0d3d8; }
.grid { display: flex; flex-wrap: wrap; padding: 8rpx 24rpx 24rpx; }
.open-panel { margin: 20rpx 24rpx; padding: 48rpx 32rpx; background: #e8f5ee; border-radius: 16rpx; display: flex; flex-direction: column; align-items: center; }
.op-title { font-size: 34rpx; font-weight: 700; color: #07c160; }
.op-line { font-size: 28rpx; color: #1f2329; margin-top: 16rpx; }
.op-en { font-size: 24rpx; color: #8a919c; margin-top: 6rpx; }
.slot {
  width: 22%; margin: 1.5%; padding: 14rpx 0; border-radius: 10rpx;
  display: flex; flex-direction: column; align-items: center; background: #e8f5ee;
}
.slot.busy { background: #f0f1f3; }
.slot.pending { background: #fff4dd; }
.slot.past { background: #fafafa; }
.slot-time { font-size: 24rpx; color: #1f2329; }
.slot-state { font-size: 20rpx; color: #07c160; margin-top: 2rpx; }
.slot.busy .slot-state { color: #c0c4cc; }
.slot.pending .slot-state { color: #faad14; }
.slot.past .slot-state { color: #d0d3d8; }
</style>