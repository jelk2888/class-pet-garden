import { Router } from 'express'
import {
  listPetsCatalog,
  listPetsAdmin,
  upsertPet,
  updatePetMeta,
  uploadPetLevel,
  deletePetLevel,
  deletePet,
  restorePet,
} from '../services/petsStore.js'

const router = Router()

/** 公开：前端图鉴 */
router.get('/', (req, res) => {
  res.json({ pets: listPetsCatalog() })
})

export function registerAdminPetRoutes(router, authMiddleware, adminMiddleware) {
  router.get('/pets', authMiddleware, adminMiddleware, (req, res) => {
    res.json({ pets: listPetsAdmin() })
  })

  router.post('/pets', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const result = upsertPet(req.body || {})
      res.json({ success: true, ...result })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '创建失败' })
    }
  })

  router.put('/pets/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const pet = updatePetMeta(req.params.id, req.body || {})
      res.json({ success: true, pet })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '更新失败' })
    }
  })

  router.put('/pets/:id/levels/:level', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { image } = req.body || {}
      const result = uploadPetLevel(req.params.id, req.params.level, image)
      res.json({ success: true, ...result })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '上传失败' })
    }
  })

  router.delete('/pets/:id/levels/:level', authMiddleware, adminMiddleware, (req, res) => {
    try {
      deletePetLevel(req.params.id, req.params.level)
      res.json({ success: true })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '删除失败' })
    }
  })

  router.delete('/pets/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const result = deletePet(req.params.id)
      res.json(result)
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '删除失败' })
    }
  })

  router.post('/pets/:id/restore', authMiddleware, adminMiddleware, (req, res) => {
    try {
      restorePet(req.params.id)
      res.json({ success: true })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || '恢复失败' })
    }
  })
}

export default router
