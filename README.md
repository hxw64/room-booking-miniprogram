# 房间预约微信小程序（uni-app + 微信云开发）

一个管理房间与座位预约的微信小程序：用户登录后可按半小时粒度预约房间或自习室座位，其他用户实时查看占用状态，管理员可编辑房间资料、审核申请并查看预约人联系方式。所有固定界面文案中英双语，页面底部统一展示“联系我们”与邮箱。

## 技术栈
- 前端：uni-app（Vue3 + Vite）
- 后端：微信云开发（云数据库 / 云存储 / 云函数）
- 构建产物：`dist/build/mp-weixin`，导入微信开发者工具运行

## 房间与资源
- 普通房间：律动空间(802)、知心小筑(804)、音悦工坊(805)、创想天地(806)、乐活空间(808)
- 座位房间：公共自习室(803)
  - 单独座位：1 / 2 / 3（每次只能约 1 个）
  - 第一座区：4 / 5 / 6 / 7（区内可选 1~4 个）
  - 第二座区：8 / 9 / 10 / 11（区内可选 1~4 个，不能跨座区）

## 预约规则
- 半小时粒度，全天 24 小时可约，可约窗口为未来 7 天。
- 普通房间：单次 ≤3 小时直接预约（先到先得、可取消）；>3 小时转为申请（需填原因，最长 24 小时，待管理员审核，超 4 小时未处理自动通过）。
- 803 座位：无申请流程，直接预约，单次最长 10 小时，可取消。
- 同一用户禁止时间重叠预约（跨房间/座位）；公开页只显示占用状态，不显示预约人身份。

## 目录结构
```
src/                    前端源码
  config/index.js       房间/座位/邮箱等常量与云环境 ID
  utils/                时间、预约规则、云开发、登录态工具
  components/           ContactFooter(联系我们) 等全局组件
  pages/                首页/房间/座位/预约/我的/管理后台
cloudfunctions/         微信云函数
  login/                登录(openid + 是否管理员)
  booking/              创建预约/申请、取消、撤销、我的列表
  admin/                房间编辑、预约管理、申请审核
  autoApprove/          定时触发器：超 4h 申请自动通过
scripts/                构建后同步脚本、纯函数单元测试
```

## 本地构建
前置：本机已安装 Node.js。命令（本项目使用的 Node 位于 `C:\Users\z3380\Documents\ChatGPT\饮食计划\tools\node-v24.19.0-win-x64`）：

```powershell
$nodeBin='C:\Users\z3380\Documents\ChatGPT\饮食计划\tools\node-v24.19.0-win-x64'
$env:PATH="$nodeBin;$env:PATH"
& "$nodeBin\npm.cmd" install
& "$nodeBin\npm.cmd" run build:mp-weixin
```

`build:mp-weixin` 会：
1. 用 `uni build -p mp-weixin` 生成 `dist/build/mp-weixin`。
2. 运行 `scripts/sync-cloudfunctions.mjs`，把 `cloudfunctions/` 复制到小程序产物，并写入 `project.config.json` 的 `cloudfunctionRoot`。

纯函数单元测试：`& "$nodeBin\node.exe" scripts/test-pure.mjs`

## 导入微信开发者工具
1. 打开微信开发者工具（本机已安装于 `C:\Program Files (x86)\Tencent\微信web开发者工具`）。
2. 选择“导入项目”，目录选择 `dist/build/mp-weixin`，填写你的小程序 AppID（不要用测试号，云开发需要真实 AppID）。
3. 首次导入后，在工具中开通云开发，创建云环境，并记住环境 ID。

CLI 打开/预览/上传（可选）：
```powershell
$cli='C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat'
& $cli open --project "C:\Users\z3380\Documents\ChatGPT\权限小程序\dist\build\mp-weixin"
& $cli preview --project "C:\Users\z3380\Documents\ChatGPT\权限小程序\dist\build\mp-weixin"
```

## 云开发配置
1. 把云环境 ID 填入 `src/config/index.js` 的 `CLOUD_ENV`，重新执行 `npm run build:mp-weixin`。
2. 在云开发控制台创建集合：
   - `rooms`：房间资料（图片 fileID、介绍）
   - `bookings`：预约/申请记录
   - `slots`：半小时占用锁（并发防双占，云函数内部使用）
   - `admins`：管理员 openid 白名单
   - `users`：可选，预留的用户资料集合
3. 集合权限建议：
   - `rooms`、`bookings`：所有用户可读（前端需读取/实时监听占用）
   - `slots`、`admins`、`users`：保持默认（仅创建者可读写）即可，云函数拥有完全权限
4. 部署云函数：在微信开发者工具中，分别右键 `cloudfunctions` 下的 `login`、`booking`、`admin`、`autoApprove`，选择“上传并部署：云端安装依赖”。
5. 定时触发器：`autoApprove` 已带 `config.json`（每分钟触发），上传部署后会自动创建触发器；如未生效，在云开发控制台“云函数 → autoApprove → 触发器”中确认/手动创建。

## 管理员配置
1. 打开小程序完成一次登录。
2. 获取你的 openid：云开发控制台 → 云函数 → `login` → 日志，可看到 `login openid: xxx`。
3. 在 `admins` 集合新增记录：`{ "openid": "你的openid" }`。
4. 重新进入小程序，首页/“我的”页将出现“管理后台”入口。

## 首次数据初始化
- 6 个房间的名称与编号固定在前端常量中；`rooms` 集合无需预置即可运行（首页会回退到默认展示）。
- 管理员在“管理后台 → 编辑房间”上传图片并填写介绍后，主页即实时展示。

## 常用问题
- 无法登录/调用云函数：确认 AppID 为真实小程序 AppID、已开通云开发、`CLOUD_ENV` 已填写、云函数已部署。
- 实时状态不刷新：确认 `bookings` 集合权限为“所有用户可读”，且云函数创建预约成功写入 `bookings`。
- 并发双占：由 `slots` 集合的自定义 `_id` 唯一性保证，无需额外配置。