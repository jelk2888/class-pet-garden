/**
 * SQLite via sql.js（纯 WASM）— 与远程课程管理 / classroom-pro 相同方案。
 * 避免群晖 Web Station 上 better-sqlite3 的 NODE_MODULE_VERSION / GLIBC / dlopen 失败。
 * API 对齐 better-sqlite3：prepare/get/all/run/exec/transaction/pragma。
 */
import initSqlJs from 'sql.js'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'
import fs from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDocker = fs.existsSync('/.dockerenv')

/**
 * 数据库路径（群晖友好）：
 * 1) TEST_DB=1 → 内存库
 * 2) DB_PATH=绝对/相对路径 → 指定文件
 * 3) DATA_DIR=目录 → {DATA_DIR}/dongguo-pet.db
 * 4) Docker → /db/dongguo-pet.db
 * 5) 默认 → server/data/dongguo-pet.db
 */
function resolveDbPath() {
  if (process.env.TEST_DB) return ':memory:'
  if (process.env.DB_PATH) return resolve(process.env.DB_PATH)
  if (process.env.DATA_DIR) {
    const dir = resolve(process.env.DATA_DIR)
    fs.mkdirSync(dir, { recursive: true })
    return join(dir, 'dongguo-pet.db')
  }
  if (isDocker) {
    fs.mkdirSync('/db', { recursive: true })
    return '/db/dongguo-pet.db'
  }
  const dataDir = join(__dirname, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  const legacy = join(__dirname, 'dongguo-pet.db')
  if (fs.existsSync(legacy)) return legacy
  return join(dataDir, 'dongguo-pet.db')
}

function toBindArgs(params) {
  if (!params || params.length === 0) return undefined
  if (
    params.length === 1 &&
    params[0] != null &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
  ) {
    const bind = {}
    for (const [k, v] of Object.entries(params[0])) {
      const name = String(k).replace(/^[@:$]/, '')
      bind['@' + name] = v
      bind[':' + name] = v
      bind['$' + name] = v
    }
    return bind
  }
  if (params.length === 1 && Array.isArray(params[0])) return params[0]
  return params
}

class Statement {
  constructor(owner, sql) {
    this.owner = owner
    this.sql = sql
  }

  get(...params) {
    const stmt = this.owner._raw.prepare(this.sql)
    try {
      const bind = toBindArgs(params)
      if (bind) stmt.bind(bind)
      if (stmt.step()) return stmt.getAsObject()
      return undefined
    } finally {
      stmt.free()
    }
  }

  all(...params) {
    const stmt = this.owner._raw.prepare(this.sql)
    const rows = []
    try {
      const bind = toBindArgs(params)
      if (bind) stmt.bind(bind)
      while (stmt.step()) rows.push(stmt.getAsObject())
      return rows
    } finally {
      stmt.free()
    }
  }

  run(...params) {
    const bind = toBindArgs(params)
    this.owner._raw.run(this.sql, bind)
    const changes = this.owner._raw.getRowsModified()
    let lastInsertRowid = 0
    try {
      const r = this.owner._raw.exec('SELECT last_insert_rowid() AS id')
      if (r[0]?.values?.[0]?.[0] != null) lastInsertRowid = Number(r[0].values[0][0])
    } catch {
      /* ignore */
    }
    if (!this.owner._inTx) this.owner._persist()
    return { changes, lastInsertRowid }
  }
}

class SqlJsDatabase {
  constructor(raw, filePath) {
    this._raw = raw
    this._path = filePath
    this._inTx = false
  }

  prepare(sql) {
    return new Statement(this, sql)
  }

  exec(sql) {
    this._raw.exec(sql)
    if (!this._inTx) this._persist()
  }

  pragma(source) {
    try {
      this._raw.run('PRAGMA ' + source)
    } catch {
      /* sql.js 部分 pragma 可忽略 */
    }
  }

  transaction(fn) {
    return (...args) => {
      this._raw.run('BEGIN')
      this._inTx = true
      try {
        const result = fn(...args)
        this._raw.run('COMMIT')
        this._inTx = false
        this._persist()
        return result
      } catch (e) {
        try {
          this._raw.run('ROLLBACK')
        } catch {
          /* ignore */
        }
        this._inTx = false
        throw e
      }
    }
  }

  close() {
    try {
      this._persist()
    } catch {
      /* ignore */
    }
    try {
      this._raw.close()
    } catch {
      /* ignore */
    }
  }

  _persist() {
    if (!this._path || this._path === ':memory:') return
    const data = this._raw.export()
    fs.writeFileSync(this._path, Buffer.from(data))
  }
}

export const dbPath = resolveDbPath()

const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
const wasmBinary = fs.readFileSync(wasmPath)
const SQL = await initSqlJs({ wasmBinary })

let raw
if (dbPath === ':memory:') {
  raw = new SQL.Database()
} else if (fs.existsSync(dbPath)) {
  try {
    raw = new SQL.Database(fs.readFileSync(dbPath))
  } catch (e) {
    const bak = dbPath + '.bak-' + Date.now()
    try {
      fs.copyFileSync(dbPath, bak)
      console.warn('[db] 旧库无法直接打开（可能含 WAL），已备份为', bak)
    } catch {
      /* ignore */
    }
    raw = new SQL.Database()
  }
} else {
  raw = new SQL.Database()
}

export const db = new SqlJsDatabase(raw, dbPath)
db.pragma('foreign_keys = ON')
if (dbPath !== ':memory:') {
  console.log('💾 SQLite(sql.js): ' + dbPath)
} else {
  console.log('💾 SQLite(sql.js): :memory:')
}
console.log('[db] driver: sql.js（群晖 Web Station 兼容，无需 better-sqlite3）')


// 初始化数据库表
export function initDb() {
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_guest INTEGER DEFAULT 0,
      created_at INTEGER
    );

    -- 班级表
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    -- 学生表
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      student_no TEXT,
      total_points INTEGER DEFAULT 0,
      pet_type TEXT,
      pet_level INTEGER DEFAULT 1,
      pet_exp INTEGER DEFAULT 0,
      pet_status TEXT DEFAULT 'alive',
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    -- 徽章表
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      pet_type TEXT NOT NULL,
      earned_at INTEGER,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- 评价规则表
    CREATE TABLE IF NOT EXISTS evaluation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      points INTEGER NOT NULL,
      category TEXT NOT NULL,
      is_custom INTEGER DEFAULT 0,
      created_at INTEGER
    );

    -- 评价记录表
    CREATE TABLE IF NOT EXISTS evaluation_records (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      category TEXT NOT NULL,
      timestamp INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- 学生标签表（用户隔离）
    CREATE TABLE IF NOT EXISTS student_tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 学生-标签关联表
    CREATE TABLE IF NOT EXISTS student_tag_relations (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (tag_id) REFERENCES student_tags(id)
    );

    -- 留言板帖子表
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 帖子评论表
    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 帖子投票表（点赞/点踩）
    CREATE TABLE IF NOT EXISTS post_votes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      vote_type INTEGER NOT NULL,  -- 1=赞, -1=踩
      created_at INTEGER,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(post_id, user_id)  -- 每个用户对每个帖子只能投一次
    );

    -- 复活任务表（用户隔离）
    CREATE TABLE IF NOT EXISTS revival_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_preset INTEGER DEFAULT 0,  -- 是否为系统预置任务
      is_enabled INTEGER DEFAULT 1,  -- 是否启用（用户可禁用预置任务）
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 学生复活任务分配表
    CREATE TABLE IF NOT EXISTS student_revival_tasks (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',  -- pending | completed
      assigned_at INTEGER,
      completed_at INTEGER,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (task_id) REFERENCES revival_tasks(id)
    );

    -- 复活记录表
    CREATE TABLE IF NOT EXISTS revival_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      revived_at INTEGER,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- 系统设置表（等级阈值等）
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 积分商城商品（班级内兑换，非外部商用）
    CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      cost INTEGER NOT NULL,
      stock INTEGER DEFAULT -1,
      emoji TEXT DEFAULT '🎁',
      enabled INTEGER DEFAULT 1,
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    -- 兑换记录
    CREATE TABLE IF NOT EXISTS shop_redemptions (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      cost INTEGER NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (item_id) REFERENCES shop_items(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- 小组（一组一宠：小组专属能量与个人积分分离）
    CREATE TABLE IF NOT EXISTS student_groups (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#f97316',
      pet_type TEXT,
      pet_level INTEGER DEFAULT 1,
      group_energy INTEGER DEFAULT 0,
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    -- 小组成员
    CREATE TABLE IF NOT EXISTS student_group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      created_at INTEGER,
      UNIQUE(group_id, student_id),
      FOREIGN KEY (group_id) REFERENCES student_groups(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- 小组集体能量记录（不与个人积分混算）
    CREATE TABLE IF NOT EXISTS group_energy_records (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      rule_key TEXT,
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (group_id) REFERENCES student_groups(id)
    );

    -- 班级任务（激励任务，非复活）
    CREATE TABLE IF NOT EXISTS class_tasks (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      points INTEGER DEFAULT 1,
      repeatable INTEGER DEFAULT 1,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    -- 任务完成记录
    CREATE TABLE IF NOT EXISTS class_task_completions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (task_id) REFERENCES class_tasks(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
  `)

  // 迁移：添加 pet_status 字段（如果不存在）
  try {
    db.exec(`ALTER TABLE students ADD COLUMN pet_status TEXT DEFAULT 'alive'`)
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 迁移：添加 user_id 到 evaluation_rules（如果不存在）
  try {
    db.exec(`ALTER TABLE evaluation_rules ADD COLUMN user_id TEXT`)
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 迁移：添加 user_id 到 evaluation_records（如果不存在）
  try {
    db.exec(`ALTER TABLE evaluation_records ADD COLUMN user_id TEXT`)
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 迁移：添加 is_admin 到 users（如果不存在）
  try {
    db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`)
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 迁移：添加 revival_enabled 到 users（如果不存在）
  try {
    db.exec(`ALTER TABLE users ADD COLUMN revival_enabled INTEGER DEFAULT 0`)
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 迁移：一组一宠字段
  for (const sql of [
    `ALTER TABLE student_groups ADD COLUMN pet_type TEXT`,
    `ALTER TABLE student_groups ADD COLUMN pet_level INTEGER DEFAULT 1`,
    `ALTER TABLE student_groups ADD COLUMN group_energy INTEGER DEFAULT 0`,
    `ALTER TABLE classes ADD COLUMN group_pet_enabled INTEGER DEFAULT 1`,
  ]) {
    try { db.exec(sql) } catch (e) { /* already exists */ }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS group_energy_records (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      rule_key TEXT,
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (group_id) REFERENCES student_groups(id)
    );
  `)

  // 多教师入班：邀请码 + 任教教师表
  try {
    db.exec(`ALTER TABLE classes ADD COLUMN invite_code TEXT`)
  } catch (e) {
    // already exists
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS class_teachers (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'teacher',
      joined_at INTEGER,
      UNIQUE(class_id, user_id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_class_teachers_user ON class_teachers(user_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_class_teachers_class ON class_teachers(class_id)`)
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_invite_code ON classes(invite_code)`)
  } catch (e) {
    // ignore if duplicates somehow exist
  }

  // 班级座位表（教师工具箱）
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_seat_charts (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      rows INTEGER NOT NULL,
      pattern TEXT NOT NULL,
      podium TEXT DEFAULT 'top',
      seats TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_seat_charts_class ON class_seat_charts(class_id)`)

  // 班级界面主题
  try {
    db.exec(`ALTER TABLE classes ADD COLUMN ui_theme TEXT DEFAULT 'forest'`)
  } catch (e) {
    // already exists
  }

  // 班级等级经验配置（JSON 数组 8 段）
  try {
    db.exec(`ALTER TABLE classes ADD COLUMN level_config TEXT`)
  } catch (e) {
    // already exists
  }

  // 教师颁发微章：类型定义
  db.exec(`
    CREATE TABLE IF NOT EXISTS micro_badge_types (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '🏅',
      color TEXT DEFAULT '#f59e0b',
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_micro_badge_types_class ON micro_badge_types(class_id)`)

  // 教师颁发微章：发放记录
  db.exec(`
    CREATE TABLE IF NOT EXISTS micro_badge_awards (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      type_id TEXT NOT NULL,
      note TEXT,
      awarded_by TEXT,
      earned_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (type_id) REFERENCES micro_badge_types(id)
    );
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_micro_badge_awards_class ON micro_badge_awards(class_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_micro_badge_awards_student ON micro_badge_awards(student_id)`)

  // 为已有班级补邀请码；把班主任写入 class_teachers（role=owner）
  function genInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    const bytes = randomBytes(6)
    for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length]
    return code
  }

  const classesWithoutCode = db.prepare(
    `SELECT id, user_id FROM classes WHERE invite_code IS NULL OR invite_code = ''`
  ).all()
  const setCode = db.prepare('UPDATE classes SET invite_code = ? WHERE id = ?')
  for (const c of classesWithoutCode) {
    let code
    let tries = 0
    do {
      code = genInviteCode()
      tries++
    } while (db.prepare('SELECT 1 FROM classes WHERE invite_code = ?').get(code) && tries < 20)
    setCode.run(code, c.id)
  }

  const ensureOwner = db.prepare(`
    INSERT OR IGNORE INTO class_teachers (id, class_id, user_id, role, joined_at)
    VALUES (?, ?, ?, 'owner', ?)
  `)
  const allClasses = db.prepare('SELECT id, user_id FROM classes WHERE user_id IS NOT NULL').all()
  const now = Date.now()
  for (const c of allClasses) {
    ensureOwner.run(`${c.id}_owner_${c.user_id}`, c.id, c.user_id, now)
  }
}
