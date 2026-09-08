<template>
  <view class="lang-text">
    <text class="lt-zh">{{ zh }}</text>
    <text class="lt-en">{{ en }}</text>
  </view>
</template>

<script>
export default {
  name: 'LangText',
  props: {
    zh: { type: String, default: '' },
    en: { type: String, default: '' }
  }
}
</script>

<style scoped>
.lang-text {
  display: flex;
  flex-direction: column;
}
.lt-zh {
  font-size: 28rpx;
  color: #1f2329;
  line-height: 1.5;
}
.lt-en {
  font-size: 24rpx;
  color: #8a919c;
  line-height: 1.5;
}
</style>