<template>
  <view class="page">
    <swiper v-if="room.images && room.images.length" class="banner" circular indicator-dots>
      <swiper-item v-for="(img, i) in room.images" :key="i">
        <image :src="img" class="banner-img" mode="aspectFill" />
      </swiper-item>
    </swiper>
    <view v-else class="banner banner-empty">803</view>

    <view class="info">
      <view class="i-name">{{ room.name }}</view>
      <view class="i-en">{{ room.nameEn }}</view>
      <view class="i-intro">{{ room.intro || '暂无介绍 / No description yet' }}</view>
    </view>

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

    <view class="tip">
      <text class="tip-zh">点击座位查看并预约该座位当天时段</text>
      <text class="tip-en">Tap a seat to view and book its slots for the day</text>
    </view>

    <view v-for="zone in zones" :key="zone.id" class="zone">
      <view class="zone-head">
        <text class="z-name">{{ zone.name }}</text>
        <text class="z-en">{{ zone.nameEn }}</text>
      </view>
      <view class="seat-row">
        <view
          v-for="s in zone.seats"
          :key="s"
          class="seat"
          :class="seatState(s).cls"
          @click="goBook(s)"
        >
          <text class="seat-no">{{ s }}</text>
          <text class="seat-state">{{ seatState(s).label }}</text>
        </view>
      </view>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { roomById, SEAT_ZONES } from '@/config/index.js'
import { getDb } from '@/utils/cloud.js'
import { ensureLogin } from '@/utils/auth.js'
import { todayStr, addDaysStr, tsToTimeStr, tsToDateStr, bookingOnDate } from '@/utils/time.js'
import ContactFooter from '@/components/ContactFooter.vue'

export default {
  components: { ContactFooter },
  data() {
    return {
      roomId: '803',
      room: { roomId: '803', name: '', nameEn: '', images: [], intro: '' },
      zones: SEAT_ZONES,
      days: [],
      today: todayStr(),
      selectedDate: todayStr(),
      bookings: [],
      watcher: null
    }
  },
  onLoad(options) {
    this.roomId = options.roomId || '803'
    const base = roomById(this.roomId)
    if (base) this.room = { ...this.room, ...base }
    this.buildDays()
    this.loadRoomInfo()
    this.setupWatch()
    ensureLogin().catch(() => {})
  },
  onShow() {
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
    },
    async loadRoomInfo() {
      try {
        const db = getDb()
        const res = await new Promise((resolve, reject) => {
          db.collection('rooms').where({ roomId: this.roomId }).get({ success: resolve, fail: reject })
        })
        const docs = res.data || []
        if (docs.length) {
          this.room.images = docs[0].images || []
          this.room.intro = docs[0].intro || ''
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
            onChange: (snapshot) => { this.bookings = snapshot.docs || [] },
            onError: (err) => { console.warn('watch error', err); this.loadBookingsOnce() }
          })
      } catch (e) {
        this.loadBookingsOnce()
      }
    },
    loadBookingsOnce() {
      try {
        const db = getDb()
        db.collection('bookings').where({ roomId: this.roomId }).get({
          success: (res) => { this.bookings = res.data || [] },
          fail: () => {}
        })
      } catch (e) {}
    },
    seatBookings(seatNo) {
      return this.bookings.filter(b =>
        (b.status === 'approved' || b.status === 'pending') &&
        (b.seatIds || []).indexOf(seatNo) >= 0 &&
        bookingOnDate(b.startTs, b.endTs, this.selectedDate)
      )
    },
    seatState(seatNo) {
      const list = this.seatBookings(seatNo)
      if (!list.length) return { cls: 'free', label: '空闲 / Free' }
      return { cls: 'busy', label: this.formatRange(list[0]) }
    },
    formatRange(b) {
      const start = b.startTs
      const end = b.endTs
      if (tsToDateStr(start) === tsToDateStr(end)) {
        return tsToTimeStr(start) + '-' + tsToTimeStr(end)
      }
      return tsToDateStr(start).slice(5) + ' ' + tsToTimeStr(start) + '~' + tsToDateStr(end).slice(5) + ' ' + tsToTimeStr(end)
    },
    goBook(seatNo) {
      uni.navigateTo({ url: `/pages/booking/booking?roomId=${this.roomId}&date=${this.selectedDate}&seat=${seatNo}` })
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.banner { height: 340rpx; }
.banner-img { width: 100%; height: 340rpx; }
.banner-empty {
  height: 340rpx; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #e8f5ee, #d3ede0); color: #07c160; font-size: 72rpx; font-weight: 700;
}
.info { padding: 24rpx 32rpx; background: #ffffff; }
.i-name { font-size: 40rpx; font-weight: 700; color: #1f2329; }
.i-en { font-size: 26rpx; color: #8a919c; margin-top: 4rpx; }
.i-intro { font-size: 28rpx; color: #4a5058; margin-top: 16rpx; line-height: 1.6; }
.date-bar { white-space: nowrap; background: #ffffff; padding: 16rpx; border-top: 1rpx solid #f0f0f0; }
.date-item {
  display: inline-flex; flex-direction: column; align-items: center;
  padding: 12rpx 24rpx; margin-right: 12rpx; border-radius: 12rpx; background: #f5f6f8;
}
.date-item.active { background: #07c160; }
.d-main { font-size: 28rpx; color: #1f2329; }
.d-sub { font-size: 20rpx; color: #8a919c; }
.date-item.active .d-main, .date-item.active .d-sub { color: #ffffff; }
.tip { padding: 20rpx 32rpx 8rpx; display: flex; flex-direction: column; }
.tip-zh { font-size: 26rpx; color: #4a5058; }
.tip-en { font-size: 22rpx; color: #8a919c; margin-top: 4rpx; }
.zone { margin: 20rpx 24rpx; background: #ffffff; border-radius: 16rpx; padding: 24rpx; }
.zone-head { margin-bottom: 16rpx; }
.z-name { font-size: 32rpx; font-weight: 600; color: #1f2329; }
.z-en { font-size: 24rpx; color: #8a919c; margin-left: 12rpx; }
.seat-row { display: flex; flex-wrap: wrap; }
.seat {
  width: 21%; margin: 2%; padding: 16rpx 0; border-radius: 12rpx;
  display: flex; flex-direction: column; align-items: center; background: #e8f5ee;
}
.seat.busy { background: #f0f1f3; }
.seat-no { font-size: 32rpx; font-weight: 700; color: #1f2329; }
.seat-state { font-size: 18rpx; color: #07c160; margin-top: 4rpx; text-align: center; }
.seat.busy .seat-state { color: #c0c4cc; }
</style>