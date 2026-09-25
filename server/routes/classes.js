import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware, requireRegistered } from '../middleware/auth.js'
import { verifyClassOwnership } from '../middleware/ownership.js'

const router = Router()

// 获取班级列表
router.get('/', authMiddleware, (req, res) => {
  const classes = db.prepare('SELECT * FROM classes WHERE user_id = ? ORDER BY created_at DESC').all(req.userId)
  res.json({ classes })
})

// 获取班级学生列表（包含标签）
router.get('/:classId/students', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) {
    return res.status(403).json({ error: '班级不存在或无权访问' })
  }

  const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY name').all(req.params.classId)

  const studentsWithTags = students.map(student => {
    const tags = db.prepare(`
      SELECT st.id, st.name, st.color, st.user_id, st.created_at
      FROM student_tags st
      JOIN student_tag_relations str ON st.id = str.tag_id
      WHERE str.student_id = ? AND st.user_id = ?
      ORDER BY str.created_at DESC
    `).all(student.id, req.userId)

    return { ...student, tags }
  })

  res.json({ students: studentsWithTags })
})

// 班级总览统计
router.get('/:classId/overview', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) {
    return res.status(403).json({ error: '班级不存在或无权访问' })
  }

  const students = db.prepare('SELECT * FROM students WHERE class_id = ?').all(req.params.classId)
  const todayEvals = db.prepare(`
    SELECT count(*) as count FROM evaluation_records
    WHERE class_id = ?
      AND date(timestamp/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
  `).get(req.params.classId)

  const badgeCount = db.prepare(`
    SELECT count(*) as count FROM badges b
    JOIN students s ON s.id = b.student_id
    WHERE s.class_id = ?
  `).get(req.params.classId)

  const topStudents = db.prepare(`
    SELECT s.*,
           (SELECT count(*) FROM badges WHERE student_id = s.id) as badge_count
    FROM students s
    WHERE s.class_id = ?
    ORDER BY s.total_points DESC, s.pet_level DESC
    LIMIT 5
  `).all(req.params.classId)

  res.json({
    stats: {
      studentCount: students.length,
      withPet: students.filter(s => s.pet_type).length,
      graduated: students.filter(s => (s.pet_level || 1) >= 8).length,
      todayEvals: todayEvals?.count || 0,
      totalPoints: students.reduce((a, s) => a + (s.total_points || 0), 0),
      badgeCount: badgeCount?.count || 0,
      injured: students.filter(s => s.pet_status === 'injured').length,
      dead: students.filter(s => s.pet_status === 'dead').length,
    },
    topStudents,
  })
})

// 荣誉墙
router.get('/:classId/honors', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) {
    return res.status(403).json({ error: '班级不存在或无权访问' })
  }

  const rows = db.prepare(`
    SELECT s.*,
           (SELECT count(*) FROM badges WHERE student_id = s.id) as badge_count
    FROM students s
    WHERE s.class_id = ?
      AND (
        s.pet_level >= 8
        OR EXISTS (SELECT 1 FROM badges b WHERE b.student_id = s.id)
      )
    ORDER BY badge_count DESC, s.total_points DESC
  `).all(req.params.classId)

  const honors = rows.map(s => {
    const badges = db.prepare('SELECT * FROM badges WHERE student_id = ? ORDER BY earned_at DESC').all(s.id)
    return { ...s, badges }
  })

  res.json({ honors })
})

// 创建班级
router.post('/', authMiddleware, (req, res) => {
  const { name } = req.body
  const id = uuidv4()
  const now = Date.now()

  db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.userId, name, now, now)

  res.json({ id, user_id: req.userId, name, created_at: now, updated_at: now })
})

// 更新班级
router.put('/:id', authMiddleware, (req, res) => {
  const { name } = req.body
  const cls = verifyClassOwnership(req.params.id, req.userId)

  if (!cls) {
    return res.status(404).json({ error: '班级不存在或无权修改' })
  }

  const now = Date.now()
  db.prepare('UPDATE classes SET name = ?, updated_at = ? WHERE id = ?').run(name, now, req.params.id)
  res.json({ success: true })
})

// 删除班级（游客禁止）
router.delete('/:id', authMiddleware, requireRegistered, (req, res) => {
  const cls = verifyClassOwnership(req.params.id, req.userId)
  if (!cls) {
    return res.status(404).json({ error: '班级不存在或无权删除' })
  }

  const deleteClass = db.transaction(() => {
    db.prepare('DELETE FROM evaluation_records WHERE class_id = ?').run(req.params.id)

    const studentRefs = db.prepare(`
      SELECT m.name AS table_name, fk."from" AS column_name
      FROM sqlite_master m
      JOIN pragma_foreign_key_list(m.name) fk ON fk."table" = 'students' AND fk."to" = 'id'
      WHERE m.type = 'table'
    `).all()

    for (const { table_name, column_name } of studentRefs) {
      db.prepare(`DELETE FROM "${table_name}" WHERE "${column_name}" IN (SELECT id FROM students WHERE class_id = ?)`)
        .run(req.params.id)
    }

    db.prepare('DELETE FROM students WHERE class_id = ?').run(req.params.id)
    db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id)
  })

  deleteClass()
  res.json({ success: true })
})

export default router
