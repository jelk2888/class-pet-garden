import { verifyToken } from '../utils/token.js'
import { db } from '../db.js'

export function authMiddleware(req, res, next) {
  let token = req.headers.authorization?.replace('Bearer ', '')

  // 处理游客模式
  if (token === 'guest') {
    const guest = db.prepare('SELECT id FROM users WHERE username = ?').get('guest')
    if (guest) {
      req.userId = guest.id
      req.isGuest = true
      return next()
    }
    return res.status(401).json({ error: '游客模式不可用' })
  }

  const payload = verifyToken(token)

  if (!payload) {
    return res.status(401).json({ error: '未登录或登录已过期' })
  }

  req.userId = payload.userId
  const user = db.prepare('SELECT is_guest FROM users WHERE id = ?').get(payload.userId)
  req.isGuest = !!(user && user.is_guest)
  next()
}

/** 正式注册用户才可执行的写操作 */
export function requireRegistered(req, res, next) {
  if (req.isGuest) {
    return res.status(403).json({ error: '游客无法执行此操作，请先注册登录' })
  }
  next()
}

export function optionalAuthMiddleware(req, res, next) {
  let token = req.headers.authorization?.replace('Bearer ', '')

  // 处理游客模式
  if (token === 'guest') {
    const guest = db.prepare('SELECT id FROM users WHERE username = ?').get('guest')
    if (guest) {
      req.userId = guest.id
    }
    return next()
  }

  const payload = verifyToken(token)

  if (payload) {
    req.userId = payload.userId
  }

  next()
}
