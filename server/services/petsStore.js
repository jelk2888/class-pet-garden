/**
 * 宠物图鉴存储：public/pets/{id}/lv0..lv8.png + manifest.json
 * lv0=蛋形态，lv8=满级
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PETS_ROOT = path.resolve(__dirname, '../../public/pets')
const MANIFEST_PATH = path.join(PETS_ROOT, 'manifest.json')
const DIST_PETS = path.resolve(__dirname, '../../dist/pets')
const MY_PETS_CATALOG = path.resolve(__dirname, '../data/my-pets-catalog.json')

function loadMyPetsCatalog() {
  try {
    if (!fs.existsSync(MY_PETS_CATALOG)) return []
    const rows = JSON.parse(fs.readFileSync(MY_PETS_CATALOG, 'utf8'))
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

/** 与前端 pets.ts 对齐的内置元数据 */
export const BUILTIN_PETS = [
  { id: 'west-highland', name: '西高地', category: 'normal' },
  { id: 'bichon', name: '比熊', category: 'normal' },
  { id: 'border-collie', name: '边牧', category: 'normal' },
  { id: 'shiba', name: '柴犬', category: 'normal' },
  { id: 'golden-retriever', name: '金毛', category: 'normal' },
  { id: 'samoyed', name: '萨摩耶', category: 'normal' },
  { id: 'husky', name: '哈士奇', category: 'normal' },
  { id: 'tabby-cat', name: '虎斑猫', category: 'normal' },
  { id: 'persian-cat', name: '波斯猫', category: 'normal' },
  { id: 'ragdoll-cat', name: '布偶猫', category: 'normal' },
  { id: 'orange-cat', name: '橘猫', category: 'normal' },
  { id: 'lop-rabbit', name: '垂耳兔', category: 'normal' },
  { id: 'angora-rabbit', name: '安哥拉兔', category: 'normal' },
  { id: 'hamster', name: '仓鼠', category: 'normal' },
  { id: 'winter-hamster', name: '银狐仓鼠', category: 'normal' },
  { id: 'call-duck', name: '柯尔鸭', category: 'normal' },
  { id: 'alpaca', name: '羊驼', category: 'normal' },
  { id: 'red-panda', name: '小熊猫', category: 'normal' },
  { id: 'corgi', name: '柯基', category: 'normal' },
  { id: 'white-tiger', name: '白虎', category: 'mythical' },
  { id: 'unicorn', name: '独角兽', category: 'mythical' },
  { id: 'azure-dragon', name: '青龙', category: 'mythical' },
  { id: 'vermilion-bird', name: '朱雀', category: 'mythical' },
  { id: 'succulent-spirit', name: '多肉精灵', category: 'mythical' },
  { id: 'pixiu', name: '貔貅', category: 'mythical' },
  { id: 'suanni', name: '狻猊', category: 'mythical' },
]

const ID_RE = /^[a-z][a-z0-9-]{1,47}$/

export function isValidPetId(id) {
  return typeof id === 'string' && ID_RE.test(id)
}

function ensureRoot() {
  fs.mkdirSync(PETS_ROOT, { recursive: true })
}

function readManifest() {
  ensureRoot()
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { custom: [], hidden: [], updatedAt: Date.now() }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    return {
      custom: Array.isArray(raw.custom) ? raw.custom : [],
      hidden: Array.isArray(raw.hidden) ? raw.hidden : [],
      updatedAt: raw.updatedAt || Date.now(),
    }
  } catch {
    return { custom: [], hidden: [], updatedAt: Date.now() }
  }
}

function writeManifest(manifest) {
  ensureRoot()
  manifest.updatedAt = Date.now()
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
}

function levelImages(petId) {
  const images = {}
  for (let i = 0; i <= 8; i++) {
    images[i] = `/pets/${petId}/lv${i}.png`
  }
  return images
}

function scanLevels(petId) {
  const dir = path.join(PETS_ROOT, petId)
  const levels = {}
  if (!fs.existsSync(dir)) return levels
  for (let i = 0; i <= 8; i++) {
    const fp = path.join(dir, `lv${i}.png`)
    if (fs.existsSync(fp)) {
      const st = fs.statSync(fp)
      levels[i] = { exists: true, size: st.size, mtime: st.mtimeMs }
    } else {
      levels[i] = { exists: false }
    }
  }
  return levels
}

/** 至少有一张等级图才算可领养 */
export function hasPetAssets(petId) {
  const dir = path.join(PETS_ROOT, petId)
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false
  for (let i = 0; i <= 8; i++) {
    if (fs.existsSync(path.join(dir, `lv${i}.png`))) return true
  }
  return false
}

/** 某等级图不存在时，回退到最近有图的等级路径 */
export function resolvePetImagePath(petId, level) {
  const lv = Math.max(0, Math.min(8, Number(level) || 0))
  const preferred = path.join(PETS_ROOT, petId, `lv${lv}.png`)
  if (fs.existsSync(preferred)) return `/pets/${petId}/lv${lv}.png`
  for (const i of [1, lv, 2, 3, 4, 5, 6, 7, 8, 0]) {
    if (fs.existsSync(path.join(PETS_ROOT, petId, `lv${i}.png`))) {
      return `/pets/${petId}/lv${i}.png`
    }
  }
  return `/pets/${petId}/lv${lv}.png`
}

function petPayload(meta, builtin) {
  const id = meta.id
  return {
    id,
    name: meta.name,
    category: meta.category === 'mythical' ? 'mythical' : 'normal',
    builtin: !!builtin,
    image: resolvePetImagePath(id, 1),
    levelImages: levelImages(id),
    levels: scanLevels(id),
  }
}

/** 对外图鉴列表（隐藏的不返回；无图片资源的不返回，避免前端全变 🐕） */
export function listPetsCatalog() {
  const manifest = readManifest()
  const hidden = new Set(manifest.hidden)
  const byId = new Map()

  for (const p of BUILTIN_PETS) {
    if (hidden.has(p.id)) continue
    if (!hasPetAssets(p.id)) continue
    byId.set(p.id, petPayload(p, true))
  }
  // 「我的宠物」九级图鉴（优先展示，覆盖同 id）
  for (const p of loadMyPetsCatalog()) {
    if (!p?.id || hidden.has(p.id)) continue
    if (!hasPetAssets(p.id)) continue
    byId.set(p.id, petPayload(p, false))
  }
  for (const p of manifest.custom) {
    if (!p?.id || hidden.has(p.id)) continue
    if (!hasPetAssets(p.id)) continue
    byId.set(p.id, petPayload(p, false))
  }

  // 磁盘上有目录但未登记的，也列为自定义
  ensureRoot()
  for (const name of fs.readdirSync(PETS_ROOT)) {
    if (name === 'manifest.json') continue
    const full = path.join(PETS_ROOT, name)
    if (!fs.statSync(full).isDirectory()) continue
    if (hidden.has(name) || byId.has(name)) continue
    if (!hasPetAssets(name)) continue
    byId.set(name, petPayload({ id: name, name, category: 'normal' }, false))
  }

  return [...byId.values()].sort((a, b) => {
    if (a.category !== b.category) return a.category === 'normal' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh')
  })
}

/**
 * 把学生/小组上「没有图片」的 pet_type 改成现有图鉴里的随机一只。
 * 返回修复条数。
 */
export function repairOrphanPetAssignments(database) {
  if (!database) return { students: 0, groups: 0 }
  const valid = listPetsCatalog().map((p) => p.id)
  if (!valid.length) return { students: 0, groups: 0 }

  let studentsFixed = 0
  let groupsFixed = 0
  const pick = () => valid[Math.floor(Math.random() * valid.length)]

  try {
    const rows = database.prepare(
      'SELECT id, pet_type, pet_level FROM students WHERE pet_type IS NOT NULL'
    ).all()
    const upd = database.prepare('UPDATE students SET pet_type = ? WHERE id = ?')
    for (const r of rows) {
      if (!r.pet_type || hasPetAssets(r.pet_type)) continue
      upd.run(pick(), r.id)
      studentsFixed++
    }
  } catch (e) {
    console.warn('[pets] repair students failed:', e?.message || e)
  }

  try {
    const rows = database.prepare(
      'SELECT id, pet_type FROM student_groups WHERE pet_type IS NOT NULL'
    ).all()
    const upd = database.prepare('UPDATE student_groups SET pet_type = ? WHERE id = ?')
    for (const r of rows) {
      if (!r.pet_type || hasPetAssets(r.pet_type)) continue
      upd.run(pick(), r.id)
      groupsFixed++
    }
  } catch (e) {
    console.warn('[pets] repair groups failed:', e?.message || e)
  }

  if (studentsFixed || groupsFixed) {
    console.log(`[pets] 已修复无图宠物：学生 ${studentsFixed}，小组 ${groupsFixed}`)
  }
  return { students: studentsFixed, groups: groupsFixed }
}

/** 管理端列表：含已隐藏项（marked hidden） */
export function listPetsAdmin() {
  const manifest = readManifest()
  const hidden = new Set(manifest.hidden)
  const catalog = listPetsCatalog()
  const extras = []
  for (const id of hidden) {
    const builtin = BUILTIN_PETS.find((p) => p.id === id)
    const custom = manifest.custom.find((p) => p.id === id)
    const meta = builtin || custom || { id, name: id, category: 'normal' }
    extras.push({ ...petPayload(meta, !!builtin), hidden: true })
  }
  return [...catalog.map((p) => ({ ...p, hidden: false })), ...extras]
}

function decodeImageBase64(input) {
  if (!input || typeof input !== 'string') return null
  let s = input.trim()
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,/i.exec(s)
  if (m) s = s.slice(m[0].length)
  const buf = Buffer.from(s, 'base64')
  if (buf.length < 32) return null
  return buf
}

function writeLevelFile(petId, level, buffer) {
  const dir = path.join(PETS_ROOT, petId)
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `lv${level}.png`)
  fs.writeFileSync(dest, buffer)
  // 同步到 dist（若存在）
  try {
    const distDir = path.join(DIST_PETS, petId)
    if (fs.existsSync(path.dirname(DIST_PETS))) {
      fs.mkdirSync(distDir, { recursive: true })
      fs.writeFileSync(path.join(distDir, `lv${level}.png`), buffer)
    }
  } catch {
    /* ignore */
  }
  return dest
}

function removeDirRecursive(dir) {
  if (!fs.existsSync(dir)) return
  fs.rmSync(dir, { recursive: true, force: true })
}

/**
 * 创建或更新宠物元数据，并写入等级图片
 * images: { "1": base64, ... }
 */
export function upsertPet({ id, name, category, images }) {
  if (!isValidPetId(id)) {
    const err = new Error('宠物 ID 仅允许小写字母、数字、连字符，且以字母开头')
    err.status = 400
    throw err
  }
  if (!name || !String(name).trim()) {
    const err = new Error('请填写宠物名称')
    err.status = 400
    throw err
  }

  const manifest = readManifest()
  manifest.hidden = manifest.hidden.filter((x) => x !== id)

  const builtin = BUILTIN_PETS.find((p) => p.id === id)
  const meta = {
    id,
    name: String(name).trim(),
    category: category === 'mythical' ? 'mythical' : 'normal',
  }

  if (!builtin) {
    const idx = manifest.custom.findIndex((p) => p.id === id)
    if (idx >= 0) manifest.custom[idx] = meta
    else manifest.custom.push(meta)
  }

  const written = []
  if (images && typeof images === 'object') {
    for (const [k, v] of Object.entries(images)) {
      const level = Number(k)
      if (!Number.isInteger(level) || level < 0 || level > 8) continue
      const buf = decodeImageBase64(v)
      if (!buf) continue
      writeLevelFile(id, level, buf)
      written.push(level)
    }
  }

  writeManifest(manifest)
  return { pet: petPayload(meta, !!builtin), written }
}

export function updatePetMeta(id, { name, category }) {
  const manifest = readManifest()
  const builtin = BUILTIN_PETS.find((p) => p.id === id)
  if (builtin) {
    // 内置宠：用 custom 覆盖显示名（同 id 优先 custom）
    const meta = {
      id,
      name: (name && String(name).trim()) || builtin.name,
      category: category === 'mythical' ? 'mythical' : category === 'normal' ? 'normal' : builtin.category,
    }
    const idx = manifest.custom.findIndex((p) => p.id === id)
    if (idx >= 0) manifest.custom[idx] = meta
    else manifest.custom.push(meta)
    writeManifest(manifest)
    return petPayload(meta, true)
  }
  const idx = manifest.custom.findIndex((p) => p.id === id)
  if (idx < 0) {
    const err = new Error('宠物不存在')
    err.status = 404
    throw err
  }
  if (name) manifest.custom[idx].name = String(name).trim()
  if (category) manifest.custom[idx].category = category === 'mythical' ? 'mythical' : 'normal'
  writeManifest(manifest)
  return petPayload(manifest.custom[idx], false)
}

export function uploadPetLevel(id, level, base64) {
  const lv = Number(level)
  if (!Number.isInteger(lv) || lv < 0 || lv > 8) {
    const err = new Error('等级须为 0–8（0=蛋）')
    err.status = 400
    throw err
  }
  const dir = path.join(PETS_ROOT, id)
  const known =
    BUILTIN_PETS.some((p) => p.id === id) ||
    readManifest().custom.some((p) => p.id === id) ||
    fs.existsSync(dir)
  if (!known) {
    const err = new Error('宠物不存在，请先创建')
    err.status = 404
    throw err
  }
  const buf = decodeImageBase64(base64)
  if (!buf) {
    const err = new Error('无效的图片数据')
    err.status = 400
    throw err
  }
  writeLevelFile(id, lv, buf)
  return { id, level: lv, path: `/pets/${id}/lv${lv}.png` }
}

export function deletePetLevel(id, level) {
  const lv = Number(level)
  const fp = path.join(PETS_ROOT, id, `lv${lv}.png`)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  try {
    const df = path.join(DIST_PETS, id, `lv${lv}.png`)
    if (fs.existsSync(df)) fs.unlinkSync(df)
  } catch {
    /* ignore */
  }
  return { success: true }
}

/**
 * 删除宠物：移除目录；内置宠记入 hidden；自定义从 manifest 移除
 */
export function deletePet(id) {
  if (!id) {
    const err = new Error('缺少宠物 ID')
    err.status = 400
    throw err
  }
  const manifest = readManifest()
  const builtin = BUILTIN_PETS.some((p) => p.id === id)

  removeDirRecursive(path.join(PETS_ROOT, id))
  try {
    removeDirRecursive(path.join(DIST_PETS, id))
  } catch {
    /* ignore */
  }

  manifest.custom = manifest.custom.filter((p) => p.id !== id)
  if (builtin) {
    if (!manifest.hidden.includes(id)) manifest.hidden.push(id)
  } else {
    manifest.hidden = manifest.hidden.filter((x) => x !== id)
  }
  writeManifest(manifest)
  return { success: true, id }
}

export function restorePet(id) {
  const manifest = readManifest()
  manifest.hidden = manifest.hidden.filter((x) => x !== id)
  writeManifest(manifest)
  return { success: true }
}
