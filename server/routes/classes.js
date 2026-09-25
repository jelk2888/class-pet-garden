import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { randomBytes } from 'crypto'
import { db } from '../db.js'
import { authMiddleware, requireRegistered } from '../middleware/auth.js'
import { verifyClassOwnership, verifyClassOwnerOnly, isClassOwner } from '../middleware/ownership.js'

const router = Router()

function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const bytes = randomBytes(6)
  for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length]
  return code
}

function uniqueInviteCode() {
  for (let i = 0; i < 30; i++) {
    const code = genInviteCode()
    if (!db.prepare('SELECT 1 FROM classes WHERE invite_code = ?').get(code)) return code
  }
  return uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()
}

function classRoleFor(classId, userId) {
  if (userId === 'admin') return 'owner'
  const cls = db.prepare('SELECT user_id FROM classes WHERE id = ?').get(classId)
  if (cls?.user_id === userId) return 'owner'
  const row = db.prepare(
    'SELECT role FROM class_teachers WHERE class_id = ? AND user_id = ?'
  ).get(classId, userId)
  return row?.role || 'teacher'
}

function enrichClass(cls, userId) {
  const role = classRoleFor(cls.id, userId)
  const teacherCount = db.prepare(
    'SELECT COUNT(*) as c FROM class_teachers WHERE class_id = ?'
  ).get(cls.id)?.c || 0
  return {
    ...cls,
    role,
    is_owner: role === 'owner',
    teacher_count: teacherCount,
    // 邀请码仅班主任可见（任教教师可入班后使用功能，但不展示码以免外泄）
    invite_code: role === 'owner' ? cls.invite_code : undefined,
  }
}

// 获取班级列表（自建 + 入班任教）
router.get('/', authMiddleware, (req, res) => {
  const classes = db.prepare(`
    SELECT DISTINCT c.*
    FROM classes c
    LEFT JOIN class_teachers ct ON ct.class_id = c.id
    WHERE c.user_id = ? OR ct.user_id = ?
    ORDER BY c.created_at DESC
  `).all(req.userId, req.userId)

  res.json({ classes: classes.map((c) => enrichClass(c, req.userId)) })
})

// 教师通过邀请码入班
router.post('/join', authMiddleware, requireRegistered, (req, res) => {
  const raw = String(req.body?.inviteCode || req.body?.code || '').trim().toUpperCase()
  if (!raw || raw.length < 4) {
    return res.status(400).json({ error: '请输入有效的班级邀请码' })
  }

  const cls = db.prepare('SELECT * FROM classes WHERE invite_code = ?').get(raw)
  if (!cls) {
    return res.status(404).json({ error: '邀请码无效，请核对后重试' })
  }

  if (cls.user_id === req.userId) {
    return res.status(400).json({ error: '你已是该班班主任，无需入班' })
  }

  const exists = db.prepare(
    'SELECT 1 FROM class_teachers WHERE class_id = ? AND user_id = ?'
  ).get(cls.id, req.userId)
  if (exists) {
    return res.json({
      success: true,
      already: true,
      class: enrichClass(cls, req.userId),
      message: '你已在该班任教',
    })
  }

  const now = Date.now()
  db.prepare(`
    INSERT INTO class_teachers (id, class_id, user_id, role, joined_at)
    VALUES (?, ?, ?, 'teacher', ?)
  `).run(uuidv4(), cls.id, req.userId, now)

  res.json({
    success: true,
    class: enrichClass(cls, req.userId),
    message: `已加入「${cls.name}」，可给学生加分评宠`,
  })
})

// 获取班级任教教师列表
router.get('/:classId/teachers', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) {
    return res.status(403).json({ error: '班级不存在或无权访问' })
  }

  const teachers = db.prepare(`
    SELECT ct.id, ct.class_id, ct.user_id, ct.role, ct.joined_at, u.username
    FROM class_teachers ct
    JOIN users u ON u.id = ct.user_id
    WHERE ct.class_id = ?
    ORDER BY CASE WHEN ct.role = 'owner' THEN 0 ELSE 1 END, ct.joined_at
  `).all(req.params.classId)

  // 确保班主任也在列表（兼容旧数据）
  if (cls.user_id && !teachers.some((t) => t.user_id === cls.user_id)) {
    const owner = db.prepare('SELECT id, username FROM users WHERE id = ?').get(cls.user_id)
    if (owner) {
      teachers.unshift({
        id: `owner_${cls.user_id}`,
        class_id: cls.id,
        user_id: owner.id,
        role: 'owner',
        joined_at: cls.created_at,
        username: owner.username,
      })
    }
  }

  res.json({
    teachers,
    invite_code: isClassOwner(cls.id, req.userId) ? cls.invite_code : undefined,
    is_owner: isClassOwner(cls.id, req.userId),
  })
})

// 重置邀请码（仅班主任）
router.post('/:classId/invite-code/reset', authMiddleware, requireRegistered, (req, res) => {
  const cls = verifyClassOwnerOnly(req.params.classId, req.userId)
  if (!cls) {
    return res.status(403).json({ error: '仅班主任可重置邀请码' })
  }
  const code = uniqueInviteCode()
  db.prepare('UPDATE classes SET invite_code = ?, updated_at = ? WHERE id = ?')
    .run(code, Date.now(), cls.id)
  res.json({ success: true, invite_code: code })
})

// 任教教师离开班级
router.post('/:classId/leave', authMiddleware, requireRegistered, (req, res) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.classId)
  if (!cls) return res.status(404).json({ error: '班级不存在' })
  if (cls.user_id === req.userId) {
    return res.status(400).json({ error: '班主任不能离开，请删除班级或转让后再操作' })
  }
  const r = db.prepare(
    'DELETE FROM class_teachers WHERE class_id = ? AND user_id = ? AND role != ?'
  ).run(cls.id, req.userId, 'owner')
  if (r.changes === 0) {
    return res.status(400).json({ error: '你不在该班任教列表中' })
  }
  res.json({ success: true })
})

// 班主任移除任教教师
router.delete('/:classId/teachers/:userId', authMiddleware, requireRegistered, (req, res) => {
  const cls = verifyClassOwnerOnly(req.params.classId, req.userId)
  if (!cls) {
    return res.status(403).json({ error: '仅班主任可移除任教教师' })
  }
  if (req.params.userId === cls.user_id) {
    return res.status(400).json({ error: '不能移除班主任自己' })
  }
  db.prepare(
    'DELETE FROM class_teachers WHERE class_id = ? AND user_id = ?'
  ).run(cls.id, req.params.userId)
  res.json({ success: true })
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
  const invite_code = uniqueInviteCode()

  const create = db.transaction(() => {
    db.prepare(
      'INSERT INTO classes (id, user_id, name, created_at, updated_at, invite_code) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, req.userId, name, now, now, invite_code)

    db.prepare(`
      INSERT INTO class_teachers (id, class_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'owner', ?)
    `).run(uuidv4(), id, req.userId, now)
  })
  create()

  res.json({
    id,
    user_id: req.userId,
    name,
    created_at: now,
    updated_at: now,
    invite_code,
    role: 'owner',
    is_owner: true,
  })
})

const ALLOWED_THEMES = ['peach', 'ocean', 'forest', 'paper', 'violet']

function ensureUiThemeColumn() {
  try {
    db.exec(`ALTER TABLE classes ADD COLUMN ui_theme TEXT DEFAULT 'peach'`)
  } catch (e) {
    // already exists
  }
}

// 仅更新主题（必须写在 PUT /:id 之前，避免被吞）
router.put('/:id/theme', authMiddleware, (req, res) => {
  ensureUiThemeColumn()
  const theme = req.body?.ui_theme || req.body?.theme
  if (!theme || !ALLOWED_THEMES.includes(theme)) {
    return res.status(400).json({ error: '无效主题' })
  }
  const cls = verifyClassOwnership(req.params.id, req.userId)
  if (!cls) return res.status(403).json({ error: '无权修改该班级样式（请确认已登录且已入班）' })
  try {
    db.prepare('UPDATE classes SET ui_theme = ?, updated_at = ? WHERE id = ?')
      .run(theme, Date.now(), req.params.id)
  } catch (e) {
    console.error('update theme failed', e)
    return res.status(500).json({ error: '数据库写入失败，请重启后端服务' })
  }
  res.json({ success: true, ui_theme: theme })
})

// 更新班级（任教教师可改名 / 改主题；删除仅班主任）
router.put('/:id', authMiddleware, (req, res) => {
  ensureUiThemeColumn()
  const { name, ui_theme, uiTheme } = req.body
  const cls = verifyClassOwnership(req.params.id, req.userId)

  if (!cls) {
    return res.status(404).json({ error: '班级不存在或无权修改' })
  }

  const now = Date.now()
  const theme = ui_theme || uiTheme
  if (name != null && String(name).trim()) {
    db.prepare('UPDATE classes SET name = ?, updated_at = ? WHERE id = ?')
      .run(String(name).trim(), now, req.params.id)
  }
  if (theme && ALLOWED_THEMES.includes(theme)) {
    try {
      db.prepare('UPDATE classes SET ui_theme = ?, updated_at = ? WHERE id = ?')
        .run(theme, now, req.params.id)
    } catch (e) {
      console.error('update class theme failed', e)
      return res.status(500).json({ error: '主题字段写入失败，请重启后端' })
    }
  }
  res.json({ success: true })
})

// 删除班级（仅班主任；游客禁止）
router.delete('/:id', authMiddleware, requireRegistered, (req, res) => {
  const cls = verifyClassOwnerOnly(req.params.id, req.userId)
  if (!cls) {
    return res.status(404).json({ error: '班级不存在或无权删除（仅班主任可删）' })
  }

  const deleteClass = db.transaction(() => {
    db.prepare('DELETE FROM evaluation_records WHERE class_id = ?').run(req.params.id)
    db.prepare('DELETE FROM class_teachers WHERE class_id = ?').run(req.params.id)

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
