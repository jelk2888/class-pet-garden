/**
 * 游客演示班：40 人、随机宠物、随机等级（0–8）
 */
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { randomLevelAndExp } from '../utils/level.js'
import { listPetsCatalog } from './petsStore.js'
import { listCatalog, seedCatalog } from './shopCatalogStore.js'

export const GUEST_DEMO_TARGET = 40

const GUEST_DEMO_NAMES = [
  '张小明', '李小红', '王小强', '赵小美', '刘小杰',
  '陈小雨', '杨小飞', '黄小琳', '周小宇', '吴小倩',
  '徐小涛', '孙小雯', '马小龙', '朱小芳', '胡小军',
  '郭小婷', '何小亮', '高小燕', '林小峰', '罗小月',
  '梁小凯', '宋小慧', '郑小宁', '谢小璐', '韩小博',
  '唐小雅', '冯小杰', '于小涵', '董小宇', '萧小萱',
  '程小安', '曹小悦', '袁小航', '邓小柔', '许小桐',
  '傅小磊', '沈小晴', '曾小轩', '彭小诺', '吕小辰',
]

const FALLBACK_PETS = [
  'corgi', 'shiba', 'golden-retriever', 'husky', 'samoyed',
  'tabby-cat', 'orange-cat', 'ragdoll-cat', 'hamster', 'call-duck',
  'alpaca', 'red-panda', 'lop-rabbit', 'bichon', 'border-collie',
  'west-highland', 'persian-cat', 'angora-rabbit', 'winter-hamster', 'unicorn',
  'pixiu', 'suanni', 'white-tiger', 'azure-dragon', 'vermilion-bird',
]

function pickDemoPetIds() {
  try {
    const ids = listPetsCatalog().map((p) => p.id).filter(Boolean)
    if (ids.length >= 10) return ids
  } catch { /* ignore */ }
  return FALLBACK_PETS
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function seedGuestShop(classId, now = Date.now()) {
  try {
    seedCatalog('merge')
  } catch { /* ignore */ }
  const catalog = listCatalog({ includeDisabled: false })
  const existing = new Set(
    db.prepare('SELECT name FROM shop_items WHERE class_id = ?').all(classId).map((r) => r.name)
  )
  const ins = db.prepare(`INSERT INTO shop_items (id, class_id, name, description, cost, stock, emoji, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`)
  let added = 0
  for (const it of catalog) {
    if (existing.has(it.name)) continue
    ins.run(uuidv4(), classId, it.name, it.description || '', it.cost, it.stock ?? -1, it.emoji || '🎁', now)
    existing.add(it.name)
    added++
  }
  if (!existing.size) {
    for (const it of [
      { name: '免一次值日', cost: 15, emoji: '🧹' },
      { name: '自选座位一天', cost: 25, emoji: '💺' },
      { name: '小零食', cost: 10, emoji: '🍪' },
    ]) {
      ins.run(uuidv4(), classId, it.name, '', it.cost, -1, it.emoji, now)
      added++
    }
  }
  if (added) console.log(`✅ 游客演示班商城补充 ${added} 件商品（三站目录）`)
}

/**
 * @param {{ forceReassign?: boolean }} [opts]
 */
export function seedGuestDemoData(opts = {}) {
  const guest = db.prepare('SELECT id FROM users WHERE username = ?').get('guest')
  if (!guest) return

  const SEED_VER = '40-random-v1'
  let forceReassign = !!opts.forceReassign
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'guest_demo_seed_ver'").get()
    if (!row || row.value !== SEED_VER) forceReassign = true
  } catch {
    forceReassign = true
  }

  let cls = db.prepare('SELECT * FROM classes WHERE user_id = ? ORDER BY created_at ASC LIMIT 1').get(guest.id)
  const now = Date.now()
  if (!cls) {
    const id = uuidv4()
    const invite = `GUEST${String(Math.floor(Math.random() * 900) + 100)}`
    db.prepare(
      'INSERT INTO classes (id, user_id, name, created_at, updated_at, invite_code) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, guest.id, '游客演示班', now, now, invite)
    try {
      db.prepare(`
        INSERT OR IGNORE INTO class_teachers (id, class_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'owner', ?)
      `).run(`${id}_owner`, id, guest.id, now)
    } catch { /* table may not exist yet on very old runs */ }
    cls = { id, user_id: guest.id, name: '游客演示班', invite_code: invite }
    console.log('✅ 创建游客演示班')
  } else {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO class_teachers (id, class_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'owner', ?)
      `).run(`${cls.id}_owner_${guest.id}`, cls.id, guest.id, now)
    } catch { /* ignore */ }
  }

  const petPool = pickDemoPetIds()
  const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY created_at ASC').all(cls.id)
  const needRebuild = forceReassign || students.length !== GUEST_DEMO_TARGET

  if (needRebuild) {
    const ids = students.map((s) => s.id)
    const relatedTables = [
      'evaluation_records',
      'badges',
      'student_tag_relations',
      'student_group_members',
      'shop_redemptions',
      'class_task_completions',
      'student_revival_tasks',
      'revival_records',
    ]
    const tx = db.transaction(() => {
      if (ids.length) {
        const ph = ids.map(() => '?').join(',')
        for (const table of relatedTables) {
          try {
            db.prepare(`DELETE FROM ${table} WHERE student_id IN (${ph})`).run(...ids)
          } catch { /* table may not exist */ }
        }
      }
      db.prepare('DELETE FROM students WHERE class_id = ?').run(cls.id)

      const insert = db.prepare(`
        INSERT INTO students (id, class_id, name, student_no, total_points, pet_type, pet_level, pet_exp, pet_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'alive', ?)
      `)
      const petIds = shuffle(petPool)
      for (let i = 0; i < GUEST_DEMO_TARGET; i++) {
        const { level, exp } = randomLevelAndExp()
        const petType = petIds[i % petIds.length]
        insert.run(
          uuidv4(),
          cls.id,
          GUEST_DEMO_NAMES[i] || `同学${i + 1}`,
          String(i + 1).padStart(2, '0'),
          exp,
          petType,
          level,
          exp,
          now + i
        )
      }
      try {
        db.prepare("DELETE FROM settings WHERE key = 'guest_demo_seed_ver'").run()
        db.prepare("INSERT INTO settings (key, value) VALUES ('guest_demo_seed_ver', ?)").run(SEED_VER)
      } catch { /* ignore */ }
    })
    tx()
    console.log(`✅ 游客演示班已重建 ${GUEST_DEMO_TARGET} 人（随机宠物 + 随机等级 0–8，图鉴 ${petPool.length} 种）`)
  }

  // 积分商城：导入吾师/班宠/班级优目录（补缺）
  seedGuestShop(cls.id, now)

  const taskCount = db.prepare('SELECT count(*) as c FROM class_tasks WHERE class_id = ?').get(cls.id).c
  if (!taskCount) {
    const tasks = [
      { name: '课前准备到位', points: 1 },
      { name: '帮助同学完成任务', points: 2 },
    ]
    const ins = db.prepare(`INSERT INTO class_tasks (id, class_id, name, description, points, repeatable, enabled, created_at)
      VALUES (?, ?, ?, '', ?, 1, 1, ?)`)
    for (const t of tasks) ins.run(uuidv4(), cls.id, t.name, t.points, now)
  }

  const ruleCount = db.prepare('SELECT count(*) as c FROM evaluation_rules WHERE user_id = ?').get(guest.id).c
  if (!ruleCount) {
    const mini = [
      { name: '课堂积极发言', points: 2, category: '学习' },
      { name: '作业完成优秀', points: 1, category: '学习' },
      { name: '主动帮助同学', points: 2, category: '行为' },
      { name: '上课讲话、开小差', points: -1, category: '行为' },
    ]
    const ins = db.prepare(`INSERT INTO evaluation_rules (id, name, points, category, is_custom, user_id, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)`)
    for (const r of mini) ins.run(uuidv4(), r.name, r.points, r.category, guest.id, now)
  }
}
