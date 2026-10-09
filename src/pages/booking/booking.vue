<template>
  <view class="page">
    <view class="head">
      <view class="h-name">{{ room.name }}</view>
      <view class="h-en">{{ room.nameEn }} · {{ room.roomType === 'seat' ? '座位 / Seat' : '整房 / Room' }}</view>
    </view>

    <view class="card">
      <view class="row">
        <text class="label">日期</text>
        <text class="label-en">Date</text>
        <picker :range="days" @change="onDateChange" :value="dateIndex">
          <view class="picker-value">{{ selectedDate }}</view>
        </picker>
      </view>

      <view class="row">
        <text class="label">开始时间</text>
        <text class="label-en">Start</text>
        <picker :range="times" @change="onStartChange" :value="startIndex">
          <view class="picker-value">{{ times[startIndex] || '--:--' }}</view>
        </picker>
      </view>

      <view class="row">
        <text class="label">结束时间</text>
        <text class="label-en">End</text>
        <picker :range="times" @change="onEndChange" :value="endIndex">
          <view class="picker-value">{{ times[endIndex] || '--:--' }}</view>
        </picker>
      </view>

      <view class="duration">
        <text class="du-zh">时长 / Duration：{{ durationText }}</text>
        <text v-if="room.roomType === 'seat'" class="du-hint">座位单次最长 10 小时 / Max 10 hours for seats</text>
        <text v-else class="du-hint">超过 3 小时将转为申请 / Over 3 hours becomes an application</text>
      </view>
    </view>

    <view v-if="room.roomType === 'seat'" class="card">
      <view class="sec-title">选择座位</view>
      <view class="sec-title-en">Select Seats</view>
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
            :class="{ selected: selectedSeats.indexOf(s) >= 0 }"
            @click="toggleSeat(s)"
          >
            <text>{{ s }}</text>
          </view>
        </view>
      </view>
      <view class="notice">
        <text class="notice-zh">若在预约时间开始十五分钟后未到达座位，则视为自动放弃预约，其他人可以随意入座</text>
        <text class="notice-en">If you have not arrived at the seat within 15 minutes after the booking start time, the booking is considered automatically abandoned, and others may use the seat freely.</text>
      </view>
    </view>

    <view v-if="needReason" class="card">
      <view class="sec-title">申请原因</view>
      <view class="sec-title-en">Application Reason</view>
      <textarea v-model="reason" class="textarea" placeholder="请说明申请原因 / Please state the reason" />
    </view>

    <view class="card">
      <view class="notice-name">
        <text class="nn-zh">提醒：请务必使用真实的姓名和电话号码预约</text>
        <text class="nn-en">Reminder: Please book with your real name and phone number</text>
      </view>
      <view class="sec-title">预约人信息</view>
      <view class="sec-title-en">Contact Info</view>
      <view class="field">
        <view class="field-label">姓名 <text class="req">* 必填 / Required</text></view>
        <view class="field-en">Name</view>
        <input v-model="name" class="input wide" placeholder="请输入姓名 / Enter your name" placeholder-class="ph" />
      </view>
      <view class="field">
        <view class="field-label">手机号 <text class="req">* 必填 / Required</text></view>
        <view class="field-en">Phone</view>
        <input v-model="phone" class="input wide" type="number" maxlength="11" placeholder="请输入 11 位手机号 / Enter 11-digit phone" placeholder-class="ph" />
      </view>
    </view>

    <view class="submit" :class="{ disabled: submitting }" @click="submit">
      <text class="s-zh">{{ submitting ? '提交中... / Submitting...' : submitText }}</text>
      <text class="s-en">{{ submitting ? '请稍候 / Please wait' : submitTextEn }}</text>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { roomById, SEAT_ZONES, SLOT_MINUTES, NORMAL_MAX_HOURS, APPLY_MAX_HOURS, SEAT_MAX_HOURS } from '@/config/index.js'
import { todayStr, addDaysStr, dayRange, generateSlots, tsToTimeStr, toTs, hoursBetween, availableStartTs } from '@/utils/time.js'
import { validateSeatSelection, seatDurationOk } from '@/utils/booking.js'
import { callFunction } from '@/utils/cloud.js'
import { ensureLogin, getLocalProfile, setLocalProfile } from '@/utils/auth.js'
import ContactFooter from '@/components/ContactFooter.vue'

export default {
  components: { ContactFooter },
  data() {
    return {
      roomId: '',
      room: { roomId: '', name: '', nameEn: '', roomType: 'room' },
      zones: SEAT_ZONES,
      days: [],
      times: [],
      dateIndex: 0,
      selectedDate: todayStr(),
      startIndex: 0,
      endIndex: 1,
      selectedSeats: [],
      reason: '',
      name: '',
      phone: '',
      submitting: false
    }
  },
  computed: {
    startTs() {
      return toTs(this.selectedDate, this.times[this.startIndex] || '00:00')
    },
    endTs() {
      return toTs(this.selectedDate, this.times[this.endIndex] || '00:30')
    },
    hours() {
      return hoursBetween(this.startTs, this.endTs)
    },
    durationText() {
      const h = this.hours
      return h + ' 小时 / hours'
    },
    needReason() {
      return this.room.roomType === 'room' && this.hours > NORMAL_MAX_HOURS
    },
    submitText() {
      if (this.needReason) return '提交申请'
      return '确认预约'
    },
    submitTextEn() {
      if (this.needReason) return 'Submit Application'
      return 'Confirm Booking'
    }
  },
  onLoad(options) {
    this.roomId = options.roomId || ''
    const base = roomById(this.roomId)
    if (base) this.room = { ...this.room, ...base }
    this.buildDays()
    this.buildTimes(this.selectedDate)
    // 预选日期
    if (options.date) {
      const idx = this.days.indexOf(options.date)
      if (idx >= 0) { this.dateIndex = idx; this.selectedDate = options.date }
    }
    // 预选开始时间
    if (options.start) {
      const idx = this.times.indexOf(options.start)
      if (idx >= 0) {
        this.startIndex = idx
        this.endIndex = Math.min(idx + 2, this.times.length - 1)
      }
    }
    // 预选座位
    if (options.seat) {
      const n = Number(options.seat)
      if (n) this.selectedSeats = [n]
    }
    // 自动带出资料
    const p = getLocalProfile()
    if (p) { this.name = p.name || ''; this.phone = p.phone || '' }
  },
  methods: {
    buildDays() {
      const arr = []
      for (let i = 0; i < 7; i++) arr.push(addDaysStr(todayStr(), i))
      this.days = arr
    },
    buildTimes(dateStr) {
      const day = dayRange(dateStr || todayStr())
      const start = availableStartTs(dateStr || todayStr(), SLOT_MINUTES)
      const arr = []
      for (let t = start; t < day.end; t += SLOT_MINUTES * 60000) {
        arr.push(tsToTimeStr(t))
      }
      arr.push('24:00')
      this.times = arr
    },
    onDateChange(e) {
      this.dateIndex = Number(e.detail.value)
      this.selectedDate = this.days[this.dateIndex]
      this.buildTimes(this.selectedDate)
      this.startIndex = 0
      this.endIndex = Math.min(1, this.times.length - 1)
    },
    onStartChange(e) {
      let idx = Number(e.detail.value)
      if (idx >= this.times.length - 1) idx = this.times.length - 2
      this.startIndex = idx
      if (this.endIndex <= this.startIndex) {
        this.endIndex = Math.min(this.startIndex + 1, this.times.length - 1)
      }
    },
    onEndChange(e) {
      this.endIndex = Number(e.detail.value)
    },
    toggleSeat(s) {
      const cur = this.selectedSeats
      const inZone = (zone) => zone.seats.indexOf(s) >= 0
      const selectedZoneId = cur.length ? (this.zones.find(z => z.seats.indexOf(cur[0]) >= 0) || {}).id : null
      const thisZone = this.zones.find(inZone)
      if (!thisZone) return
      if (selectedZoneId && selectedZoneId !== thisZone.id) {
        this.selectedSeats = [s]
        return
      }
      if (cur.indexOf(s) >= 0) {
        this.selectedSeats = cur.filter(x => x !== s)
        return
      }
      if (thisZone.mode === 'single') {
        this.selectedSeats = [s]
        return
      }
      if (cur.length < thisZone.maxSelect) {
        this.selectedSeats = cur.concat([s])
      } else {
        uni.showToast({ title: '该座区最多选 4 个 / Max 4 seats', icon: 'none' })
      }
    },
    validate() {
      if (this.endIndex <= this.startIndex) {
        uni.showToast({ title: '结束时间需晚于开始时间 / End must be after start', icon: 'none' })
        return false
      }
      if (this.room.roomType === 'seat') {
        const r = validateSeatSelection(this.selectedSeats)
        if (!r.ok) { uni.showToast({ title: r.reason, icon: 'none' }); return false }
        if (!seatDurationOk(this.hours)) {
          uni.showToast({ title: '座位单次最长 10 小时 / Max 10 hours', icon: 'none' })
          return false
        }
      } else {
        if (this.hours > APPLY_MAX_HOURS) {
          uni.showToast({ title: '单次申请最长 24 小时 / Max 24 hours', icon: 'none' })
          return false
        }
        if (this.needReason && !this.reason.trim()) {
          uni.showToast({ title: '请填写申请原因 / Please enter a reason', icon: 'none' })
          return false
        }
      }
      if (!this.name.trim()) { uni.showToast({ title: '请填写姓名 / Please enter name', icon: 'none' }); return false }
      if (!/^1\d{10}$/.test(this.phone.trim())) {
        uni.showToast({ title: '请输入 11 位手机号 / Enter an 11-digit phone', icon: 'none' })
        return false
      }
      return true
    },
    async submit() {
      if (this.submitting) return
      if (!this.validate()) return
      try {
        await ensureLogin()
      } catch (e) {
        uni.showToast({ title: '请先登录 / Please sign in first', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const payload = {
          roomId: this.roomId,
          startTs: this.startTs,
          endTs: this.endTs,
          name: this.name.trim(),
          phone: this.phone.trim()
        }
        if (this.room.roomType === 'seat') {
          payload.action = 'createSeatBooking'
          payload.seatIds = this.selectedSeats.slice().sort((a, b) => a - b)
        } else {
          payload.action = 'createRoomBooking'
          payload.reason = this.reason.trim()
        }
        await callFunction('booking', payload)
        setLocalProfile({ name: this.name.trim(), phone: this.phone.trim() })
        uni.showToast({ title: '提交成功 / Submitted', icon: 'success' })
        setTimeout(() => {
          this.backToRoom()
        }, 600)
      } catch (e) {
        uni.showToast({ title: e.message || '提交失败 / Failed', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
    backToRoom() {
      let stackLength = 0
      try {
        stackLength = (getCurrentPages() || []).length
      } catch (e) {
        stackLength = 0
      }
      if (stackLength > 1) {
        uni.navigateBack({ delta: 1 })
        return
      }
      const url = this.room.roomType === 'seat'
        ? '/pages/seat/seat?roomId=' + this.roomId
        : '/pages/room/room?roomId=' + this.roomId
      uni.redirectTo({ url })
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.head { padding: 32rpx; background: #ffffff; }
.h-name { font-size: 40rpx; font-weight: 700; color: #1f2329; }
.h-en { font-size: 26rpx; color: #8a919c; margin-top: 6rpx; }
.card { margin: 20rpx 24rpx; background: #ffffff; border-radius: 16rpx; padding: 24rpx; }
.row { display: flex; align-items: center; margin-bottom: 20rpx; }
.label { font-size: 28rpx; color: #1f2329; width: 160rpx; }
.label-en { font-size: 20rpx; color: #8a919c; width: 120rpx; }
.picker-value { font-size: 28rpx; color: #0f6fff; }
.duration { padding-top: 8rpx; border-top: 1rpx solid #f0f0f0; }
.du-zh { font-size: 28rpx; color: #1f2329; }
.du-hint { display: block; font-size: 22rpx; color: #faad14; margin-top: 6rpx; }
.sec-title { font-size: 30rpx; font-weight: 600; color: #1f2329; }
.sec-title-en { font-size: 22rpx; color: #8a919c; margin-top: 4rpx; margin-bottom: 16rpx; }
.zone { margin-bottom: 20rpx; }
.zone-head { margin-bottom: 12rpx; }
.z-name { font-size: 28rpx; font-weight: 600; color: #1f2329; }
.z-en { font-size: 22rpx; color: #8a919c; margin-left: 10rpx; }
.seat-row { display: flex; flex-wrap: wrap; }
.seat {
  width: 18%; margin: 2%; padding: 18rpx 0; border-radius: 12rpx; text-align: center;
  background: #f5f6f8; color: #1f2329; font-size: 30rpx; font-weight: 600;
}
.seat.selected { background: #07c160; color: #ffffff; }
.notice { margin-top: 16rpx; padding: 16rpx; background: #fff8e6; border-radius: 12rpx; }
.notice-zh { font-size: 24rpx; color: #8a6d1a; line-height: 1.5; }
.notice-en { display: block; font-size: 22rpx; color: #b28a2e; margin-top: 6rpx; line-height: 1.5; }
.textarea { width: 100%; height: 160rpx; background: #f5f6f8; border-radius: 12rpx; padding: 16rpx; font-size: 28rpx; box-sizing: border-box; }
.notice-name { margin-bottom: 20rpx; padding: 20rpx 24rpx; background: #fff8e6; border-radius: 12rpx; display: flex; flex-direction: column; }
.nn-zh { font-size: 28rpx; color: #8a6d1a; font-weight: 600; }
.nn-en { font-size: 22rpx; color: #b28a2e; margin-top: 6rpx; }
.field { margin-bottom: 24rpx; }
.field-label { font-size: 28rpx; color: #1f2329; font-weight: 600; }
.field-en { font-size: 22rpx; color: #8a919c; margin-top: 4rpx; }
.req { font-size: 22rpx; color: #f5222d; font-weight: normal; }
.input { width: 100%; background: #f5f6f8; border-radius: 12rpx; padding: 28rpx 20rpx; font-size: 30rpx; margin-top: 12rpx; margin-bottom: 8rpx; box-sizing: border-box; min-height: 96rpx; }
.ph { color: #c0c4cc; }
.submit {
  margin: 24rpx; padding: 28rpx; background: #07c160; border-radius: 16rpx;
  display: flex; flex-direction: column; align-items: center;
}
.submit.disabled { opacity: 0.6; }
.s-zh { color: #ffffff; font-size: 34rpx; font-weight: 600; }
.s-en { color: #eafff1; font-size: 24rpx; margin-top: 4rpx; }
</style>