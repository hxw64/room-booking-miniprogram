// 构建后将云函数目录复制到微信小程序产物，并写入 project.config.json 的 cloudfunctionRoot
import { cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dist = join(root, 'dist', 'build', 'mp-weixin')
const cfSrc = join(root, 'cloudfunctions')
const cfDst = join(dist, 'cloudfunctions')

if (!existsSync(dist)) {
  console.error('[sync] dist/build/mp-weixin 不存在，请先运行 uni build -p mp-weixin')
  process.exit(1)
}

cpSync(cfSrc, cfDst, { recursive: true })
console.log('[sync] 云函数已复制到', cfDst)

const pjPath = join(dist, 'project.config.json')
let pj = {}
if (existsSync(pjPath)) {
  try { pj = JSON.parse(readFileSync(pjPath, 'utf8')) } catch (e) { pj = {} }
}
pj.cloudfunctionRoot = 'cloudfunctions/'
writeFileSync(pjPath, JSON.stringify(pj, null, 2), 'utf8')
console.log('[sync] project.config.json 已写入 cloudfunctionRoot')