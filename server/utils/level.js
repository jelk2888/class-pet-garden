import { db } from '../db.js'

// 等级配置：从 Lv0（蛋）升到 Lv8 共 8 段经验（默认）
export const LEVEL_CONFIG = [15, 25, 35, 45, 55, 65, 75, 90]
export const MAX_PET_LEVEL = 8
export const MIN_PET_LEVEL = 0

/** 规范化 8 段经验数组 */
export function normalizeLevelConfig(input) {
  const fallback = [...LEVEL_CONFIG]
  if (!Array.isArray(input) || input.length < 8) return fallback
  return input.slice(0, 8).map((n, i) => {
    const v = Math.round(Number(n))
    return Number.isFinite(v) && v >= 1 ? Math.min(9999, v) : fallback[i]
  })
}

/** 读取班级等级配置（无则用默认） */
export function getLevelConfigForClass(classId) {
  if (!classId) return [...LEVEL_CONFIG]
  try {
    const row = db.prepare('SELECT level_config FROM classes WHERE id = ?').get(classId)
    if (row?.level_config) {
      return normalizeLevelConfig(JSON.parse(row.level_config))
    }
  } catch { /* ignore */ }
  return [...LEVEL_CONFIG]
}

/** 计算等级：0=蛋 … 8=满级；config 可传班级配置 */
export function calculateLevel(exp, config = LEVEL_CONFIG) {
  const cfg = normalizeLevelConfig(config)
  let level = 0
  let total = 0
  const e = Math.max(0, Number(exp) || 0)
  for (const required of cfg) {
    total += required
    if (e >= total) {
      level++
    } else {
      break
    }
  }
  return Math.min(level, MAX_PET_LEVEL)
}

/** 升到指定等级所需的最低总经验 */
export function minExpForLevel(level, config = LEVEL_CONFIG) {
  const cfg = normalizeLevelConfig(config)
  const lv = Math.max(MIN_PET_LEVEL, Math.min(MAX_PET_LEVEL, Number(level) || 0))
  let total = 0
  for (let i = 0; i < lv; i++) {
    total += cfg[i] || 0
  }
  return total
}

/** 随机一个落在 [0, MAX] 的等级，并返回该级内的随机经验值 */
export function randomLevelAndExp(maxLevel = MAX_PET_LEVEL, config = LEVEL_CONFIG) {
  const cfg = normalizeLevelConfig(config)
  const level = Math.floor(Math.random() * (Math.min(maxLevel, MAX_PET_LEVEL) + 1))
  const base = minExpForLevel(level, cfg)
  if (level >= MAX_PET_LEVEL) return { level, exp: base }
  const span = cfg[level] || 1
  const exp = base + Math.floor(Math.random() * span)
  return { level: calculateLevel(exp, cfg), exp }
}

export function getLevelProgress(exp, config = LEVEL_CONFIG) {
  const cfg = normalizeLevelConfig(config)
  const level = calculateLevel(exp, cfg)
  let prevTotal = 0
  for (let i = 0; i < level; i++) {
    prevTotal += cfg[i]
  }
  const currentLevelExp = Math.max(0, (Number(exp) || 0) - prevTotal)
  const required = cfg[level] || 0
  const isMaxLevel = level >= MAX_PET_LEVEL

  return {
    level,
    current: currentLevelExp,
    required: isMaxLevel ? currentLevelExp : required,
    percentage: isMaxLevel ? 100 : Math.min(100, required ? (currentLevelExp / required) * 100 : 0),
    isMaxLevel
  }
}

/** 按新配置重算某班全部学生等级 */
export function recalcClassLevels(classId) {
  const cfg = getLevelConfigForClass(classId)
  const students = db.prepare('SELECT id, pet_exp FROM students WHERE class_id = ?').all(classId)
  const upd = db.prepare('UPDATE students SET pet_level = ? WHERE id = ?')
  const tx = db.transaction(() => {
    for (const s of students) {
      upd.run(calculateLevel(s.pet_exp || 0, cfg), s.id)
    }
  })
  tx()
  return students.length
}
