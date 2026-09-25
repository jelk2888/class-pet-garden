import { describe, it, expect, beforeEach } from 'vitest'
import { calculateLevel, getLevelProgress, LEVEL_CONFIG, MAX_PET_LEVEL } from '../utils/level.js'

describe('Level Utils', () => {
  describe('calculateLevel', () => {
    it('should return 0 (egg) for 0 exp', () => {
      expect(calculateLevel(0)).toBe(0)
    })

    it('should return 0 for exp less than first threshold', () => {
      expect(calculateLevel(LEVEL_CONFIG[0] - 1)).toBe(0)
    })

    it('should return 1 when exp reaches first threshold', () => {
      expect(calculateLevel(LEVEL_CONFIG[0])).toBe(1)
    })

    it('should return max for high exp', () => {
      expect(calculateLevel(10000)).toBe(MAX_PET_LEVEL)
    })
  })

  describe('getLevelProgress', () => {
    it('should return correct progress for egg level', () => {
      const half = Math.floor(LEVEL_CONFIG[0] / 2)
      const progress = getLevelProgress(half)
      expect(progress.level).toBe(0)
      expect(progress.current).toBe(half)
      expect(progress.required).toBe(LEVEL_CONFIG[0])
      expect(progress.isMaxLevel).toBe(false)
    })

    it('should return correct progress after first level-up', () => {
      const exp = LEVEL_CONFIG[0] + 5
      const progress = getLevelProgress(exp)
      expect(progress.level).toBe(1)
      expect(progress.current).toBe(5)
      expect(progress.required).toBe(LEVEL_CONFIG[1])
    })

    it('should show max level for high exp', () => {
      const progress = getLevelProgress(10000)
      expect(progress.level).toBe(MAX_PET_LEVEL)
      expect(progress.isMaxLevel).toBe(true)
      expect(progress.percentage).toBe(100)
    })
  })
})

describe('Password Utils', () => {
  let hashPassword, verifyPassword

  beforeEach(async () => {
    const mod = await import('../utils/password.js')
    hashPassword = mod.hashPassword
    verifyPassword = mod.verifyPassword
  })

  it('should hash password consistently', () => {
    const hash1 = hashPassword('test123')
    const hash2 = hashPassword('test123')
    expect(hash1).toBe(hash2)
  })

  it('should verify correct password', () => {
    const hash = hashPassword('mypassword')
    expect(verifyPassword('mypassword', hash)).toBe(true)
  })

  it('should reject wrong password', () => {
    const hash = hashPassword('mypassword')
    expect(verifyPassword('wrongpassword', hash)).toBe(false)
  })

  it('should verify old SHA256 hash', () => {
    const oldHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' // '123456'
    expect(verifyPassword('123456', oldHash)).toBe(true)
  })
})
