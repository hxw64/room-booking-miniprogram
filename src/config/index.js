// 全局配置：部署时需在微信云开发控制台创建环境，并把环境 ID 填入 CLOUD_ENV
export const CLOUD_ENV = 'hxwyun-d5gg0ah1t5a936df6'

// 页面底部联系方式
export const CONTACT_EMAIL = 'SZIGradeCommittee@163.com'

// 固定房间（房间号与名称不可改，管理员仅编辑图片与介绍）
export const ROOMS = [
  { roomId: '801', name: '静心驿站', nameEn: 'Mindful Station', roomType: 'room', openAccess: true, sort: 1 },
  { roomId: '802', name: '律动空间', nameEn: 'Flow Studio', roomType: 'room', openAccess: false, sort: 2 },
  { roomId: '803', name: '公共自习室', nameEn: 'Study Lounge', roomType: 'seat', openAccess: false, sort: 3 },
  { roomId: '804', name: '知心小筑', nameEn: 'Empower Space', roomType: 'room', openAccess: false, sort: 4 },
  { roomId: '805', name: '音悦工坊', nameEn: 'Music Lab', roomType: 'room', openAccess: false, sort: 5 },
  { roomId: '806', name: '创想天地', nameEn: 'Creative Hub', roomType: 'room', openAccess: false, sort: 6 },
  { roomId: '807', name: '愈见空间', nameEn: 'Wellness Workshop', roomType: 'room', openAccess: false, sort: 7 },
  { roomId: '808', name: '乐活空间', nameEn: 'Joy Hub', roomType: 'room', openAccess: true, sort: 8 }
]

// 803 座位分区（代码常量）
export const SEAT_ZONES = [
  { id: 'single', name: '单独座位', nameEn: 'Single Seats', seats: [1, 2, 3], mode: 'single', maxSelect: 1 },
  { id: 'zone1', name: '第一座区', nameEn: 'Zone 1', seats: [4, 5, 6, 7], mode: 'group', maxSelect: 4 },
  { id: 'zone2', name: '第二座区', nameEn: 'Zone 2', seats: [8, 9, 10, 11], mode: 'group', maxSelect: 4 }
]

// 预约参数
export const SLOT_MINUTES = 30
export const BOOKING_WINDOW_DAYS = 7
export const NORMAL_MAX_HOURS = 3
export const APPLY_MAX_HOURS = 24
export const SEAT_MAX_HOURS = 10
export const AUTO_APPROVE_HOURS = 4

// 通过 roomId 查找房间
export function roomById(roomId) {
  return ROOMS.find(r => r.roomId === roomId) || null
}

// 通过座位号查找所属分区
export function zoneBySeat(seatNo) {
  return SEAT_ZONES.find(z => z.seats.indexOf(seatNo) >= 0) || null
}