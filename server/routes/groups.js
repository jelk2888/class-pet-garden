import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { verifyClassOwnership, verifyStudentOwnership } from '../middleware/ownership.js'
import { calculateLevel } from '../utils/level.js'

const router = Router()

/** 文章推荐的 4 条最小集体规则（个人分不进小组能量） */
export const DEFAULT_GROUP_RULES = [
  { key: 'quick_start', name: '全组快速进入任务', points: 1, hint: '铃响到位、讨论归位、整组开动' },
  { key: 'team_task', name: '全组完成一次关键任务', points: 2, hint: '实验/展示/卫生/合作任务按时完成' },
  { key: 'help_peer', name: '主动把没跟上的组员带上', points: 1, hint: '愿意解释、一起收尾' },
  { key: 'streak', name: '连续进步 / 达成阶段目标', points: 3, hint: '最慢组连续提前完成、秩序明显改善' },
]

function enrichGroup(g) {
  const members = db.prepare(`
    SELECT s.* FROM students s
    JOIN student_group_members m ON m.student_id = s.id
    WHERE m.group_id = ?
    ORDER BY s.name
  `).all(g.id)
  const personalPoints = members.reduce((a, s) => a + (s.total_points || 0), 0)
  const energy = g.group_energy || 0
  const petLevel = calculateLevel(energy)
  if (petLevel !== (g.pet_level || 1)) {
    db.prepare('UPDATE student_groups SET pet_level = ? WHERE id = ?').run(petLevel, g.id)
  }
  return {
    ...g,
    pet_level: petLevel,
    members,
    memberCount: members.length,
    groupEnergy: energy,
    personalPoints,
    totalPoints: energy,
  }
}

// ---- /group/* 必须写在 /:classId 之前，避免 classId="group" 误匹配 ----

router.patch('/group/:id', authMiddleware, (req, res) => {
  const g = db.prepare('SELECT * FROM student_groups WHERE id = ?').get(req.params.id)
  if (!g || !verifyClassOwnership(g.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })
  const { name, color, petType } = req.body
  if (name?.trim()) db.prepare('UPDATE student_groups SET name = ? WHERE id = ?').run(name.trim(), g.id)
  if (color) db.prepare('UPDATE student_groups SET color = ? WHERE id = ?').run(color, g.id)
  if (petType === '') db.prepare('UPDATE student_groups SET pet_type = NULL WHERE id = ?').run(g.id)
  else if (petType) db.prepare('UPDATE student_groups SET pet_type = ? WHERE id = ?').run(petType, g.id)
  res.json({ success: true, group: enrichGroup(db.prepare('SELECT * FROM student_groups WHERE id = ?').get(g.id)) })
})

router.delete('/group/:id', authMiddleware, (req, res) => {
  const g = db.prepare('SELECT * FROM student_groups WHERE id = ?').get(req.params.id)
  if (!g || !verifyClassOwnership(g.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })
  db.prepare('DELETE FROM group_energy_records WHERE group_id = ?').run(req.params.id)
  db.prepare('DELETE FROM student_group_members WHERE group_id = ?').run(req.params.id)
  db.prepare('DELETE FROM student_groups WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/group/:id/members', authMiddleware, (req, res) => {
  const g = db.prepare('SELECT * FROM student_groups WHERE id = ?').get(req.params.id)
  if (!g || !verifyClassOwnership(g.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })
  const { studentIds } = req.body
  if (!Array.isArray(studentIds) || !studentIds.length) return res.status(400).json({ error: '请选择学生' })
  const insert = db.prepare('INSERT OR IGNORE INTO student_group_members (id, group_id, student_id, created_at) VALUES (?, ?, ?, ?)')
  const remove = db.prepare(`
    DELETE FROM student_group_members WHERE student_id = ? AND group_id IN (SELECT id FROM student_groups WHERE class_id = ?)
  `)
  const tx = db.transaction(() => {
    for (const sid of studentIds) {
      const st = verifyStudentOwnership(sid, req.userId)
      if (!st || st.class_id !== g.class_id) continue
      remove.run(sid, g.class_id)
      insert.run(uuidv4(), g.id, sid, Date.now())
    }
  })
  tx()
  res.json({ success: true })
})

router.delete('/group/:id/members/:studentId', authMiddleware, (req, res) => {
  const g = db.prepare('SELECT * FROM student_groups WHERE id = ?').get(req.params.id)
  if (!g || !verifyClassOwnership(g.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })
  db.prepare('DELETE FROM student_group_members WHERE group_id = ? AND student_id = ?').run(req.params.id, req.params.studentId)
  res.json({ success: true })
})

router.post('/group/:id/energy', authMiddleware, (req, res) => {
  const g = db.prepare('SELECT * FROM student_groups WHERE id = ?').get(req.params.id)
  if (!g || !verifyClassOwnership(g.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })

  let { points, reason, ruleKey } = req.body
  if (ruleKey) {
    const rule = DEFAULT_GROUP_RULES.find(r => r.key === ruleKey)
    if (rule) {
      points = rule.points
      reason = reason || rule.name
    }
  }
  points = Number(points)
  if (!Number.isFinite(points) || points === 0) return res.status(400).json({ error: '请输入有效能量值' })
  if (!reason?.trim()) return res.status(400).json({ error: '请填写原因' })

  const prevLevel = g.pet_level || 1
  const nextEnergy = Math.max(0, (g.group_energy || 0) + points)
  const nextLevel = calculateLevel(nextEnergy)
  const rid = uuidv4()
  const tx = db.transaction(() => {
    db.prepare('UPDATE student_groups SET group_energy = ?, pet_level = ? WHERE id = ?')
      .run(nextEnergy, nextLevel, g.id)
    db.prepare(`
      INSERT INTO group_energy_records (id, class_id, group_id, points, reason, rule_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(rid, g.class_id, g.id, points, reason.trim(), ruleKey || null, Date.now())
  })
  tx()

  const updated = enrichGroup(db.prepare('SELECT * FROM student_groups WHERE id = ?').get(g.id))
  res.json({ success: true, group: updated, leveledUp: nextLevel > prevLevel })
})

router.get('/group/:id/records', authMiddleware, (req, res) => {
  const g = db.prepare('SELECT * FROM student_groups WHERE id = ?').get(req.params.id)
  if (!g || !verifyClassOwnership(g.class_id, req.userId)) return res.status(403).json({ error: '无权访问' })
  const rows = db.prepare(`
    SELECT * FROM group_energy_records WHERE group_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(g.id)
  res.json({ records: rows })
})

router.get('/:classId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })

  const groups = db.prepare('SELECT * FROM student_groups WHERE class_id = ? ORDER BY created_at').all(req.params.classId)
  const result = groups.map(enrichGroup)
  result.sort((a, b) => b.groupEnergy - a.groupEnergy)

  const ungrouped = db.prepare(`
    SELECT s.* FROM students s
    WHERE s.class_id = ?
      AND s.id NOT IN (SELECT student_id FROM student_group_members m JOIN student_groups g ON g.id = m.group_id WHERE g.class_id = ?)
    ORDER BY s.name
  `).all(req.params.classId, req.params.classId)

  const recent = db.prepare(`
    SELECT r.*, g.name as group_name, g.color as group_color
    FROM group_energy_records r
    JOIN student_groups g ON g.id = r.group_id
    WHERE r.class_id = ?
    ORDER BY r.created_at DESC
    LIMIT 30
  `).all(req.params.classId)

  res.json({
    groups: result,
    ungrouped,
    rules: DEFAULT_GROUP_RULES,
    recent,
    groupPetEnabled: cls.group_pet_enabled !== 0,
  })
})

router.post('/:classId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })
  const { name, color, petType } = req.body
  if (!name?.trim()) return res.status(400).json({ error: '请输入小组名称' })
  const id = uuidv4()
  db.prepare(`
    INSERT INTO student_groups (id, class_id, name, color, pet_type, pet_level, group_energy, created_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?)
  `).run(id, req.params.classId, name.trim(), color || '#f97316', petType || null, Date.now())
  res.json({ id })
})

export default router
