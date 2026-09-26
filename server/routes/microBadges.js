import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware, requireRegistered } from '../middleware/auth.js'
import { verifyClassOwnership } from '../middleware/ownership.js'

const router = Router()

/** 内置微章模板（首次进入班级时自动生成） */
export const DEFAULT_MICRO_BADGES = [
  { name: '学习之星', emoji: '⭐', color: '#f59e0b' },
  { name: '纪律标兵', emoji: '🎖️', color: '#3b82f6' },
  { name: '劳动能手', emoji: '🧹', color: '#22c55e' },
  { name: '助人为乐', emoji: '🤝', color: '#ec4899' },
  { name: '进步之星', emoji: '📈', color: '#8b5cf6' },
  { name: '创意达人', emoji: '💡', color: '#06b6d4' },
  { name: '体育健将', emoji: '⚽', color: '#ef4444' },
  { name: '礼貌之星', emoji: '🌸', color: '#f472b6' },
  { name: '阅读达人', emoji: '📚', color: '#0ea5e9' },
  { name: '小组之光', emoji: '✨', color: '#a855f7' },
  { name: '课堂积极', emoji: '🙋', color: '#fb923c' },
  { name: '特别表扬', emoji: '🏆', color: '#eab308' },
]

function ensureDefaultTypes(classId) {
  const count = db.prepare('SELECT COUNT(*) as c FROM micro_badge_types WHERE class_id = ?').get(classId)?.c || 0
  if (count > 0) return
  const now = Date.now()
  const ins = db.prepare(`
    INSERT INTO micro_badge_types (id, class_id, name, emoji, color, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const tx = db.transaction(() => {
    for (const b of DEFAULT_MICRO_BADGES) {
      ins.run(uuidv4(), classId, b.name, b.emoji, b.color, now)
    }
  })
  tx()
}

/** 列表：类型 + 颁发记录 */
router.get('/:classId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })
  ensureDefaultTypes(req.params.classId)

  const types = db.prepare(
    'SELECT * FROM micro_badge_types WHERE class_id = ? ORDER BY created_at ASC'
  ).all(req.params.classId)

  const awards = db.prepare(`
    SELECT a.*, s.name as student_name, t.name as badge_name, t.emoji, t.color,
           u.username as teacher_name
    FROM micro_badge_awards a
    JOIN students s ON s.id = a.student_id
    JOIN micro_badge_types t ON t.id = a.type_id
    LEFT JOIN users u ON u.id = a.awarded_by
    WHERE a.class_id = ?
    ORDER BY a.earned_at DESC
  `).all(req.params.classId)

  // 毕业徽章（原 honors）
  const graduation = db.prepare(`
    SELECT s.id, s.name, s.pet_type, s.pet_level,
           (SELECT count(*) FROM badges WHERE student_id = s.id) as badge_count
    FROM students s
    WHERE s.class_id = ?
      AND ((s.pet_level OR 0) >= 8 OR EXISTS (SELECT 1 FROM badges b WHERE b.student_id = s.id))
    ORDER BY badge_count DESC, s.total_points DESC
  `).all(req.params.classId).map((s) => {
    const badges = db.prepare('SELECT * FROM badges WHERE student_id = ? ORDER BY earned_at DESC').all(s.id)
    return { ...s, badges }
  })

  res.json({ types, awards, graduation })
})

/** 新建微章类型 */
router.post('/:classId/types', authMiddleware, requireRegistered, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权操作' })
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: '请填写微章名称' })
  const emoji = String(req.body?.emoji || '🏅').trim().slice(0, 8) || '🏅'
  const color = String(req.body?.color || '#f59e0b').trim() || '#f59e0b'
  const id = uuidv4()
  const now = Date.now()
  db.prepare(`
    INSERT INTO micro_badge_types (id, class_id, name, emoji, color, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.classId, name, emoji, color, now)
  res.json({ type: { id, class_id: req.params.classId, name, emoji, color, created_at: now } })
})

/** 删除微章类型（同时删发放记录） */
router.delete('/:classId/types/:typeId', authMiddleware, requireRegistered, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权操作' })
  db.prepare('DELETE FROM micro_badge_awards WHERE type_id = ? AND class_id = ?')
    .run(req.params.typeId, req.params.classId)
  const r = db.prepare('DELETE FROM micro_badge_types WHERE id = ? AND class_id = ?')
    .run(req.params.typeId, req.params.classId)
  if (!r.changes) return res.status(404).json({ error: '微章不存在' })
  res.json({ success: true })
})

/** 颁发微章 */
router.post('/:classId/award', authMiddleware, requireRegistered, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权操作' })
  const { studentId, typeId, note } = req.body || {}
  if (!studentId || !typeId) return res.status(400).json({ error: '请选择学生和微章' })

  const student = db.prepare('SELECT * FROM students WHERE id = ? AND class_id = ?')
    .get(studentId, req.params.classId)
  if (!student) return res.status(404).json({ error: '学生不存在' })
  const type = db.prepare('SELECT * FROM micro_badge_types WHERE id = ? AND class_id = ?')
    .get(typeId, req.params.classId)
  if (!type) return res.status(404).json({ error: '微章类型不存在' })

  const id = uuidv4()
  const now = Date.now()
  db.prepare(`
    INSERT INTO micro_badge_awards (id, class_id, student_id, type_id, note, awarded_by, earned_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.classId, studentId, typeId, note || null, req.userId, now)

  res.json({
    award: {
      id,
      class_id: req.params.classId,
      student_id: studentId,
      student_name: student.name,
      type_id: typeId,
      badge_name: type.name,
      emoji: type.emoji,
      color: type.color,
      note: note || null,
      earned_at: now,
    },
  })
})

/** 撤销颁发 */
router.delete('/:classId/awards/:awardId', authMiddleware, requireRegistered, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权操作' })
  const r = db.prepare('DELETE FROM micro_badge_awards WHERE id = ? AND class_id = ?')
    .run(req.params.awardId, req.params.classId)
  if (!r.changes) return res.status(404).json({ error: '记录不存在' })
  res.json({ success: true })
})

export default router
