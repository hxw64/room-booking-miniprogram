<template>
  <view class="page">
    <view class="card">
      <view class="sec">选择房间</view>
      <view class="sec-en">Select Room</view>
      <picker :range="roomNames" @change="onRoomChange" :value="roomIndex">
        <view class="picker-val">{{ rooms[roomIndex].name }} ({{ rooms[roomIndex].roomId }})</view>
      </picker>
    </view>

    <view class="card">
      <view class="sec">房间图片</view>
      <view class="sec-en">Room Images</view>
      <view class="img-grid">
        <view v-for="(img, i) in images" :key="i" class="img-wrap">
          <image :src="img" class="img" mode="aspectFill" />
          <view class="img-del" @click="removeImg(i)">删除 / Remove</view>
        </view>
        <view class="img-add" @click="addImg">+ 添加 / Add</view>
      </view>
    </view>

    <view class="card">
      <view class="sec">房间介绍</view>
      <view class="sec-en">Introduction</view>
      <textarea v-model="intro" class="textarea" placeholder="请输入房间介绍 / Enter room introduction" />
    </view>

    <view v-if="!rooms[roomIndex].openAccess" class="card">
      <view class="sec">房间密码</view>
      <view class="sec-en">Room Code (4 digits)</view>
      <input v-model="code" class="code-input" type="digit" placeholder="4 位数字开门密码 / 4-digit door code" placeholder-class="code-ph" cursor-spacing="30" :adjust-position="true" />
      <view class="code-hint">用户报到后才会显示该密码 / Users see it only after check-in</view>
    </view>

    <view class="submit" :class="{ disabled: saving }" @click="save">
      <text class="s-zh">{{ saving ? '保存中... / Saving...' : '保存' }}</text>
      <text class="s-en">{{ saving ? '请稍候 / Please wait' : 'Save' }}</text>
    </view>

    <ContactFooter />
  </view>
</template>

<script>
import { ROOMS } from '@/config/index.js'
import { ensureLogin } from '@/utils/auth.js'
import { callFunction, getDb } from '@/utils/cloud.js'
import ContactFooter from '@/components/ContactFooter.vue'

export default {
  components: { ContactFooter },
  data() {
    return { rooms: ROOMS, roomIndex: 0, images: [], intro: '', code: '', saving: false }
  },
  computed: {
    roomNames() {
      return this.rooms.map(r => r.name + ' (' + r.roomId + ')')
    }
  },
  async onLoad() {
    try {
      await ensureLogin()
      await this.loadRoom()
    } catch (e) {
      uni.showToast({ title: '无权限 / No access', icon: 'none' })
    }
  },
  methods: {
    async onRoomChange(e) {
      this.roomIndex = Number(e.detail.value)
      await this.loadRoom()
    },
    async loadRoom() {
      this.images = []
      this.intro = ''
      this.code = ''
      try {
        const db = getDb()
        const res = await new Promise((resolve, reject) => {
          db.collection('rooms').where({ roomId: this.rooms[this.roomIndex].roomId }).get({ success: resolve, fail: reject })
        })
        const docs = res.data || []
        if (docs.length) {
          this.images = docs[0].images || []
          this.intro = docs[0].intro || ''
        }
      } catch (e) {
        console.warn('load room failed', e)
      }
      try {
        const r = await callFunction('admin', { action: 'getRoomCode', roomId: this.rooms[this.roomIndex].roomId })
        this.code = (r.code || '').toString()
      } catch (e) {
        console.warn('load room code failed', e)
      }
    },
    addImg() {
      uni.chooseImage({
        count: 9,
        success: (res) => {
          const paths = res.tempFilePaths || []
          this.uploadFiles(paths)
        }
      })
    },
    uploadFiles(paths) {
      if (!paths.length) return
      const path = paths.shift()
      uni.showLoading({ title: '上传中 / Uploading' })
      const ext = path.split('.').pop() || 'png'
      const cloudPath = 'rooms/' + this.rooms[this.roomIndex].roomId + '/' + Date.now() + '-' + Math.floor(Math.random() * 1000) + '.' + ext
      wx.cloud.uploadFile({
        cloudPath,
        filePath: path,
        success: (res) => {
          this.images.push(res.fileID)
          uni.hideLoading()
          this.uploadFiles(paths)
        },
        fail: () => {
          uni.hideLoading()
          uni.showToast({ title: '上传失败 / Upload failed', icon: 'none' })
          this.uploadFiles(paths)
        }
      })
    },
    removeImg(i) {
      this.images.splice(i, 1)
    },
    async save() {
      if (this.saving) return
      this.saving = true
      try {
        await callFunction('admin', {
          action: 'updateRoom',
          roomId: this.rooms[this.roomIndex].roomId,
          images: this.images,
          intro: this.intro
        })
        const code = (this.code || '').trim()
        if (code && !/^\d{4}$/.test(code)) {
          throw new Error('密码需为 4 位数字 / Code must be 4 digits')
        }
        if (code) {
          await callFunction('admin', { action: 'updateRoomCode', roomId: this.rooms[this.roomIndex].roomId, code })
        }
        uni.showToast({ title: '已保存 / Saved', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.message || '保存失败 / Failed', icon: 'none' })
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }
.card { margin: 20rpx 24rpx; background: #ffffff; border-radius: 16rpx; padding: 24rpx; }
.sec { font-size: 30rpx; font-weight: 600; color: #1f2329; }
.sec-en { font-size: 22rpx; color: #8a919c; margin-top: 4rpx; margin-bottom: 16rpx; }
.picker-val { font-size: 28rpx; color: #0f6fff; padding: 16rpx 0; }
.img-grid { display: flex; flex-wrap: wrap; }
.img-wrap { position: relative; width: 30%; margin: 1.5%; }
.img { width: 100%; height: 160rpx; border-radius: 8rpx; }
.img-del {
  position: absolute; right: 0; top: 0; background: rgba(0,0,0,0.6); color: #fff;
  font-size: 20rpx; padding: 4rpx 10rpx; border-radius: 0 8rpx 0 8rpx;
}
.img-add {
  width: 30%; margin: 1.5%; height: 160rpx; border-radius: 8rpx; background: #f5f6f8;
  display: flex; align-items: center; justify-content: center; color: #8a919c; font-size: 26rpx;
}
.textarea { width: 100%; height: 240rpx; background: #f5f6f8; border-radius: 12rpx; padding: 16rpx; font-size: 28rpx; box-sizing: border-box; }
.code-input { width: 100%; background: #f5f6f8; border-radius: 16rpx; padding: 32rpx 24rpx; font-size: 56rpx; letter-spacing: 16rpx; min-height: 140rpx; box-sizing: border-box; text-align: center; }
.code-hint { font-size: 22rpx; color: #8a919c; margin-top: 10rpx; }
.code-ph { font-size: 26rpx; color: #c0c4cc; letter-spacing: 2rpx; }
.submit { margin: 24rpx; padding: 34rpx; background: #07c160; border-radius: 16rpx; display: flex; flex-direction: column; align-items: center; }
.submit.disabled { opacity: 0.6; }
.s-zh { color: #ffffff; font-size: 42rpx; font-weight: 600; }
.s-en { color: #eafff1; font-size: 28rpx; margin-top: 6rpx; }
</style>