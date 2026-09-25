import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { verifyClassOwnership, verifyStudentOwnership } from '../middleware/ownership.js'
import { calculateLevel } from '../utils/level.js'
import { listCatalog, getCatalogItem } from '../services/shopCatalogStore.js'

const router = Router()

/** 教师可读：全局目录中「显示中」的商品 */
router.get('/catalog', authMiddleware, (req, res) => {
  res.json({ items: listCatalog({ includeDisabled: false }) })
})

router.get('/:classId', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })
  const items = db.prepare('SELECT * FROM shop_items WHERE class_id = ? ORDER BY cost ASC, created_at DESC').all(req.params.classId)
  const recent = db.prepare(`
    SELECT r.*, s.name as student_name, i.name as item_name, i.emoji
    FROM shop_redemptions r
    JOIN students s ON s.id = r.student_id
    JOIN shop_items i ON i.id = r.item_id
    WHERE r.class_id = ?
    ORDER BY r.created_at DESC LIMIT 30
  `).all(req.params.classId)
  res.json({ items, recent })
})

router.post('/:classId/items', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })
  const { name, description, cost, stock, emoji } = req.body
  if (!name?.trim() || !cost || cost < 1) return res.status(400).json({ error: '请填写名称和积分价格' })
  const id = uuidv4()
  db.prepare(`INSERT INTO shop_items (id, class_id, name, description, cost, stock, emoji, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(
    id, req.params.classId, name.trim(), description || '', cost, stock ?? -1, emoji || '🎁', Date.now()
  )
  res.json({ id })
})

/** 从全局目录导入到本班（跳过同名） */
router.post('/:classId/import-catalog', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })
  const { itemIds } = req.body || {}
  let catalog = listCatalog({ includeDisabled: false })
  if (Array.isArray(itemIds) && itemIds.length) {
    const set = new Set(itemIds)
    catalog = catalog.filter((i) => set.has(i.id))
  }
  const existingNames = new Set(
    db.prepare('SELECT name FROM shop_items WHERE class_id = ?').all(req.params.classId).map((r) => r.name)
  )
  const insert = db.prepare(`
    INSERT INTO shop_items (id, class_id, name, description, cost, stock, emoji, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `)
  let added = 0
  const now = Date.now()
  const tx = db.transaction(() => {
    for (const it of catalog) {
      if (existingNames.has(it.name)) continue
      insert.run(uuidv4(), req.params.classId, it.name, it.description || '', it.cost, it.stock ?? -1, it.emoji || '🎁', now)
      existingNames.add(it.name)
      added++
    }
  })
  tx()
  res.json({ success: true, added })
})

router.post('/:classId/import-one', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })
  const { catalogId } = req.body || {}
  const it = getCatalogItem(catalogId)
  if (!it || !it.enabled) return res.status(404).json({ error: '目录商品不存在或未显示' })
  const dup = db.prepare('SELECT id FROM shop_items WHERE class_id = ? AND name = ?').get(req.params.classId, it.name)
  if (dup) return res.status(400).json({ error: '班级已有同名商品' })
  const id = uuidv4()
  db.prepare(`INSERT INTO shop_items (id, class_id, name, description, cost, stock, emoji, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(
    id, req.params.classId, it.name, it.description || '', it.cost, it.stock ?? -1, it.emoji || '🎁', Date.now()
  )
  res.json({ success: true, id })
})

router.put('/items/:id', authMiddleware, (req, res) => {
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(req.params.id)
  if (!item || !verifyClassOwnership(item.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })
  const { name, description, cost, stock, emoji, enabled } = req.body
  db.prepare(`UPDATE shop_items SET name=?, description=?, cost=?, stock=?, emoji=?, enabled=? WHERE id=?`).run(
    name ?? item.name,
    description ?? item.description,
    cost ?? item.cost,
    stock ?? item.stock,
    emoji ?? item.emoji,
    enabled === undefined ? item.enabled : (enabled ? 1 : 0),
    req.params.id
  )
  res.json({ success: true })
})

router.delete('/items/:id', authMiddleware, (req, res) => {
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(req.params.id)
  if (!item || !verifyClassOwnership(item.class_id, req.userId)) return res.status(403).json({ error: '无权操作' })
  db.prepare('DELETE FROM shop_items WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/:classId/redeem', authMiddleware, (req, res) => {
  const cls = verifyClassOwnership(req.params.classId, req.userId)
  if (!cls) return res.status(403).json({ error: '无权访问' })
  const { studentId, itemId } = req.body
  const student = verifyStudentOwnership(studentId, req.userId)
  if (!student || student.class_id !== req.params.classId) return res.status(403).json({ error: '学生无效' })
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND class_id = ? AND enabled = 1').get(itemId, req.params.classId)
  if (!item) return res.status(404).json({ error: '商品不存在或已下架' })
  if (item.stock === 0) return res.status(400).json({ error: '库存不足' })
  if ((student.total_points || 0) < item.cost) return res.status(400).json({ error: '积分不足' })

  const tx = db.transaction(() => {
    const newPoints = student.total_points - item.cost
    const newExp = Math.max(0, (student.pet_exp || 0) - item.cost)
    const newLevel = calculateLevel(newExp)
    db.prepare('UPDATE students SET total_points = ?, pet_exp = ?, pet_level = ? WHERE id = ?')
      .run(newPoints, newExp, newLevel, studentId)
    if (item.stock > 0) {
      db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE id = ?').run(itemId)
    }
    const rid = uuidv4()
    db.prepare(`INSERT INTO shop_redemptions (id, class_id, item_id, student_id, cost, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(rid, req.params.classId, itemId, studentId, item.cost, Date.now())
    db.prepare(`INSERT INTO evaluation_records (id, class_id, student_id, points, reason, category, timestamp, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      uuidv4(), req.params.classId, studentId, -item.cost, `兑换：${item.name}`, '其他', Date.now(), req.userId
    )
    return rid
  })
  const rid = tx()
  res.json({ success: true, id: rid })
})

export default router
