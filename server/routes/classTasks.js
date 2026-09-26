import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { verifyClassOwnership, verifyStudentOwnership } from '../middleware/ownership.js'
import { calculateLevel, getLevelConfigForClass } from '../utils/level.js'

const router = Router()

router.get('/:classId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })

  const tasks = db.prepare('SELECT * FROM class_tasks WHERE class_id = ? ORDER BY created_at DESC').all(req.params.classId)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayTs = todayStart.getTime()

  const withStats = tasks.map(t => {
    const todayCount = db.prepare(`
      SELECT count(*) as c FROM class_task_completions WHERE task_id = ? AND created_at >= ?
    `).get(t.id, todayTs).c
    const totalCount = db.prepare('SELECT count(*) as c FROM class_task_completions WHERE task_id = ?').get(t.id).c
    return { ...t, todayCount, totalCount }
  })

  // 复活任务摘要（已有功能）
  let revival = { enabled: false, tasks: [] }
  try {
    const user = db.prepare('SELECT revival_enabled FROM users WHERE id = ?').get(req.userId)
    revival.enabled = !!user?.revival_enabled
    revival.tasks = db.prepare(`
      SELECT * FROM revival_tasks WHERE user_id = ? AND is_enabled = 1 ORDER BY sort_order, created_at
    `).all(req.userId)
  } catch {
    // ignore
  }

  const recent = db.prepare(`
    SELECT c.*, t.name as task_name, s.name as student_name
    FROM class_task_completions c
    JOIN class_tasks t ON t.id = c.task_id
    JOIN students s ON s.id = c.student_id
    WHERE t.class_id = ?
    ORDER BY c.created_at DESC LIMIT 40
  `).all(req.params.classId)

  res.json({ tasks: withStats, revival, recent })
})

router.post('/:classId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })
  const { name, description, points, repeatable } = req.body
  if (!name?.trim()) return res.status(400).json({ error: '请输入任务名称' })
  const id = uuidv4()
  db.prepare(`INSERT INTO class_tasks (id, class_id, name, description, points, repeatable, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)`).run(
    id, req.params.classId, name.trim(), description || '', points ?? 1, repeatable ?? 1, Date.now()
  )
  res.json({ id })
})

router.delete('/task/:id', authMiddleware, (req, res) => {
  const t = db.prepare('SELECT * FROM class_tasks WHERE id = ?').get(req.params.id)
  if (!t || !verifyClassOwnership(t.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })
  db.prepare('DELETE FROM class_task_completions WHERE task_id = ?').run(req.params.id)
  db.prepare('DELETE FROM class_tasks WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/task/:id/complete', authMiddleware, (req, res) => {
  const t = db.prepare('SELECT * FROM class_tasks WHERE id = ? AND enabled = 1').get(req.params.id)
  if (!t || !verifyClassOwnership(t.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })
  const { studentIds } = req.body
  if (!Array.isArray(studentIds) || !studentIds.length) return res.status(400).json({ error: '请选择学生' })

  const pts = t.points || 1
  const tx = db.transaction(() => {
    let n = 0
    for (const sid of studentIds) {
      const st = verifyStudentOwnership(sid, req.userId)
      if (!st || st.class_id !== t.class_id) continue
      const newPoints = (st.total_points || 0) + pts
      const newExp = Math.max(0, (st.pet_exp || 0) + pts)
      const newLevel = calculateLevel(newExp, getLevelConfigForClass(t.class_id))
      db.prepare('UPDATE students SET total_points = ?, pet_exp = ?, pet_level = ? WHERE id = ?')
        .run(newPoints, newExp, newLevel, sid)
      db.prepare(`INSERT INTO class_task_completions (id, task_id, student_id, points, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(uuidv4(), t.id, sid, pts, Date.now())
      db.prepare(`INSERT INTO evaluation_records (id, class_id, student_id, points, reason, category, timestamp, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uuidv4(), t.class_id, sid, pts, `任务：${t.name}`, '其他', Date.now(), req.userId
      )
      n++
    }
    return n
  })
  res.json({ success: true, completed: tx() })
})

export default router
