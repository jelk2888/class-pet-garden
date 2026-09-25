import db from '../db.js'

/** 是否班级创建者（班主任） */
export function isClassOwner(classId, userId) {
  if (!classId || !userId) return false
  if (userId === 'admin') return true
  const row = db.prepare('SELECT user_id FROM classes WHERE id = ?').get(classId)
  return !!(row && row.user_id === userId)
}

/** 是否班级成员（班主任或任教教师） */
export function isClassMember(classId, userId) {
  if (!classId || !userId) return false
  if (userId === 'admin') return true
  const cls = db.prepare('SELECT id, user_id FROM classes WHERE id = ?').get(classId)
  if (!cls) return false
  if (cls.user_id === userId) return true
  const member = db.prepare(
    'SELECT 1 FROM class_teachers WHERE class_id = ? AND user_id = ?'
  ).get(classId, userId)
  return !!member
}

/**
 * 校验班级访问权（班主任 / 任教教师均可）
 * 用于查看、加分、学生管理等日常教学操作
 */
export function verifyClassOwnership(classId, userId) {
  if (!classId) return null
  if (!isClassMember(classId, userId)) return null
  return db.prepare('SELECT * FROM classes WHERE id = ?').get(classId) || null
}

/** 仅班主任（创建者）可执行：删除班级、踢人、重置邀请码等 */
export function verifyClassOwnerOnly(classId, userId) {
  if (!classId) return null
  if (!isClassOwner(classId, userId)) return null
  return db.prepare('SELECT * FROM classes WHERE id = ?').get(classId) || null
}

/** @deprecated 使用 verifyClassOwnership（已含任教教师） */
export function verifyClassAccess(classId, userId) {
  return verifyClassOwnership(classId, userId)
}

export function verifyStudentOwnership(studentId, userId) {
  if (!studentId) return null
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId)
  if (!student) return null
  if (!verifyClassOwnership(student.class_id, userId)) return null
  return student
}

export function verifyStudentsOwnership(studentIds, userId) {
  if (!studentIds || studentIds.length === 0) return []
  const placeholders = studentIds.map(() => '?').join(',')
  const students = db.prepare(
    `SELECT * FROM students WHERE id IN (${placeholders})`
  ).all(...studentIds)
  return students.filter((s) => isClassMember(s.class_id, userId))
}

export function verifyRecordOwnership(recordId, userId) {
  if (!recordId) return null
  const record = db.prepare('SELECT * FROM evaluation_records WHERE id = ?').get(recordId)
  if (!record) return null
  if (!verifyClassOwnership(record.class_id, userId)) return null
  return record
}

export function requireClassOwnership(req, res, next) {
  const classId = req.params.classId || req.params.id || req.body.classId || req.query.classId
  const cls = verifyClassOwnership(classId, req.userId)
  if (!cls) {
    return res.status(403).json({ error: '无权访问此班级' })
  }
  req.class = cls
  next()
}
