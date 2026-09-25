# 重构方案：状态管理与代码复用

## 问题诊断

### 1. 学生数据分散
- `Home.vue`、`Students.vue`、`Ranking.vue` 各自维护 `students` ref
- 各自调用 API 加载，代码重复
- 数据不同步，靠 localStorage hack 通信

### 2. localStorage hack
```ts
// 数据变更时写入时间戳
localStorage.setItem('pet-garden-data-version', Date.now().toString())

// 其他页面轮询检查
const currentVersion = getDataVersion()
if (currentVersion > lastDataVersion.value) {
  loadStudents()
}
```
这是 workaround，说明状态管理有问题。

### 3. Home.vue 职责过多
- 学生数据加载
- 评价逻辑（单个/批量）
- 7 个 Modal 状态管理
- 标签过滤、排序逻辑
- 批量操作模式

### 4. 重复代码
- `getPinyinInitials`、`getPinyinFull` 在多个文件重复
- `loadStudents()` 逻辑在多处重复
- `currentClass` watch 逻辑重复

---

## 重构目标

1. **统一学生状态**：创建 `useStudents` composable，单例模式
2. **统一标签状态**：创建 `useTags` composable
3. **移除 localStorage hack**：状态共享后不再需要
4. **提取公共工具**：拼音函数、搜索过滤逻辑
5. **拆分 Home.vue**：Modal 逻辑独立、评价逻辑独立

---

## 重构步骤

### Phase 1: 基础设施（不影响现有代码）

#### 1.1 提取拼音工具函数
**文件**: `src/utils/pinyin.ts`

```ts
import { pinyin } from 'pinyin-pro'

export function getPinyinInitials(text: string): string {
  return pinyin(text, { pattern: 'first', toneType: 'none' })
    .replace(/\s/g, '')
    .toLowerCase()
}

export function getPinyinFull(text: string): string {
  return pinyin(text, { toneType: 'none' })
    .replace(/\s/g, '')
    .toLowerCase()
}

export function matchByPinyin(text: string, query: string): boolean {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  return (
    lowerText.includes(lowerQuery) ||
    getPinyinInitials(text).includes(lowerQuery) ||
    getPinyinFull(text).includes(lowerQuery)
  )
}
```

#### 1.2 创建 useStudents composable
**文件**: `src/composables/useStudents.ts`

```ts
import { ref, watch } from 'vue'
import type { Student } from '@/types'
import { useAuth } from './useAuth'
import { useClasses } from './useClasses'

// 单例状态
const students = ref<Student[]>([])
const isLoading = ref(false)

export function useStudents() {
  const { api } = useAuth()
  const { currentClass } = useClasses()

  async function loadStudents() {
    if (!currentClass.value) {
      students.value = []
      return
    }
    isLoading.value = true
    try {
      const res = await api.get(`/classes/${currentClass.value.id}/students`)
      students.value = res.data.students
    } catch (error) {
      console.error('加载学生失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function addStudent(name: string, studentNo?: string) {
    if (!currentClass.value) return
    await api.post('/students', {
      classId: currentClass.value.id,
      name: name.trim(),
      studentNo: studentNo?.trim() || null
    })
    await loadStudents()
  }

  async function deleteStudent(id: string) {
    await api.delete(`/students/${id}`)
    await loadStudents()
  }

  async function batchDelete(ids: string[]) {
    await api.post('/students/batch-delete', { ids })
    await loadStudents()
  }

  // 监听班级变化自动加载
  watch(currentClass, (cls) => {
    if (cls) loadStudents()
    else students.value = []
  })

  return {
    students,
    isLoading,
    loadStudents,
    addStudent,
    deleteStudent,
    batchDelete
  }
}
```

#### 1.3 创建 useTags composable
**文件**: `src/composables/useTags.ts`

```ts
import { ref } from 'vue'
import type { Tag } from '@/types'
import { useAuth } from './useAuth'

const allTags = ref<Tag[]>([])
const studentTags = ref<Map<string, Tag[]>>(new Map())

export function useTags() {
  const { api } = useAuth()

  async function loadTags() {
    try {
      const res = await api.get('/tags')
      allTags.value = res.data.tags
    } catch (error) {
      console.error('加载标签失败:', error)
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

  async function addTagsToStudents(studentIds: string[], tagId: string) {
    await api.post('/tags/batch-add', { studentIds, tagId })
    for (const id of studentIds) await loadStudentTags(id)
  }

  async function removeTagsFromStudents(studentIds: string[], tagId: string) {
    await api.post('/tags/batch-remove', { studentIds, tagId })
    for (const id of studentIds) await loadStudentTags(id)
  }

  return {
    allTags,
    studentTags,
    loadTags,
    loadStudentTags,
    addTagsToStudents,
    removeTagsFromStudents
  }
}
```

---

### Phase 2: 迁移页面（逐步替换）

#### 2.1 迁移 Ranking.vue（最简单，只读）
- 移除本地 `students` ref
- 使用 `useStudents()` 获取共享状态
- 移除 `loadStudents()` 定义
- 移除 `watch(currentClass)`

#### 2.2 迁移 Students.vue
- 使用 `useStudents()` 和 `useTags()`
- 移除重复的数据加载逻辑
- 保留页面特有的编辑状态（editName, editStudentNo 等）

#### 2.3 迁移 Home.vue（最复杂）
- 使用 `useStudents()` 获取学生数据
- 移除 localStorage hack
- 保留评价相关的 Modal 和逻辑

---

### Phase 3: 清理

#### 3.1 移除 localStorage hack
- 删除 `pet-garden-data-version` 相关代码
- 删除 `getDataVersion()` 函数
- 删除 `lastDataVersion` ref

#### 3.2 移除重复代码
- 删除各页面的 `getPinyinInitials`、`getPinyinFull`
- 改用 `src/utils/pinyin.ts`

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/utils/pinyin.ts` | 新建 |
| `src/composables/useStudents.ts` | 新建（或扩展现有） |
| `src/composables/useTags.ts` | 新建 |
| `src/pages/Ranking.vue` | 修改：使用 useStudents |
| `src/pages/Students.vue` | 修改：使用 useStudents + useTags |
| `src/pages/Home.vue` | 修改：使用 useStudents，移除 localStorage hack |

---

## 风险评估

| 风险 | 影响 | 应对 |
|------|------|------|
| 状态共享导致意外更新 | 中 | 每个 composable 内部控制更新时机 |
| 班级切换时数据残留 | 低 | watch currentClass 时清空 students |
| API 调用时机变化 | 低 | 保持原有的 watch 逻辑 |

---

## 执行顺序

1. ✅ **Phase 1.1**: 创建 `src/utils/pinyin.ts`
2. ✅ **Phase 1.2**: 创建/扩展 `src/composables/useStudents.ts`
3. ✅ **Phase 1.3**: 创建 `src/composables/useTags.ts`
4. ✅ **Phase 2.1**: 迁移 `Ranking.vue`
5. ✅ **Phase 2.2**: 迁移 `Students.vue`
6. ✅ **Phase 2.3**: 迁移 `Home.vue`
7. ✅ **Phase 3**: 清理 localStorage hack 和重复代码

每一步完成后验证页面功能正常，再进行下一步。

---

## 预期收益

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| 学生数据来源 | 3 处独立 | 1 处单例 |
| localStorage hack | 有 | 无 |
| 重复代码行数 | ~100 行 | 0 |
| 修改数据同步 | 需手动通知 | 自动同步 |