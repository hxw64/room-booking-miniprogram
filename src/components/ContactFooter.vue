<template>
  <view class="contact-footer">
    <view class="cf-title">联系我们</view>
    <view class="cf-en">Contact Us</view>
    <view class="cf-email" @click="copyEmail">邮箱：{{ email }}</view>
    <view class="cf-en">Email: {{ email }}</view>
  </view>
</template>

<script>
import { CONTACT_EMAIL } from '@/config/index.js'
export default {
  name: 'ContactFooter',
  data() {
    return { email: CONTACT_EMAIL }
  },
  methods: {
    copyEmail() {
      uni.setClipboardData({
        data: this.email,
        success() {
          uni.showToast({ title: '已复制 / Copied', icon: 'none' })
        }
      })
    }
  }
}
</script>

<style scoped>
.contact-footer {
  margin-top: 40rpx;
  padding: 32rpx 24rpx;
  background: #ffffff;
  border-top: 1rpx solid #ececec;
  text-align: center;
}
.cf-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2329;
}
.cf-en {
  font-size: 24rpx;
  color: #8a919c;
  margin-top: 6rpx;
}
.cf-email {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #0f6fff;
}
</style>