<template>
  <view class="page">
    <view class="header">
      <view class="h-title">申请审核</view>
      <view class="h-en">Review Applications</view>
      <view class="h-hint">超过 4 小时未处理的申请将自动通过 / Applications left over 4 hours are auto-approved</view>
    </view>

    <view v-if="!list.length" class="empty">
      <text class="e-zh">暂无待审核申请</text>
      <text class="e-en">No pending applications</text>
    </view>

    <view v-for="b in list" :key="b._id" class="item">
      <view class="item-top">
        <text class="it-name">{{ b.roomName }}</text>
        <text class="it-status st-pending">待审核 / Pending</text>
      </view>
      <view class="item-line">时间 / Time: {{ timeRange(b) }}</view>
      <view class="item-line">时长 / Duration: {{ duration(b) }}</view>
      <view class="item-line">申请人 / Name: {{ b.name }}</view>
      <view class="item-line">手机号 / Phone: {{ b.phone }}</view>
      <view class="item-line">原因 / Reason: {{ b.reason || '-' }}</view>
      <view class="item-line">提交时间 / Submitted: {{ submitTime(b) }}</view>
      <view class="item-actions">
        <view class="btn approve" @click="decide(b, 'approve')">批准 / Approve</view>
        <view class="btn reject" @click="decide(b, 'reject')">拒绝 / Reject</view>
      </view>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { roomById } from '@/config/index.js'
import { ensureLogin } from '@/utils/auth.js'
import { callFunction } from '@/utils/cloud.js'
import { tsToDateStr, tsToTimeStr, hoursBetween } from '@/utils/time.js'
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
      const data = await callFunction('admin', { action: 'listApplications' })
      this.list = (data.list || []).map(b => {
        const room = roomById(b.roomId) || { name: b.roomId, nameEn: '' }
        return { ...b, roomName: room.name, roomNameEn: room.nameEn }
      })
    },
    timeRange(b) {
      return tsToDateStr(b.startTs) + ' ' + tsToTimeStr(b.startTs) + ' ~ ' + tsToDateStr(b.endTs) + ' ' + tsToTimeStr(b.endTs)
    },
    duration(b) {
      return hoursBetween(b.startTs, b.endTs) + ' 小时 / hours'
    },
    submitTime(b) {
      return b.createdAt ? new Date(b.createdAt).toLocaleString() : '-'
    },
    async decide(b, decision) {
      uni.showModal({
        title: '确认 / Confirm',
        content: decision === 'approve' ? '批准该申请？/ Approve this application?' : '拒绝该申请？/ Reject this application?',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '处理中 / Processing' })
          try {
            await callFunction('admin', { action: decision, bookingId: b._id })
            uni.hideLoading()
            uni.showToast({ title: '已处理 / Done', icon: 'success' })
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
.h-hint { font-size: 22rpx; color: #faad14; margin-top: 12rpx; }
.empty { padding: 120rpx 0; display: flex; flex-direction: column; align-items: center; }
.e-zh { font-size: 30rpx; color: #8a919c; }
.e-en { font-size: 24rpx; color: #c0c4cc; margin-top: 6rpx; }
.item { margin: 20rpx 24rpx; background: #ffffff; border-radius: 16rpx; padding: 24rpx; }
.item-top { display: flex; justify-content: space-between; align-items: center; }
.it-name { font-size: 32rpx; font-weight: 600; color: #1f2329; }
.it-status { font-size: 24rpx; padding: 4rpx 16rpx; border-radius: 999rpx; }
.st-pending { color: #b26a00; background: #fff4dd; }
.item-line { font-size: 26rpx; color: #4a5058; margin-top: 10rpx; }
.item-actions { display: flex; justify-content: flex-end; gap: 20rpx; margin-top: 16rpx; }
.btn { padding: 12rpx 32rpx; border-radius: 999rpx; font-size: 26rpx; }
.approve { color: #ffffff; background: #07c160; }
.reject { color: #f5222d; background: #ffecec; }
</style>