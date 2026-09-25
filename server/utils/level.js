// 等级配置：从 Lv0（蛋）升到 Lv8 共 8 段经验
export const LEVEL_CONFIG = [15, 25, 35, 45, 55, 65, 75, 90]
export const MAX_PET_LEVEL = 8
export const MIN_PET_LEVEL = 0

/** 计算等级：0=蛋 … 8=满级 */
export function calculateLevel(exp) {
  let level = 0
  let total = 0
  const e = Math.max(0, Number(exp) || 0)
  for (const required of LEVEL_CONFIG) {
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
export function minExpForLevel(level) {
  const lv = Math.max(MIN_PET_LEVEL, Math.min(MAX_PET_LEVEL, Number(level) || 0))
  let total = 0
  for (let i = 0; i < lv; i++) {
    total += LEVEL_CONFIG[i] || 0
  }
  return total
}

/** 随机一个落在 [0, MAX] 的等级，并返回该级内的随机经验值 */
export function randomLevelAndExp(maxLevel = MAX_PET_LEVEL) {
  const level = Math.floor(Math.random() * (Math.min(maxLevel, MAX_PET_LEVEL) + 1))
  const base = minExpForLevel(level)
  if (level >= MAX_PET_LEVEL) return { level, exp: base }
  const span = LEVEL_CONFIG[level] || 1
  const exp = base + Math.floor(Math.random() * span)
  return { level: calculateLevel(exp), exp }
}

export function getLevelProgress(exp) {
  const level = calculateLevel(exp)
  let prevTotal = 0
  for (let i = 0; i < level; i++) {
    prevTotal += LEVEL_CONFIG[i]
  }
  const currentLevelExp = Math.max(0, (Number(exp) || 0) - prevTotal)
  const required = LEVEL_CONFIG[level] || 0
  const isMaxLevel = level >= MAX_PET_LEVEL

  return {
    level,
    current: isMaxLevel ? currentLevelExp : currentLevelExp,
    required: isMaxLevel ? currentLevelExp : required,
    percentage: isMaxLevel ? 100 : Math.min(100, required ? (currentLevelExp / required) * 100 : 0),
    isMaxLevel
  }
}
