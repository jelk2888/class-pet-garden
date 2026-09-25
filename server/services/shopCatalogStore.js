/**
 * 全局积分商城目录（管理员配置）
 * 持久化：server/data/shop-catalog.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_SHOP_CATALOG } from '../data/shopCatalogDefaults.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CATALOG_PATH = path.resolve(__dirname, '../data/shop-catalog.json')

function ensureFile() {
  const dir = path.dirname(CATALOG_PATH)
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(CATALOG_PATH)) {
    writeAll(DEFAULT_SHOP_CATALOG.map(normalize))
  }
}

function normalize(item) {
  return {
    id: item.id || uuidv4(),
    name: String(item.name || '').trim(),
    description: item.description || '',
    cost: Math.max(1, Number(item.cost) || 1),
    stock: item.stock === undefined || item.stock === null ? -1 : Number(item.stock),
    emoji: item.emoji || '🎁',
    category: item.category || '其他',
    source: item.source || 'custom',
    enabled: item.enabled === 0 || item.enabled === false ? 0 : 1,
    createdAt: item.createdAt || Date.now(),
    updatedAt: item.updatedAt || Date.now(),
  }
}

function readAll() {
  ensureFile()
  try {
    const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
    const items = Array.isArray(raw) ? raw : raw.items || []
    return items.map(normalize)
  } catch {
    return DEFAULT_SHOP_CATALOG.map(normalize)
  }
}

function writeAll(items) {
  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true })
  fs.writeFileSync(
    CATALOG_PATH,
    JSON.stringify({ updatedAt: Date.now(), items }, null, 2),
    'utf8'
  )
}

export function listCatalog({ includeDisabled = true } = {}) {
  const items = readAll()
  const filtered = includeDisabled ? items : items.filter((i) => i.enabled)
  return filtered.sort((a, b) => {
    if (a.enabled !== b.enabled) return b.enabled - a.enabled
    if (a.source !== b.source) return String(a.source).localeCompare(String(b.source))
    return a.cost - b.cost || a.name.localeCompare(b.name, 'zh')
  })
}

export function getCatalogItem(id) {
  return readAll().find((i) => i.id === id) || null
}

export function createCatalogItem(body) {
  if (!body?.name?.trim()) {
    const err = new Error('请填写商品名称')
    err.status = 400
    throw err
  }
  const items = readAll()
  const item = normalize({
    ...body,
    id: body.id || uuidv4(),
    source: body.source || 'custom',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  if (items.some((i) => i.id === item.id)) {
    const err = new Error('商品 ID 已存在')
    err.status = 400
    throw err
  }
  items.push(item)
  writeAll(items)
  return item
}

export function updateCatalogItem(id, body) {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx < 0) {
    const err = new Error('商品不存在')
    err.status = 404
    throw err
  }
  const prev = items[idx]
  items[idx] = normalize({
    ...prev,
    ...body,
    id: prev.id,
    createdAt: prev.createdAt,
    updatedAt: Date.now(),
  })
  writeAll(items)
  return items[idx]
}

export function setCatalogEnabled(id, enabled) {
  return updateCatalogItem(id, { enabled: enabled ? 1 : 0 })
}

export function deleteCatalogItem(id) {
  const items = readAll()
  const next = items.filter((i) => i.id !== id)
  if (next.length === items.length) {
    const err = new Error('商品不存在')
    err.status = 404
    throw err
  }
  writeAll(next)
  return { success: true, id }
}

/** 用默认三站目录覆盖/合并：merge=跳过同 id；replace=全量替换 */
export function seedCatalog(mode = 'merge') {
  const defaults = DEFAULT_SHOP_CATALOG.map(normalize)
  if (mode === 'replace') {
    writeAll(defaults)
    return { added: defaults.length, total: defaults.length, mode }
  }
  const items = readAll()
  const ids = new Set(items.map((i) => i.id))
  let added = 0
  for (const d of defaults) {
    if (ids.has(d.id)) continue
    items.push(d)
    ids.add(d.id)
    added++
  }
  writeAll(items)
  return { added, total: items.length, mode }
}

export function catalogStats() {
  const items = readAll()
  const bySource = {}
  for (const i of items) {
    bySource[i.source] = (bySource[i.source] || 0) + 1
  }
  return {
    total: items.length,
    enabled: items.filter((i) => i.enabled).length,
    disabled: items.filter((i) => !i.enabled).length,
    bySource,
  }
}
