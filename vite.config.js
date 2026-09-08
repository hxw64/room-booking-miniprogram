import { defineConfig } from 'vite'
import uniModule from '@dcloudio/vite-plugin-uni'

// 兼容 CJS 转译产物的 default 导出（Node 对 __esModule 的 interop 差异）
const uni = uniModule.default || uniModule

export default defineConfig({
  plugins: [uni()]
})