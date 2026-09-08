<template>
  <view class="page">
    <view class="header">
      <view class="h-title">预约管理</view>
      <view class="h-en">Manage Bookings</view>
    </view>

    <view v-if="!list.length" class="empty">
      <text class="e-zh">暂无预约</text>
      <text class="e-en">No bookings</text>
    </view>

    <view v-for="b in list" :key="b._id" class="item">
      <view class="item-top">
        <text class="it-name">{{ b.roomName }}</text>
        <text class="it-status" :class="'st-' + b.status">{{ statusLabel(b) }}</text>
      </view>
      <view class="item-line">时间 / Time: {{ timeRange(b) }}</view>
      <view v-if="b.seatText" class="item-line">座位 / Seats: {{ b.seatText }}</view>
      <view class="item-line">类型 / Type: {{ typeLabel(b) }}</view>
      <view class="item-line contact">姓名 / Name: {{ b.name }}</view>
      <view class="item-line contact">手机号 / Phone: {{ b.phone }}</view>
      <view v-if="b.status === 'approved' || b.status === 'pending'" class="item-actions">
        <view class="btn cancel" @click="doCancel(b)">取消预约 / Cancel</view>
      </view>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { roomById } from '@/config/index.js'
import { ensureLogin } from '@/utils/auth.js'
import { callFunction } from '@/utils/cloud.js'
import { tsToDateStr, tsToTimeStr } from '@/utils/time.js'
import ContactFooter from '@/components/ContactFooter.vue'

export default {
  components: { ContactFooter },
  data() {
    return { list: [] }
  },
  async onShow() {
    try {
      await ensureLogin()
      await this.load()
    } catch (e) {
      uni.showToast({ title: '无权限 / No access', icon: 'none' })
    }
  },
  methods: {
    async load() {
      const data = await callFunction('admin', { action: 'listAllBookings' })
      this.list = (data.list || []).map(b => {
        const room = roomById(b.roomId) || { name: b.roomId, nameEn: '' }
        return { ...b, roomName: room.name, roomNameEn: room.nameEn, seatText: (b.seatIds && b.seatIds.length) ? b.seatIds.join(', ') : '' }
      })
    },
    statusLabel(b) {
      if (b.type === 'apply') {
        return { approved: '已通过 / Approved', pending: '待审核 / Pending', rejected: '已拒绝 / Rejected', cancelled: '已撤销 / Withdrawn' }[b.status] || b.status
      }
      return { approved: '已预约 / Booked', cancelled: '已取消 / Cancelled' }[b.status] || b.status
    },
    typeLabel(b) {
      if (b.type === 'apply') return '申请 / Application'
      if (b.seatIds && b.seatIds.length) return '座位预约 / Seat'
      return '普通预约 / Room'
    },
    timeRange(b) {
      return tsToDateStr(b.startTs) + ' ' + tsToTimeStr(b.startTs) + ' ~ ' + tsToDateStr(b.endTs) + ' ' + tsToTimeStr(b.endTs)
    },
    async doCancel(b) {
      uni.showModal({
        title: '确认 / Confirm',
        content: '确定取消该预约？/ Cancel this booking?',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '处理中 / Processing' })
          try {
            await callFunction('admin', { action: 'adminCancel', bookingId: b._id })
            uni.hideLoading()
            uni.showToast({ title: '已取消 / Cancelled', icon: 'success' })
            this.load()
          } catch (e) {
            uni.hideLoading()
            uni.showToast({ title: e.message || '失败 / Failed', icon: 'none' })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.header { padding: 40rpx 32rpx 24rpx; background: #ffffff; }
.h-title { font-size: 44rpx; font-weight: 700; color: #1f2329; }
.h-en { font-size: 26rpx; color: #8a919c; margin-top: 6rpx; }
.empty { padding: 120rpx 0; display: flex; flex-direction: column; align-items: center; }
.e-zh { font-size: 30rpx; color: #8a919c; }
.e-en { font-size: 24rpx; color: #c0c4cc; margin-top: 6rpx; }
.item { margin: 20rpx 24rpx; background: #ffffff; border-radius: 16rpx; padding: 24rpx; }
.item-top { display: flex; justify-content: space-between; align-items: center; }
.it-name { font-size: 32rpx; font-weight: 600; color: #1f2329; }
.it-status { font-size: 24rpx; padding: 4rpx 16rpx; border-radius: 999rpx; }
.st-approved { color: #07c160; background: #e8f5ee; }
.st-pending { color: #b26a00; background: #fff4dd; }
.st-rejected { color: #f5222d; background: #ffecec; }
.st-cancelled { color: #8a919c; background: #f0f1f3; }
.item-line { font-size: 26rpx; color: #4a5058; margin-top: 10rpx; }
.contact { color: #0f6fff; }
.item-actions { display: flex; justify-content: flex-end; margin-top: 16rpx; }
.btn { padding: 12rpx 28rpx; border-radius: 999rpx; font-size: 26rpx; }
.cancel { color: #f5222d; background: #ffecec; }
</style>