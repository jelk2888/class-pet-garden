import { initDb, db } from '../db.js'
import { listCatalog, seedCatalog, catalogStats } from '../services/shopCatalogStore.js'
import { v4 as uuidv4 } from 'uuid'

initDb()
console.log('seedCatalog', seedCatalog('replace'))
console.log('stats', catalogStats())
const enabled = listCatalog({ includeDisabled: false })
console.log('enabled count', enabled.length)

const classes = db.prepare('SELECT id, name FROM classes').all()
const insert = db.prepare(`
  INSERT INTO shop_items (id, class_id, name, description, cost, stock, emoji, enabled, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
`)

for (const cls of classes) {
  const existing = new Set(
    db.prepare('SELECT name FROM shop_items WHERE class_id = ?').all(cls.id).map((r) => r.name)
  )
  let added = 0
  const now = Date.now()
  const tx = db.transaction(() => {
    for (const it of enabled) {
      if (existing.has(it.name)) continue
      insert.run(uuidv4(), cls.id, it.name, it.description || '', it.cost, it.stock ?? -1, it.emoji || '🎁', now)
      existing.add(it.name)
      added++
    }
  })
  tx()
  const total = db.prepare('SELECT count(*) as c FROM shop_items WHERE class_id = ?').get(cls.id).c
  console.log('class', cls.name, 'added', added, 'total', total)
}
