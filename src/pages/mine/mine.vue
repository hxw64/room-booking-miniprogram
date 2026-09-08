<template>
  <view class="page">
    <view class="header">
      <view class="profile-row">
        <image v-if="avatar" :src="avatar" class="avatar" mode="aspectFill" />
        <view v-else class="avatar avatar-empty">微</view>
        <view class="profile-info">
          <view class="h-title">{{ nickName || '我的预约' }}</view>
          <view class="h-en">My Bookings</view>
        </view>
      </view>

      <view v-if="!nickName" class="bind-btn" @click="openBind">
        <text class="bind-zh">绑定微信账户</text>
        <text class="bind-en">Bind WeChat Account</text>
      </view>

      <view class="h-openid">openid: {{ openid }}</view>
      <view class="copy-openid" @click="copyOpenid">复制 openid / Copy OpenID</view>
    </view>

    <view v-if="isAdmin" class="admin-entry" @click="goAdmin">
      <text class="ae-zh">进入管理后台</text>
      <text class="ae-en">Admin Console</text>
    </view>

    <view v-if="!list.length" class="empty">
      <text class="e-zh">暂无预约记录</text>
      <text class="e-en">No bookings yet</text>
    </view>

    <view v-for="b in list" :key="b._id" class="item">
      <view class="item-top">
        <text class="it-name">{{ b.roomName }}</text>
        <text class="it-status" :class="'st-' + b.status">{{ statusLabel(b) }}</text>
      </view>
      <view class="item-en">{{ b.roomNameEn }}</view>
      <view class="item-line">{{ timeRange(b) }}</view>
      <view v-if="b.seatText" class="item-line">座位 / Seats: {{ b.seatText }}</view>
      <view class="item-line">类型 / Type: {{ typeLabel(b) }}</view>
      <view v-if="b.status === 'approved' || b.status === 'pending'" class="item-actions">
        <view v-if="b.status === 'approved'" class="btn checkin" @click="goCheckin(b)">
          <text>{{ b.checkedInAt ? '查看密码 / View Code' : '报到 / Check In' }}</text>
        </view>
        <view class="btn cancel" @click="doCancel(b)">
          <text>{{ b.status === 'pending' ? '撤销 / Withdraw' : '取消 / Cancel' }}</text>
        </view>
      </view>
    </view>

    <view v-if="showBind" class="mask" @click="showBind = false">
      <view class="dialog" @click.stop>
        <view class="d-title">绑定微信账户</view>
        <view class="d-en">Bind WeChat Account</view>

        <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image v-if="bindAvatarTemp" :src="bindAvatarTemp" class="avatar-preview" mode="aspectFill" />
          <view v-else class="avatar-preview avatar-preview-empty">选择头像 / Choose Avatar</view>
        </button>

        <input
          class="nick-input"
          type="nickname"
          placeholder="请输入昵称 / Enter nickname"
          :value="bindNickName"
          @input="onNickInput"
        />

        <view class="d-actions">
          <view class="d-btn cancel" @click="showBind = false">取消 / Cancel</view>
          <view class="d-btn ok" @click="saveBind">保存 / Save</view>
        </view>
      </view>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { roomById } from '@/config/index.js'
import { ensureLogin, getLocalUser, getLocalProfile, setLocalProfile } from '@/utils/auth.js'
import { callFunction } from '@/utils/cloud.js'
import { tsToDateStr, tsToTimeStr } from '@/utils/time.js'
import ContactFooter from '@/components/ContactFooter.vue'

export default {
  components: { ContactFooter },
  data() {
    return {
      list: [],
      isAdmin: false,
      openid: '',
      avatar: '',
      nickName: '',
      showBind: false,
      bindAvatarTemp: '',
      bindNickName: '',
      savingBind: false
    }
  },
  async onShow() {
    const user = getLocalUser()
    this.isAdmin = !!(user || {}).isAdmin
    this.openid = ((user || {}).openid || '')
    this.loadProfile()
    try {
      const u = await ensureLogin()
      this.isAdmin = !!u.isAdmin
      this.openid = u.openid || ''
      await this.load()
    } catch (e) {
      console.warn('mine load failed', e)
    }
  },
  methods: {
    loadProfile() {
      const p = getLocalProfile() || {}
      this.avatar = p.avatarFileID || ''
      this.nickName = p.nickName || ''
      this.bindNickName = this.nickName || ''
    },
    async load() {
      const data = await callFunction('booking', { action: 'listMine' })
      this.list = (data.list || []).map(b => {
        const room = roomById(b.roomId) || { name: b.roomId, nameEn: '' }
        return {
          ...b,
          roomName: room.name,
          roomNameEn: room.nameEn,
          seatText: (b.seatIds && b.seatIds.length) ? b.seatIds.join(', ') : ''
        }
      })
    },
    openBind() {
      this.bindAvatarTemp = ''
      this.bindNickName = this.nickName || ''
      this.showBind = true
    },
    onChooseAvatar(e) {
      this.bindAvatarTemp = e.detail.avatarUrl || ''
    },
    onNickInput(e) {
      this.bindNickName = e.detail.value || ''
    },
    async saveBind() {
      if (this.savingBind) return
      if (!this.bindNickName.trim()) {
        uni.showToast({ title: '请输入昵称 / Enter nickname', icon: 'none' })
        return
      }
      this.savingBind = true
      uni.showLoading({ title: '保存中 / Saving' })
      try {
        let fileID = this.avatar
        if (this.bindAvatarTemp) {
          fileID = await this.uploadAvatar(this.bindAvatarTemp)
        }
        const p = getLocalProfile() || {}
        p.avatarFileID = fileID || ''
        p.nickName = this.bindNickName.trim()
        setLocalProfile(p)
        this.avatar = fileID || ''
        this.nickName = p.nickName
        this.showBind = false
        uni.showToast({ title: '绑定成功 / Bound', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: '绑定失败 / Failed', icon: 'none' })
      } finally {
        this.savingBind = false
        uni.hideLoading()
      }
    },
    uploadAvatar(tempPath) {
      return new Promise((resolve, reject) => {
        const ext = (tempPath.split('.').pop() || 'png').toLowerCase()
        const cloudPath = 'avatars/' + this.openid + '-' + Date.now() + '.' + ext
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempPath,
          success: (res) => resolve(res.fileID),
          fail: (err) => reject(err)
        })
      })
    },
    copyOpenid() {
      if (!this.openid) {
        uni.showToast({ title: '暂无 openid / No openid', icon: 'none' })
        return
      }
      uni.setClipboardData({
        data: this.openid,
        success() {
          uni.showToast({ title: '已复制 / Copied', icon: 'none' })
        }
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
      const s = tsToDateStr(b.startTs) + ' ' + tsToTimeStr(b.startTs)
      const e = tsToDateStr(b.endTs) + ' ' + tsToTimeStr(b.endTs)
      return s + ' ~ ' + e
    },
    async doCancel(b) {
      const action = b.status === 'pending' ? 'withdraw' : 'cancel'
      uni.showModal({
        title: '确认操作 / Confirm',
        content: action === 'withdraw' ? '确定撤销该申请？/ Withdraw this application?' : '确定取消该预约？/ Cancel this booking?',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '处理中 / Processing' })
          try {
            await callFunction('booking', { action, bookingId: b._id })
            uni.hideLoading()
            uni.showToast({ title: '操作成功 / Done', icon: 'success' })
            this.load()
          } catch (e) {
            uni.hideLoading()
            uni.showToast({ title: e.message || '操作失败 / Failed', icon: 'none' })
          }
        }
      })
    },
    goCheckin(b) {
      uni.navigateTo({ url: '/pages/checkin/checkin?bookingId=' + b._id })
    },
    goAdmin() {
      uni.navigateTo({ url: '/pages/admin/admin' })
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.header { padding: 40rpx 32rpx 24rpx; background: #ffffff; }
.profile-row { display: flex; align-items: center; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; flex-shrink: 0; }
.avatar-empty {
  display: flex; align-items: center; justify-content: center;
  background: #e8f5ee; color: #07c160; font-size: 48rpx; font-weight: 700;
}
.profile-info { margin-left: 24rpx; }
.h-title { font-size: 40rpx; font-weight: 700; color: #1f2329; }
.h-en { font-size: 26rpx; color: #8a919c; margin-top: 6rpx; }
.bind-btn {
  margin-top: 20rpx; padding: 16rpx 24rpx; background: #eef4ff; border-radius: 12rpx;
  display: inline-flex; flex-direction: column;
}
.bind-zh { font-size: 28rpx; color: #0f6fff; }
.bind-en { font-size: 22rpx; color: #6b9fff; margin-top: 4rpx; }
.h-openid { font-size: 22rpx; color: #4a5058; margin-top: 16rpx; word-break: break-all; }
.copy-openid {
  margin-top: 10rpx; align-self: flex-start; font-size: 22rpx; color: #0f6fff;
  padding: 6rpx 18rpx; background: #eef4ff; border-radius: 999rpx;
}
.admin-entry {
  margin: 24rpx; padding: 28rpx; background: #1f2329; border-radius: 16rpx;
  display: flex; flex-direction: column; align-items: center;
}
.ae-zh { color: #ffffff; font-size: 32rpx; font-weight: 600; }
.ae-en { color: #b8bdc4; font-size: 24rpx; margin-top: 4rpx; }
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
.item-en { font-size: 24rpx; color: #8a919c; margin-top: 4rpx; }
.item-line { font-size: 26rpx; color: #4a5058; margin-top: 12rpx; }
.item-actions { display: flex; justify-content: flex-end; margin-top: 16rpx; }
.btn { padding: 12rpx 28rpx; border-radius: 999rpx; font-size: 26rpx; }
.cancel { color: #f5222d; background: #ffecec; }
.checkin { color: #ffffff; background: #07c160; margin-right: 16rpx; }
.mask {
  position: fixed; left: 0; top: 0; right: 0; bottom: 0; z-index: 999;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
}
.dialog { width: 600rpx; background: #ffffff; border-radius: 20rpx; padding: 40rpx; }
.d-title { font-size: 34rpx; font-weight: 700; color: #1f2329; }
.d-en { font-size: 24rpx; color: #8a919c; margin-top: 4rpx; }
.avatar-btn { margin-top: 24rpx; padding: 0; background: transparent; line-height: normal; border: none; }
.avatar-btn::after { border: none; }
.avatar-preview {
  width: 160rpx; height: 160rpx; border-radius: 50%; background: #f5f6f8; display: flex;
  align-items: center; justify-content: center; color: #8a919c; font-size: 24rpx;
}
.avatar-preview-empty { text-align: center; }
.nick-input {
  margin-top: 24rpx; width: 100%; background: #f5f6f8; border-radius: 12rpx;
  padding: 20rpx 16rpx; font-size: 28rpx; box-sizing: border-box;
}
.d-actions { display: flex; justify-content: flex-end; gap: 20rpx; margin-top: 32rpx; }
.d-btn { padding: 14rpx 40rpx; border-radius: 999rpx; font-size: 28rpx; }
.d-btn.cancel { color: #8a919c; background: #f0f1f3; }
.d-btn.ok { color: #ffffff; background: #07c160; }
</style>