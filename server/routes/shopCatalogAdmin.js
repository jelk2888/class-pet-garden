import {
  listCatalog,
  createCatalogItem,
  updateCatalogItem,
  setCatalogEnabled,
  deleteCatalogItem,
  seedCatalog,
  catalogStats,
} from '../services/shopCatalogStore.js'
import { SHOP_SOURCES } from '../data/shopCatalogDefaults.js'
import { db } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

export function registerAdminShopCatalogRoutes(router, authMiddleware, adminMiddleware) {
  router.get('/shop-catalog', authMiddleware, adminMiddleware, (req, res) => {
    res.json({
      items: listCatalog({ includeDisabled: true }),
      sources: SHOP_SOURCES,
      stats: catalogStats(),
    })
  })

  router.post('/shop-catalog', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const item = createCatalogItem(req.body || {})
      res.json({ success: true, item })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '创建失败' })
    }
  })

  router.put('/shop-catalog/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const item = updateCatalogItem(req.params.id, req.body || {})
      res.json({ success: true, item })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '更新失败' })
    }
  })

  router.put('/shop-catalog/:id/enabled', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const enabled = !!(req.body && (req.body.enabled === 1 || req.body.enabled === true))
      const item = setCatalogEnabled(req.params.id, enabled)
      res.json({ success: true, item })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '更新失败' })
    }
  })

  router.delete('/shop-catalog/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      res.json(deleteCatalogItem(req.params.id))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '删除失败' })
    }
  })

  router.post('/shop-catalog/seed', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const mode = req.body?.mode === 'replace' ? 'replace' : 'merge'
      const result = seedCatalog(mode)
      res.json({ success: true, ...result, items: listCatalog({ includeDisabled: true }) })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '导入失败' })
    }
  })

  /**
   * 将目录中「显示中」的商品推送到指定班级（跳过同名）
   * body: { classId, onlyEnabled?: true, itemIds?: string[] }
   */
  router.post('/shop-catalog/push', authMiddleware, adminMiddleware, (req, res) => {
    const { classId, onlyEnabled = true, itemIds } = req.body || {}
    if (!classId) return res.status(400).json({ error: '请指定班级' })
    const cls = db.prepare('SELECT id FROM classes WHERE id = ?').get(classId)
    if (!cls) return res.status(404).json({ error: '班级不存在' })

    let catalog = listCatalog({ includeDisabled: true })
    if (Array.isArray(itemIds) && itemIds.length) {
      const set = new Set(itemIds)
      catalog = catalog.filter((i) => set.has(i.id))
    } else if (onlyEnabled) {
      catalog = catalog.filter((i) => i.enabled)
    }

    const existingNames = new Set(
      db.prepare('SELECT name FROM shop_items WHERE class_id = ?').all(classId).map((r) => r.name)
    )
    const insert = db.prepare(`
      INSERT INTO shop_items (id, class_id, name, description, cost, stock, emoji, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    let added = 0
    const now = Date.now()
    const tx = db.transaction(() => {
      for (const it of catalog) {
        if (existingNames.has(it.name)) continue
        insert.run(uuidv4(), classId, it.name, it.description || '', it.cost, it.stock ?? -1, it.emoji || '🎁', 1, now)
        existingNames.add(it.name)
        added++
      }
    })
    tx()
    res.json({ success: true, added, totalCatalog: catalog.length })
  })
}
