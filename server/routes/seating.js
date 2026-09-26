import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { verifyClassOwnership } from '../middleware/ownership.js'

const router = Router()

function parseChart(row) {
  if (!row) return null
  let pattern = [1, 1, 1, 1]
  let seats = []
  try { pattern = JSON.parse(row.pattern) } catch { /* keep default */ }
  try { seats = JSON.parse(row.seats) } catch { /* keep empty */ }
  return {
    id: row.id,
    class_id: row.class_id,
    name: row.name,
    rows: row.rows,
    pattern: Array.isArray(pattern) ? pattern.map(n => Math.max(1, Number(n) || 1)) : [1, 1, 1, 1],
    podium: row.podium === 'bottom' ? 'bottom' : 'top',
    seats: Array.isArray(seats) ? seats : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function seatsPerRow(pattern) {
  return pattern.reduce((a, b) => a + b, 0)
}

function normalizeSeats(seats, total) {
  const arr = Array.isArray(seats) ? [...seats] : []
  while (arr.length < total) arr.push(null)
  return arr.slice(0, total).map(id => (id ? String(id) : null))
}

/** 列出班级座位表 */
router.get('/:classId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问此班级' })
  const rows = db.prepare(
    'SELECT * FROM class_seat_charts WHERE class_id = ? ORDER BY updated_at DESC'
  ).all(req.params.classId)
  res.json({ charts: rows.map(parseChart) })
})

/** 获取单张 */
router.get('/:classId/:chartId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问此班级' })
  const row = db.prepare(
    'SELECT * FROM class_seat_charts WHERE id = ? AND class_id = ?'
  ).get(req.params.chartId, req.params.classId)
  if (!row) return res.status(404).json({ error: '座位表不存在' })
  res.json({ chart: parseChart(row) })
})

/** 创建 */
router.post('/:classId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问此班级' })

  const name = String(req.body.name || '座位表').trim() || '座位表'
  const rows = Math.min(20, Math.max(1, Number(req.body.rows) || 6))
  let pattern = req.body.pattern
  if (typeof pattern === 'string') {
    pattern = pattern.split(/[-,，\s]+/).map(n => Math.max(1, parseInt(n, 10) || 1)).filter(Boolean)
  }
  if (!Array.isArray(pattern) || !pattern.length) pattern = [1, 1, 1, 1]
  pattern = pattern.map(n => Math.max(1, Math.min(8, Number(n) || 1))).slice(0, 12)
  const podium = req.body.podium === 'bottom' ? 'bottom' : 'top'
  const total = rows * seatsPerRow(pattern)
  if (total > 200) return res.status(400).json({ error: '单表上限 200 座' })

  let seats = normalizeSeats(req.body.seats, total)
  // 可选：创建时自动按学生名单顺序填座
  if (req.body.autoFill) {
    const students = db.prepare(
      'SELECT id FROM students WHERE class_id = ? ORDER BY student_no, name'
    ).all(req.params.classId)
    seats = Array(total).fill(null)
    students.forEach((s, i) => {
      if (i < total) seats[i] = s.id
    })
  }

  const id = uuidv4()
  const now = Date.now()
  db.prepare(`
    INSERT INTO class_seat_charts (id, class_id, name, rows, pattern, podium, seats, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.classId, name, rows, JSON.stringify(pattern), podium, JSON.stringify(seats), now, now)

  const chart = parseChart(db.prepare('SELECT * FROM class_seat_charts WHERE id = ?').get(id))
  res.json({ chart })
})

/** 更新（布局 / 座位 / 名称） */
router.put('/:classId/:chartId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问此班级' })
  const existing = db.prepare(
    'SELECT * FROM class_seat_charts WHERE id = ? AND class_id = ?'
  ).get(req.params.chartId, req.params.classId)
  if (!existing) return res.status(404).json({ error: '座位表不存在' })

  const cur = parseChart(existing)
  const name = req.body.name != null ? (String(req.body.name).trim() || cur.name) : cur.name
  const rows = req.body.rows != null ? Math.min(20, Math.max(1, Number(req.body.rows) || cur.rows)) : cur.rows
  let pattern = cur.pattern
  if (req.body.pattern != null) {
    let p = req.body.pattern
    if (typeof p === 'string') {
      p = p.split(/[-,，\s]+/).map(n => Math.max(1, parseInt(n, 10) || 1)).filter(Boolean)
    }
    if (Array.isArray(p) && p.length) {
      pattern = p.map(n => Math.max(1, Math.min(8, Number(n) || 1))).slice(0, 12)
    }
  }
  const podium = req.body.podium === 'bottom' ? 'bottom' : (req.body.podium === 'top' ? 'top' : cur.podium)
  const total = rows * seatsPerRow(pattern)
  if (total > 200) return res.status(400).json({ error: '单表上限 200 座' })

  let seats = normalizeSeats(req.body.seats != null ? req.body.seats : cur.seats, total)
  // 若布局尺寸变了且未显式传 seats，尽量保留已有安排
  if (req.body.seats == null && (rows !== cur.rows || JSON.stringify(pattern) !== JSON.stringify(cur.pattern))) {
    seats = normalizeSeats(cur.seats, total)
  }

  const now = Date.now()
  db.prepare(`
    UPDATE class_seat_charts
    SET name = ?, rows = ?, pattern = ?, podium = ?, seats = ?, updated_at = ?
    WHERE id = ? AND class_id = ?
  `).run(name, rows, JSON.stringify(pattern), podium, JSON.stringify(seats), now, req.params.chartId, req.params.classId)

  const chart = parseChart(
    db.prepare('SELECT * FROM class_seat_charts WHERE id = ?').get(req.params.chartId)
  )
  res.json({ chart })
})

/** 删除 */
router.delete('/:classId/:chartId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问此班级' })
  const r = db.prepare(
    'DELETE FROM class_seat_charts WHERE id = ? AND class_id = ?'
  ).run(req.params.chartId, req.params.classId)
  if (!r.changes) return res.status(404).json({ error: '座位表不存在' })
  res.json({ success: true })
})

export default router
