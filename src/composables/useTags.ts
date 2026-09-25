import { ref } from 'vue'
import type { Tag } from '@/types'
import { useAuth } from './useAuth'

// ============ 单例状态（模块级别） ============
const allTags = ref<Tag[]>([])
const studentTags = ref<Map<string, Tag[]>>(new Map())

// ============ Composable ============
export function useTags() {
  const { api } = useAuth()

  // ---------- 加载标签 ----------
  async function loadTags() {
    try {
      const res = await api.get('/tags')
      allTags.value = res.data.tags || []
    } catch (error) {
      console.error('加载标签失败:', error)
      allTags.value = []
    }
  }

  async function loadStudentTags(studentId: string) {
    try {
      const res = await api.get(`/tags/student/${studentId}`)
      studentTags.value.set(studentId, res.data.tags || [])
    } catch {
      studentTags.value.set(studentId, [])
    }
  }

  async function loadAllStudentTags(studentIds: string[]) {
    for (const id of studentIds) {
      await loadStudentTags(id)
    }
  }

  // ---------- 标签操作 ----------
  async function createTag(name: string, color: string) {
    const res = await api.post('/tags', { name, color })
    await loadTags()
    return res.data
  }

  async function updateTag(id: string, name: string, color: string) {
    await api.put(`/tags/${id}`, { name, color })
    await loadTags()
  }

  async function deleteTag(id: string) {
    await api.delete(`/tags/${id}`)
    await loadTags()
  }

  // ---------- 学生-标签关联 ----------
  async function addTagsToStudents(studentIds: string[], tagId: string) {
    if (studentIds.length === 0) return
    await api.post('/tags/batch-add', { studentIds, tagId })
    await loadAllStudentTags(studentIds)
  }

  async function removeTagsFromStudents(studentIds: string[], tagId: string) {
    if (studentIds.length === 0) return
    await api.post('/tags/batch-remove', { studentIds, tagId })
    await loadAllStudentTags(studentIds)
  }

  // ---------- 辅助函数 ----------
  function getStudentTags(studentId: string): Tag[] {
    return studentTags.value.get(studentId) || []
  }

  function isTagAppliedToStudents(studentIds: string[], tagId: string): boolean {
    if (studentIds.length === 0) return false
    return studentIds.every(id => 
      (studentTags.value.get(id) || []).some((t: Tag) => t.id === tagId)
    )
  }

  return {
    // 状态
    allTags,
    studentTags,
    
    // 加载
    loadTags,
    loadStudentTags,
    loadAllStudentTags,
    
    // 标签 CRUD
    createTag,
    updateTag,
    deleteTag,
    
    // 学生-标签关联
    addTagsToStudents,
    removeTagsFromStudents,
    
    // 辅助
    getStudentTags,
    isTagAppliedToStudents
  }
}