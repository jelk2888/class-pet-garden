import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

import { initDb, db } from './db.js'
import { hashPassword } from './utils/password.js'
import { PETS_ROOT } from './services/petsStore.js'
import { seedGuestDemoData } from './services/guestDemoSeed.js'

// 导入路由
import authRoutes from './routes/auth.js'
import classRoutes from './routes/classes.js'
import studentRoutes from './routes/students.js'
import evaluationRoutes from './routes/evaluations.js'
import ruleRoutes from './routes/rules.js'
import backupRoutes from './routes/backup.js'
import settingsRoutes from './routes/settings.js'
import tagRoutes from './routes/tags.js'
import adminRoutes from './routes/admin.js'
import postsRoutes from './routes/posts.js'
import revivalRoutes from './routes/revival.js'
import shopRoutes from './routes/shop.js'
import groupsRoutes from './routes/groups.js'
import classTasksRoutes from './routes/classTasks.js'
import petsRoutes from './routes/pets.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'
/** 生产静态目录：优先环境变量，其次 ../dist（与 server 同级） */
const STATIC_DIR = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.resolve(__dirname, '../dist')

// Middleware
app.use(cors())
app.use(express.json({ limit: '25mb' }))
// 宠物图片静态目录（管理员上传写入 public/pets）
app.use('/pets', express.static(PETS_ROOT, { maxAge: '1h', fallthrough: true }))

// 桌面客户端 EXE 下载（Win7 / Win10）
const DOWNLOADS_DIR = path.resolve(__dirname, '../public/downloads')
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
app.use('/downloads', express.static(DOWNLOADS_DIR, {
  maxAge: '10m',
  setHeaders(res, filePath) {
    if (String(filePath).toLowerCase().endsWith('.exe')) {
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`)
    }
  },
}))
app.get('/api/downloads', (req, res) => {
  const manifestPath = path.join(DOWNLOADS_DIR, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    try {
      return res.json(JSON.parse(fs.readFileSync(manifestPath, 'utf8')))
    } catch (e) {
      console.warn('downloads manifest parse failed', e?.message)
    }
  }
  const items = []
  for (const name of fs.readdirSync(DOWNLOADS_DIR)) {
    if (!name.toLowerCase().endsWith('.exe')) continue
    const full = path.join(DOWNLOADS_DIR, name)
    const st = fs.statSync(full)
    items.push({
      id: name.includes('Win7') ? 'win7' : name.includes('Win10') ? 'win10' : name,
      name,
      file: name,
      url: '/downloads/' + encodeURIComponent(name),
      size: st.size,
    })
  }
  res.json({ updatedAt: Date.now(), items })
})

// 初始化数据库
initDb()

// 创建默认游客用户
const guestUser = db.prepare('SELECT id FROM users WHERE username = ?').get('guest')
if (!guestUser) {
  const guestId = uuidv4()
  db.prepare('INSERT INTO users (id, username, password_hash, is_guest, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(guestId, 'guest', '', 1, Date.now())
  console.log('✅ 创建默认游客用户')
}

// 创建管理员账号
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')
if (!adminUser) {
  const adminId = uuidv4()
  const adminPasswordHash = hashPassword('Claw2026!')
  db.prepare('INSERT INTO users (id, username, password_hash, is_guest, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(adminId, 'admin', adminPasswordHash, 0, 1, Date.now())
  console.log('✅ 创建管理员账号: admin')
}

// 迁移现有班级到游客用户
const classesWithoutUser = db.prepare('SELECT id FROM classes WHERE user_id IS NULL').all()
if (classesWithoutUser.length > 0) {
  const guest = db.prepare('SELECT id FROM users WHERE username = ?').get('guest')
  if (guest) {
    db.prepare('UPDATE classes SET user_id = ? WHERE user_id IS NULL').run(guest.id)
    console.log(`✅ 迁移 ${classesWithoutUser.length} 个班级到游客用户`)
  }
}

// 游客演示班：40 人随机宠物/等级
seedGuestDemoData()

// 初始化默认评价规则
const rulesCount = db.prepare('SELECT COUNT(*) as count FROM evaluation_rules').get()
if (rulesCount && rulesCount.count === 0) {
  initDefaultRules()
}

// 初始化等级配置
const levelConfig = db.prepare("SELECT value FROM settings WHERE key = 'levelConfig'").get()
if (!levelConfig) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('levelConfig', ?)")
    .run(JSON.stringify([40, 60, 80, 100, 120, 140, 160]))
}

// 注册路由
app.use('/api/auth', authRoutes)
app.use('/api/classes', classRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/evaluations', evaluationRoutes)
app.use('/api/rules', ruleRoutes)
app.use('/api/backup', backupRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/pets', petsRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/revival', revivalRoutes)
app.use('/api/shop', shopRoutes)
app.use('/api/groups', groupsRoutes)
app.use('/api/tasks', classTasksRoutes)

// 健康检查（公开）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// 生产环境：托管前端构建产物（群晖 / 单进程部署）
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { maxAge: '1h', index: false }))
  // Vue Router history 模式：非 API / pets 回落到 index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/pets') || req.path.startsWith('/downloads')) return next()
    const indexHtml = path.join(STATIC_DIR, 'index.html')
    if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml)
    next()
  })
  console.log(`📦 静态前端: ${STATIC_DIR}`)
} else {
  console.log(`⚠️ 未找到前端目录 ${STATIC_DIR}，仅提供 API（开发模式可另开 Vite）`)
}

// 统一错误兜底，避免未捕获异常变成无信息 500
app.use((err, req, res, next) => {
  console.error('API Error:', req.method, req.path, err)
  if (res.headersSent) return next(err)
  res.status(500).json({ error: err?.message || '服务器内部错误' })
})

// 初始化默认评价规则
function initDefaultRules() {
  const defaultRules = [
    // 学习类 - 加分
    { name: '作业完成优秀', points: 1, category: '学习' },
    { name: '平时测验满分', points: 3, category: '学习' },
    { name: '平时测验达优秀', points: 2, category: '学习' },
    { name: '默写全对', points: 1, category: '学习' },
    { name: '订正态度认真', points: 1, category: '学习' },
    { name: '优秀作业,值得表扬', points: 1, category: '学习' },
    { name: '近期学习状态进步', points: 1, category: '学习' },
    { name: '被老师点名表扬', points: 1, category: '学习' },
    { name: '单元测验显著进步', points: 2, category: '学习' },
    // 学习类 - 扣分
    { name: '不交作业', points: -1, category: '学习' },
    { name: '未完成作业', points: -2, category: '学习' },
    { name: '作业潦草', points: -1, category: '学习' },
    { name: '订正不认真', points: -2, category: '学习' },
    { name: '抄袭作业', points: -5, category: '学习' },
    { name: '考试作弊', points: -5, category: '学习' },
    { name: '学习显著退步', points: -2, category: '学习' },
    // 行为类 - 加分
    { name: '早读认真专注', points: 1, category: '行为' },
    { name: '课前准备充分', points: 1, category: '行为' },
    { name: '眼保健操全程认真', points: 1, category: '行为' },
    { name: '升旗仪式安静整齐', points: 1, category: '行为' },
    { name: '守纪表现优秀(被表扬)', points: 2, category: '行为' },
    { name: '主动帮助同学', points: 2, category: '行为' },
    { name: '拾金不昧(一般物品)', points: 2, category: '行为' },
    { name: '拾金不昧(贵重物品)', points: 5, category: '行为' },
    { name: '主动帮助生病同学', points: 3, category: '行为' },
    { name: '主动调解同学矛盾、化解冲突', points: 3, category: '行为' },
    { name: '做好人好事被学校提出表扬', points: 3, category: '行为' },
    { name: '积极参与校内外志愿服务', points: 3, category: '行为' },
    { name: '犯错主动认错,积极协商', points: 1, category: '行为' },
    // 行为类 - 扣分
    { name: '无故迟到或早退', points: -1, category: '行为' },
    { name: '未佩戴红领巾,不穿校服', points: -1, category: '行为' },
    { name: '私自旷课或课间操', points: -3, category: '行为' },
    { name: '上课讲话、开小差', points: -1, category: '行为' },
    { name: '扰乱课堂', points: -3, category: '行为' },
    { name: '课间追逐打闹', points: -3, category: '行为' },
    { name: '追逐打闹(酿成事故)', points: -3, category: '行为' },
    { name: '中午自习说话、随意走动', points: -1, category: '行为' },
    { name: '私自带玩具或零食或危险物品', points: -3, category: '行为' },
    { name: '排队时说话或小动作不停,被点名', points: -1, category: '行为' },
    { name: '传播脏话或不良歌谣', points: -5, category: '行为' },
    { name: '撒谎、隐瞒真实情况', points: -2, category: '行为' },
    { name: '说脏话,骂人,起绰号', points: -2, category: '行为' },
    { name: '欺负、推搡、伤害同学', points: -10, category: '行为' },
    { name: '挑拨离间、拉帮结派', points: -3, category: '行为' },
    { name: '不尊重同学、孤立他人', points: -3, category: '行为' },
    { name: '为私欲包庇犯错者', points: -3, category: '行为' },
    { name: '恶意举报、诬陷他人', points: -3, category: '行为' },
    { name: '破坏校园设施', points: -5, category: '行为' },
    // 健康类 - 加分
    { name: '认真完成包干区值日', points: 1, category: '健康' },
    { name: '主动为班级擦黑板', points: 1, category: '健康' },
    { name: '主动整理讲台', points: 1, category: '健康' },
    { name: '主动整理黑板粉笔槽', points: 1, category: '健康' },
    { name: '主动倒垃圾并套垃圾袋', points: 2, category: '健康' },
    { name: '座位整洁无涂画,桌椅干净', points: 1, category: '健康' },
    { name: '座位周围无垃圾', points: 1, category: '健康' },
    // 健康类 - 扣分
    { name: '打扫包干区时间玩耍,不认真', points: -2, category: '健康' },
    { name: '个人座位卫生不合格', points: -1, category: '健康' },
    { name: '校园内乱扔垃圾', points: -1, category: '健康' },
    { name: '桌洞脏乱、物品杂乱', points: -1, category: '健康' },
    { name: '破坏卫生、乱涂乱画', points: -2, category: '健康' },
    { name: '浪费粮食', points: -2, category: '健康' },
    { name: '破坏班级绿植、把玩绿植', points: -3, category: '健康' },
    // 其他类 - 加分
    { name: '主动整理图书、摆放整齐', points: 2, category: '其他' },
    { name: '主动帮同学更换桌椅', points: 2, category: '其他' },
    { name: '主动承担班级任务', points: 2, category: '其他' },
    { name: '积极参加班级墙面布置', points: 2, category: '其他' },
    { name: '积极参加班级或学校活动', points: 1, category: '其他' },
    { name: '活动中表现优秀', points: 2, category: '其他' },
    { name: '代表班级参赛', points: 3, category: '其他' },
    { name: '校级比赛:一等奖', points: 5, category: '其他' },
    { name: '校级比赛:二等奖', points: 4, category: '其他' },
    { name: '校级比赛:三等奖', points: 3, category: '其他' },
    { name: '区级及以上:一等奖', points: 8, category: '其他' },
    { name: '区级及以上:二等奖', points: 6, category: '其他' },
    { name: '区级及以上:三等奖', points: 4, category: '其他' },
    { name: '联欢会或文艺汇演积极参与', points: 2, category: '其他' },
    { name: '为班级争得荣誉', points: 5, category: '其他' },
    { name: '小组全周无违纪、全员交作业', points: 2, category: '其他' },
    // 其他类 - 扣分
    { name: '损坏公物、乱刻乱画', points: -1, category: '其他' },
    { name: '浪费水电、屡教不改', points: -1, category: '其他' },
    { name: '故意玩弄损坏公共电器', points: -3, category: '其他' },
    { name: '故意损坏卫生工具', points: -2, category: '其他' },
    { name: '扣分严重/打架/作弊/严重违纪', points: -8, category: '其他' },
  ]

  const insertRule = db.prepare('INSERT INTO evaluation_rules (id, name, points, category, is_custom, created_at) VALUES (?, ?, ?, ?, 0, ?)')
  const now = Date.now()
  for (const rule of defaultRules) {
    insertRule.run(uuidv4(), rule.name, rule.points, rule.category, now)
  }
  console.log(`✅ 初始化 ${defaultRules.length} 条默认评价规则`)
}

// 错误处理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// 启动服务器
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`)
  console.log(`📅 ${new Date().toLocaleString()}`)
})

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    db.close()
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    db.close()
    process.exit(0)
  })
})