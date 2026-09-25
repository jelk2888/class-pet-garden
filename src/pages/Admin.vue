<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import PageLayout from '@/components/layout/PageLayout.vue'
import { refreshPetTypes } from '@/data/pets'

const { isAdmin, isGuest, api } = useAuth()
const toast = useToast()
const router = useRouter()

interface TeacherClass { id: string; name: string; student_count: number; eval_count: number }
interface Teacher { id: string; username: string; isAdmin: boolean; isGuest: boolean; createdAt: number; classCount: number; totalStudents: number; totalEvals: number; lastEvalTime: number | null; todayEvals: number; classes: TeacherClass[] }
interface Stats { teachers: number; classes: number; students: number; evaluations: number; todayEvaluations: number }
interface DailyStat { date: string; newUsers: number; newClasses: number; newStudents: number; evaluations: number }
interface AdminPetLevel { exists: boolean; size?: number; mtime?: number }
interface AdminPet {
  id: string
  name: string
  category: 'normal' | 'mythical'
  builtin?: boolean
  hidden?: boolean
  image: string
  levelImages?: Record<number, string>
  levels?: Record<number, AdminPetLevel>
}

const teachers = ref<Teacher[]>([])
const stats = ref<Stats | null>(null)
const dailyStats = ref<DailyStat[]>([])
const isLoading = ref(true)
const expandedTeacher = ref<string | null>(null)
const activeTab = ref<'teachers' | 'stats' | 'pets' | 'shop'>('teachers')

const adminPets = ref<AdminPet[]>([])
const petsLoading = ref(false)
const showPetForm = ref(false)
const petSaving = ref(false)
const petForm = ref({
  id: '',
  name: '',
  category: 'normal' as 'normal' | 'mythical',
})
const petFormFiles = ref<Record<number, File | null>>({
  1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null,
})
const petFormPreviews = ref<Record<number, string>>({})
const imgBust = ref(Date.now())
const expandedPet = ref<string | null>(null)

// 删除确认弹窗状态
const showDeleteConfirm = ref(false)
const teacherToDelete = ref<Teacher | null>(null)
const isDeleting = ref(false)
const deleteConfirmInput = ref('')

const showPetDeleteConfirm = ref(false)
const petToDelete = ref<AdminPet | null>(null)
const isDeletingPet = ref(false)

// 判断输入的用户名是否匹配
const canConfirmDelete = computed(() => deleteConfirmInput.value === teacherToDelete.value?.username)

const visiblePets = computed(() => adminPets.value.filter(p => !p.hidden))
const hiddenPets = computed(() => adminPets.value.filter(p => p.hidden))

onMounted(async () => {
  if (isGuest.value || !isAdmin.value) { toast.error('需要管理员权限'); router.push('/'); return }
  await loadData()
})

async function loadData() {
  isLoading.value = true
  try {
    const [teachersRes, statsRes] = await Promise.all([
      api.get('/admin/teachers'),
      api.get('/admin/stats')
    ])
    teachers.value = teachersRes.data.teachers
    stats.value = statsRes.data.stats
    await loadDailyStats()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '加载失败')
  } finally {
    isLoading.value = false
  }
}

async function loadAdminPets() {
  petsLoading.value = true
  try {
    const res = await api.get('/admin/pets')
    adminPets.value = res.data.pets || []
    imgBust.value = Date.now()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '加载宠物失败')
  } finally {
    petsLoading.value = false
  }
}

function openPetForm() {
  petForm.value = { id: '', name: '', category: 'normal' }
  petFormFiles.value = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null }
  petFormPreviews.value = {}
  showPetForm.value = true
}

function onPetFileChange(level: number, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] || null
  petFormFiles.value[level] = file
  if (file) {
    const reader = new FileReader()
    reader.onload = () => {
      petFormPreviews.value = { ...petFormPreviews.value, [level]: String(reader.result || '') }
    }
    reader.readAsDataURL(file)
  } else {
    const next = { ...petFormPreviews.value }
    delete next[level]
    petFormPreviews.value = next
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

async function savePet() {
  const id = petForm.value.id.trim().toLowerCase()
  const name = petForm.value.name.trim()
  if (!/^[a-z][a-z0-9-]{1,47}$/.test(id)) {
    toast.error('ID 须为小写字母开头，仅含字母/数字/连字符')
    return
  }
  if (!name) {
    toast.error('请填写名称')
    return
  }
  petSaving.value = true
  try {
    const images: Record<string, string> = {}
    for (let lv = 1; lv <= 8; lv++) {
      const f = petFormFiles.value[lv]
      if (f) images[String(lv)] = await fileToDataUrl(f)
    }
    if (Object.keys(images).length === 0) {
      toast.error('至少上传一张图片（建议含 Lv1）')
      petSaving.value = false
      return
    }
    await api.post('/admin/pets', {
      id,
      name,
      category: petForm.value.category,
      images,
    })
    toast.success('宠物已保存')
    showPetForm.value = false
    await loadAdminPets()
    await refreshPetTypes(async (url) => (await api.get(url)).data)
  } catch (e: any) {
    toast.error(e.response?.data?.error || '保存失败')
  } finally {
    petSaving.value = false
  }
}

async function replacePetLevel(pet: AdminPet, level: number, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const image = await fileToDataUrl(file)
    await api.put(`/admin/pets/${pet.id}/levels/${level}`, { image })
    toast.success(`已更新 ${pet.name} Lv${level}`)
    await loadAdminPets()
    await refreshPetTypes(async (url) => (await api.get(url)).data)
  } catch (err: any) {
    toast.error(err.response?.data?.error || '上传失败')
  } finally {
    input.value = ''
  }
}

function confirmDeletePet(pet: AdminPet) {
  petToDelete.value = pet
  showPetDeleteConfirm.value = true
}

async function executeDeletePet() {
  if (!petToDelete.value) return
  isDeletingPet.value = true
  try {
    await api.delete(`/admin/pets/${petToDelete.value.id}`)
    toast.success(`已删除宠物 ${petToDelete.value.name}`)
    showPetDeleteConfirm.value = false
    petToDelete.value = null
    await loadAdminPets()
    await refreshPetTypes(async (url) => (await api.get(url)).data)
  } catch (e: any) {
    toast.error(e.response?.data?.error || '删除失败')
  } finally {
    isDeletingPet.value = false
  }
}

async function restoreHiddenPet(pet: AdminPet) {
  try {
    await api.post(`/admin/pets/${pet.id}/restore`)
    toast.success(`已恢复 ${pet.name}`)
    await loadAdminPets()
    await refreshPetTypes(async (url) => (await api.get(url)).data)
  } catch (e: any) {
    toast.error(e.response?.data?.error || '恢复失败')
  }
}

function petThumb(pet: AdminPet, level = 1) {
  return `/pets/${pet.id}/lv${level}.png?t=${imgBust.value}`
}

function switchToPets() {
  activeTab.value = 'pets'
  if (!adminPets.value.length) loadAdminPets()
}

// —— 积分商城目录 ——
interface CatalogItem {
  id: string
  name: string
  description: string
  cost: number
  stock: number
  emoji: string
  category: string
  source: string
  enabled: number
}
interface CatalogSource { id: string; name: string }

const catalogItems = ref<CatalogItem[]>([])
const catalogSources = ref<CatalogSource[]>([])
const catalogStats = ref<{ total: number; enabled: number; disabled: number; bySource: Record<string, number> } | null>(null)
const catalogLoading = ref(false)
const catalogFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const catalogSourceFilter = ref('all')
const showCatalogForm = ref(false)
const catalogSaving = ref(false)
const editingCatalog = ref<CatalogItem | null>(null)
const catalogForm = ref({
  name: '',
  description: '',
  cost: 10,
  stock: -1,
  emoji: '🎁',
  category: '其他',
  source: 'custom',
  enabled: 1 as number,
})
const showCatalogDelete = ref(false)
const catalogToDelete = ref<CatalogItem | null>(null)

const filteredCatalog = computed(() => {
  return catalogItems.value.filter((i) => {
    if (catalogFilter.value === 'enabled' && !i.enabled) return false
    if (catalogFilter.value === 'disabled' && i.enabled) return false
    if (catalogSourceFilter.value !== 'all' && i.source !== catalogSourceFilter.value) return false
    return true
  })
})

function sourceLabel(id: string) {
  return catalogSources.value.find((s) => s.id === id)?.name || id
}

async function loadShopCatalog() {
  catalogLoading.value = true
  try {
    const res = await api.get('/admin/shop-catalog')
    catalogItems.value = res.data.items || []
    catalogSources.value = res.data.sources || []
    catalogStats.value = res.data.stats || null
  } catch (e: any) {
    toast.error(e.response?.data?.error || '加载商城目录失败')
  } finally {
    catalogLoading.value = false
  }
}

function switchToShop() {
  activeTab.value = 'shop'
  if (!catalogItems.value.length) loadShopCatalog()
}

function openCatalogCreate() {
  editingCatalog.value = null
  catalogForm.value = { name: '', description: '', cost: 10, stock: -1, emoji: '🎁', category: '其他', source: 'custom', enabled: 1 }
  showCatalogForm.value = true
}

function openCatalogEdit(item: CatalogItem) {
  editingCatalog.value = item
  catalogForm.value = {
    name: item.name,
    description: item.description || '',
    cost: item.cost,
    stock: item.stock,
    emoji: item.emoji || '🎁',
    category: item.category || '其他',
    source: item.source || 'custom',
    enabled: item.enabled ? 1 : 0,
  }
  showCatalogForm.value = true
}

async function saveCatalogItem() {
  if (!catalogForm.value.name.trim()) {
    toast.error('请填写名称')
    return
  }
  catalogSaving.value = true
  try {
    if (editingCatalog.value) {
      await api.put(`/admin/shop-catalog/${editingCatalog.value.id}`, catalogForm.value)
      toast.success('已更新')
    } else {
      await api.post('/admin/shop-catalog', catalogForm.value)
      toast.success('已添加')
    }
    showCatalogForm.value = false
    await loadShopCatalog()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '保存失败')
  } finally {
    catalogSaving.value = false
  }
}

async function toggleCatalogEnabled(item: CatalogItem) {
  try {
    await api.put(`/admin/shop-catalog/${item.id}/enabled`, { enabled: !item.enabled })
    await loadShopCatalog()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '操作失败')
  }
}

function confirmDeleteCatalog(item: CatalogItem) {
  catalogToDelete.value = item
  showCatalogDelete.value = true
}

async function executeDeleteCatalog() {
  if (!catalogToDelete.value) return
  try {
    await api.delete(`/admin/shop-catalog/${catalogToDelete.value.id}`)
    toast.success('已删除')
    showCatalogDelete.value = false
    catalogToDelete.value = null
    await loadShopCatalog()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '删除失败')
  }
}

async function seedShopCatalog(mode: 'merge' | 'replace') {
  const msg = mode === 'replace' ? '将用三站默认目录覆盖全部商品，确定？' : '将合并导入三站默认商品（跳过已有 ID），确定？'
  if (!confirm(msg)) return
  try {
    const res = await api.post('/admin/shop-catalog/seed', { mode })
    toast.success(mode === 'replace' ? `已重置 ${res.data.total} 条` : `新合并 ${res.data.added} 条（共 ${res.data.total}）`)
    catalogItems.value = res.data.items || []
    await loadShopCatalog()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '导入失败')
  }
}

async function loadDailyStats() {
  if (dailyStats.value.length > 0) return // 已经加载过
  try {
    const res = await api.get('/admin/daily-stats')
    dailyStats.value = res.data.dailyStats
  } catch (e: any) {
    console.error('加载统计数据失败', e)
  }
}

function toggleTeacher(id: string) { expandedTeacher.value = expandedTeacher.value === id ? null : id }
function formatDate(timestamp: number) { return new Date(timestamp).toLocaleDateString('zh-CN') }
function formatShortDate(date: string) { return date.slice(5) }

// 判断是否超过15天没有评价（综合考虑注册时间）
function isInactive(teacher: Teacher): boolean {
  const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000
  const now = Date.now()
  
  if (teacher.lastEvalTime) {
    // 有评价记录，判断最后一次评价是否超过15天
    return now - teacher.lastEvalTime > fifteenDaysMs
  } else {
    // 从未评价，判断注册时间是否超过15天
    return now - teacher.createdAt > fifteenDaysMs
  }
}

const totalStudents = computed(() => teachers.value.reduce((sum, t) => sum + t.totalStudents, 0))
const totalEvals = computed(() => teachers.value.reduce((sum, t) => sum + t.totalEvals, 0))

// 计算最大值用于图表
const maxEvals = computed(() => Math.max(...dailyStats.value.map(d => d.evaluations), 1))
const maxNewStudents = computed(() => Math.max(...dailyStats.value.map(d => d.newStudents), 1))
const maxNewUsers = computed(() => Math.max(...dailyStats.value.map(d => d.newUsers), 1))
const maxNewClasses = computed(() => Math.max(...dailyStats.value.map(d => d.newClasses), 1))

// 周汇总
const weekTotal = computed(() => ({
  newUsers: dailyStats.value.reduce((sum, d) => sum + d.newUsers, 0),
  newClasses: dailyStats.value.reduce((sum, d) => sum + d.newClasses, 0),
  newStudents: dailyStats.value.reduce((sum, d) => sum + d.newStudents, 0),
  evaluations: dailyStats.value.reduce((sum, d) => sum + d.evaluations, 0)
}))

// 折线图路径生成
const chartHeight = 60
const paddingY = 10
const defaultWidth = 300

function generateLinePath(data: number[], max: number): string {
  if (data.length === 0) return ''
  const stepX = defaultWidth / data.length
  const points = data.map((val, i) => {
    const x = (i + 0.5) * stepX  // 在 flex 子元素中心
    const y = chartHeight - paddingY - (val / Math.max(max, 1)) * (chartHeight - paddingY * 2)
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
}

function generateAreaPath(data: number[], max: number): string {
  if (data.length === 0) return ''
  const stepX = defaultWidth / data.length
  const linePath = generateLinePath(data, max)
  const firstX = 0.5 * stepX
  const lastX = (data.length - 0.5) * stepX
  return `${linePath} L ${lastX},${chartHeight - paddingY} L ${firstX},${chartHeight - paddingY} Z`
}

// 删除相关
function confirmDelete(teacher: Teacher) {
  teacherToDelete.value = teacher
  deleteConfirmInput.value = ''
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  teacherToDelete.value = null
  deleteConfirmInput.value = ''
}

async function executeDelete() {
  if (!teacherToDelete.value) return
  
  isDeleting.value = true
  try {
    await api.delete(`/admin/users/${teacherToDelete.value.id}`)
    toast.success(`已删除用户 ${teacherToDelete.value.username}`)
    teachers.value = teachers.value.filter(t => t.id !== teacherToDelete.value!.id)
    showDeleteConfirm.value = false
    teacherToDelete.value = null
  } catch (e: any) {
    toast.error(e.response?.data?.error || '删除失败')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <PageLayout>
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-orange-400 border-t-transparent"></div>
    </div>
    
    <div v-else class="max-w-4xl mx-auto space-y-6 w-full">
      <!-- 概览卡片 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-orange-500">{{ stats?.teachers || 0 }}</div>
          <div class="text-sm text-gray-500">老师数</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-blue-500">{{ stats?.classes || 0 }}</div>
          <div class="text-sm text-gray-500">班级数</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-green-500">{{ stats?.students || 0 }}</div>
          <div class="text-sm text-gray-500">学生数</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-purple-500">{{ stats?.evaluations || 0 }}</div>
          <div class="text-sm text-gray-500">评价数</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-rose-500">{{ stats?.todayEvaluations || 0 }}</div>
          <div class="text-sm text-gray-500">今日评价</div>
        </div>
      </div>

      <!-- 页签切换 -->
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <div class="flex border-b border-gray-100">
          <button 
            @click="activeTab = 'teachers'"
            class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'teachers' ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50' : 'text-gray-500 hover:text-gray-700'"
          >
            👨‍🏫 老师列表
          </button>
          <button 
            @click="activeTab = 'stats'; loadDailyStats()"
            class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'stats' ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50' : 'text-gray-500 hover:text-gray-700'"
          >
            📊 近7天数据
          </button>
          <button 
            @click="switchToPets()"
            class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'pets' ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50' : 'text-gray-500 hover:text-gray-700'"
          >
            🐾 宠物图鉴
          </button>
          <button 
            @click="switchToShop()"
            class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'shop' ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50' : 'text-gray-500 hover:text-gray-700'"
          >
            🛒 积分商城
          </button>
        </div>

        <!-- 老师列表 -->
        <div v-if="activeTab === 'teachers'">
          <div v-if="teachers.length === 0" class="p-8 text-center text-gray-400">暂无老师数据</div>
          <div v-else class="divide-y divide-gray-100">
            <div v-for="teacher in teachers" :key="teacher.id" class="hover:bg-gray-50" :class="isInactive(teacher) && !teacher.isAdmin && !teacher.isGuest ? 'bg-red-50/30' : ''">
              <div class="p-4 flex items-center justify-between cursor-pointer" @click="toggleTeacher(teacher.id)">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
                    {{ teacher.username.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="font-medium text-gray-800 flex items-center gap-2">
                      {{ teacher.username }}
                      <span v-if="teacher.isAdmin" class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">管理员</span>
                      <span v-if="teacher.isGuest" class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">游客</span>
                      <span v-if="isInactive(teacher) && !teacher.isAdmin && !teacher.isGuest" class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠️ 不活跃</span>
                      <button 
                        v-if="!teacher.isAdmin && !teacher.isGuest"
                        @click.stop="confirmDelete(teacher)"
                        class="ml-1 px-2 py-0.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除用户"
                      >
                        删除
                      </button>
                    </div>
                    <div class="text-sm flex items-center gap-2 text-gray-500">
                      注册于 {{ formatDate(teacher.createdAt) }}
                      <span class="text-gray-400">|</span>
                      <span :class="isInactive(teacher) ? 'text-red-500 font-medium' : 'text-gray-500'">
                        {{ teacher.lastEvalTime ? '最后评价于 ' + formatDate(teacher.lastEvalTime) : '从未评价' }}
                        <span v-if="teacher.todayEvals > 0" class="text-orange-500 font-medium ml-1">
                          (今日 {{ teacher.todayEvals }} 次)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-sm">
                  <div class="text-center"><div class="font-bold text-blue-500">{{ teacher.classCount }}</div><div class="text-gray-400">班级</div></div>
                  <div class="text-center"><div class="font-bold text-green-500">{{ teacher.totalStudents }}</div><div class="text-gray-400">学生</div></div>
                  <div class="text-center"><div class="font-bold text-purple-500">{{ teacher.totalEvals }}</div><div class="text-gray-400">评价</div></div>
                  <div class="text-gray-400 pl-2">
                    <span class="inline-block transition-transform duration-200" :class="expandedTeacher === teacher.id ? 'rotate-180' : ''">▼</span>
                  </div>
                </div>
              </div>
              <Transition name="expand">
                <div v-if="expandedTeacher === teacher.id && teacher.classes.length > 0" class="bg-gray-50 px-4 pb-4">
                  <div class="pt-2 space-y-2">
                    <div v-for="cls in teacher.classes" :key="cls.id" class="bg-white rounded-lg p-3 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-lg">📚</span>
                        <span class="font-medium text-gray-700">{{ cls.name }}</span>
                      </div>
                      <div class="flex items-center gap-4 text-sm">
                        <span class="text-green-600">{{ cls.student_count }} 人</span>
                        <span class="text-purple-600">{{ cls.eval_count }} 条评价</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- 近7天数据 -->
        <div v-else-if="activeTab === 'stats'" class="p-4">
          <!-- 周汇总 -->
          <div class="grid grid-cols-4 gap-3 mb-6">
            <div class="bg-orange-50 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-orange-600">+{{ weekTotal.newUsers }}</div>
              <div class="text-xs text-gray-500">新用户</div>
            </div>
            <div class="bg-blue-50 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-blue-600">+{{ weekTotal.newClasses }}</div>
              <div class="text-xs text-gray-500">新班级</div>
            </div>
            <div class="bg-green-50 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-green-600">+{{ weekTotal.newStudents }}</div>
              <div class="text-xs text-gray-500">新学生</div>
            </div>
            <div class="bg-purple-50 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-purple-600">{{ weekTotal.evaluations }}</div>
              <div class="text-xs text-gray-500">评价数</div>
            </div>
          </div>

          <!-- 折线图 -->
          <div class="space-y-4">
            <!-- 新用户 -->
            <div class="bg-gray-50 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-700">🆕 新用户</h4>
                <span class="text-xs text-orange-600 font-medium">+{{ weekTotal.newUsers }}</span>
              </div>
              <svg viewBox="0 0 300 60" class="w-full h-16" preserveAspectRatio="none">
                <defs><linearGradient id="orangeGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f97316" /><stop offset="100%" stop-color="#f97316" stop-opacity="0" /></linearGradient></defs>
                <path :d="generateAreaPath(dailyStats.map(d => d.newUsers), Math.max(maxNewUsers, 1))" fill="url(#orangeGradient)" opacity="0.3" />
                <path :d="generateLinePath(dailyStats.map(d => d.newUsers), Math.max(maxNewUsers, 1))" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div class="flex justify-between mt-1">
                <div v-for="day in dailyStats" :key="day.date" class="text-center flex-1">
                  <div class="text-xs font-medium text-orange-600">{{ day.newUsers || '-' }}</div>
                  <div class="text-xs text-gray-400">{{ formatShortDate(day.date) }}</div>
                </div>
              </div>
            </div>

            <!-- 新班级 -->
            <div class="bg-gray-50 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-700">📚 新班级</h4>
                <span class="text-xs text-blue-600 font-medium">+{{ weekTotal.newClasses }}</span>
              </div>
              <svg viewBox="0 0 300 60" class="w-full h-16" preserveAspectRatio="none">
                <defs><linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#3b82f6" /><stop offset="100%" stop-color="#3b82f6" stop-opacity="0" /></linearGradient></defs>
                <path :d="generateAreaPath(dailyStats.map(d => d.newClasses), Math.max(maxNewClasses, 1))" fill="url(#blueGradient)" opacity="0.3" />
                <path :d="generateLinePath(dailyStats.map(d => d.newClasses), Math.max(maxNewClasses, 1))" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div class="flex justify-between mt-1">
                <div v-for="day in dailyStats" :key="day.date" class="text-center flex-1">
                  <div class="text-xs font-medium text-blue-600">{{ day.newClasses || '-' }}</div>
                  <div class="text-xs text-gray-400">{{ formatShortDate(day.date) }}</div>
                </div>
              </div>
            </div>

            <!-- 新增学生 -->
            <div class="bg-gray-50 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-700">👥 新增学生</h4>
                <span class="text-xs text-green-600 font-medium">+{{ weekTotal.newStudents }}</span>
              </div>
              <svg viewBox="0 0 300 60" class="w-full h-16" preserveAspectRatio="none">
                <defs><linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#22c55e" /><stop offset="100%" stop-color="#22c55e" stop-opacity="0" /></linearGradient></defs>
                <path :d="generateAreaPath(dailyStats.map(d => d.newStudents), maxNewStudents)" fill="url(#greenGradient)" opacity="0.3" />
                <path :d="generateLinePath(dailyStats.map(d => d.newStudents), maxNewStudents)" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div class="flex justify-between mt-1">
                <div v-for="day in dailyStats" :key="day.date" class="text-center flex-1">
                  <div class="text-xs font-medium text-green-600">{{ day.newStudents || '-' }}</div>
                  <div class="text-xs text-gray-400">{{ formatShortDate(day.date) }}</div>
                </div>
              </div>
            </div>

            <!-- 评价趋势 -->
            <div class="bg-gray-50 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-700">📈 评价趋势</h4>
                <span class="text-xs text-purple-600 font-medium">{{ weekTotal.evaluations }} 条</span>
              </div>
              <svg viewBox="0 0 300 60" class="w-full h-16" preserveAspectRatio="none">
                <defs><linearGradient id="purpleGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#a855f7" /><stop offset="100%" stop-color="#a855f7" stop-opacity="0" /></linearGradient></defs>
                <path :d="generateAreaPath(dailyStats.map(d => d.evaluations), maxEvals)" fill="url(#purpleGradient)" opacity="0.3" />
                <path :d="generateLinePath(dailyStats.map(d => d.evaluations), maxEvals)" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div class="flex justify-between mt-1">
                <div v-for="day in dailyStats" :key="day.date" class="text-center flex-1">
                  <div class="text-xs font-medium text-purple-600">{{ day.evaluations || '-' }}</div>
                  <div class="text-xs text-gray-400">{{ formatShortDate(day.date) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 宠物图鉴管理 -->
        <div v-else-if="activeTab === 'pets'" class="p-4">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 class="font-bold text-gray-800">宠物图片管理</h3>
              <p class="text-xs text-gray-500 mt-0.5">新增 / 替换各等级图，或删除整只宠物（写入 public/pets）</p>
            </div>
            <div class="flex gap-2">
              <button @click="loadAdminPets" class="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">刷新</button>
              <button @click="openPetForm" class="px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">＋ 添加宠物</button>
            </div>
          </div>

          <div v-if="petsLoading" class="py-12 text-center text-gray-400">加载中…</div>
          <div v-else class="space-y-3">
            <div
              v-for="pet in visiblePets"
              :key="pet.id"
              class="border border-gray-100 rounded-xl overflow-hidden hover:border-orange-200 transition-colors"
            >
              <div class="p-3 flex items-center gap-3 cursor-pointer" @click="expandedPet = expandedPet === pet.id ? null : pet.id">
                <img :src="petThumb(pet, 1)" :alt="pet.name" class="w-14 h-14 object-contain bg-orange-50 rounded-lg" @error="($event.target as HTMLImageElement).style.opacity='0.3'" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-800 flex items-center gap-2 flex-wrap">
                    {{ pet.name }}
                    <span class="text-xs px-2 py-0.5 rounded-full" :class="pet.category === 'mythical' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-700'">
                      {{ pet.category === 'mythical' ? '神兽' : '普通' }}
                    </span>
                    <span v-if="pet.builtin" class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">内置</span>
                    <span v-else class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">自定义</span>
                  </div>
                  <div class="text-xs text-gray-400 font-mono mt-0.5">{{ pet.id }}</div>
                </div>
                <button
                  @click.stop="confirmDeletePet(pet)"
                  class="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg"
                >删除</button>
                <span class="text-gray-400 text-sm">{{ expandedPet === pet.id ? '▲' : '▼' }}</span>
              </div>
              <div v-if="expandedPet === pet.id" class="px-3 pb-3 bg-gray-50 border-t border-gray-100">
                <p class="text-xs text-gray-500 py-2">点击格子替换对应等级图片（png/jpg/webp）</p>
                <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  <label
                    v-for="lv in [0,1,2,3,4,5,6,7,8]"
                    :key="lv"
                    class="relative aspect-square bg-white rounded-lg border border-dashed border-gray-200 hover:border-orange-400 cursor-pointer overflow-hidden flex flex-col items-center justify-center"
                  >
                    <img
                      v-if="pet.levels?.[lv]?.exists"
                      :src="petThumb(pet, lv)"
                      class="absolute inset-0 w-full h-full object-contain p-1"
                      @error="($event.target as HTMLImageElement).style.display='none'"
                    />
                    <span class="relative z-10 text-[10px] font-bold text-orange-600 bg-white/80 px-1 rounded">{{ lv === 0 ? '蛋' : 'Lv'+lv }}</span>
                    <span v-if="!pet.levels?.[lv]?.exists" class="relative z-10 text-[10px] text-gray-400">上传</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="replacePetLevel(pet, lv, $event)" />
                  </label>
                </div>
              </div>
            </div>

            <div v-if="hiddenPets.length" class="mt-6">
              <h4 class="text-sm font-medium text-gray-500 mb-2">已删除（可恢复）</h4>
              <div class="space-y-2">
                <div v-for="pet in hiddenPets" :key="'h-'+pet.id" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span class="font-medium text-gray-600">{{ pet.name }}</span>
                    <span class="text-xs text-gray-400 ml-2 font-mono">{{ pet.id }}</span>
                  </div>
                  <button @click="restoreHiddenPet(pet)" class="text-sm text-orange-600 hover:underline">恢复</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 积分商城目录 -->
        <div v-else class="p-4">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 class="font-bold text-gray-800">积分商城物品目录</h3>
              <p class="text-xs text-gray-500 mt-0.5">
                借鉴吾师 / 班宠 / 班级优 · 共 {{ catalogStats?.total || 0 }} 条
                （显示 {{ catalogStats?.enabled || 0 }} / 隐藏 {{ catalogStats?.disabled || 0 }}）
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button @click="seedShopCatalog('merge')" class="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">合并三站默认</button>
              <button @click="seedShopCatalog('replace')" class="px-3 py-2 text-sm border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50">重置为默认</button>
              <button @click="loadShopCatalog" class="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">刷新</button>
              <button @click="openCatalogCreate" class="px-3 py-2 text-sm bg-orange-500 text-white rounded-lg font-medium">＋ 添加物品</button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mb-4">
            <select v-model="catalogFilter" class="border rounded-lg px-2 py-1.5 text-sm">
              <option value="all">全部状态</option>
              <option value="enabled">仅显示中</option>
              <option value="disabled">仅已隐藏</option>
            </select>
            <select v-model="catalogSourceFilter" class="border rounded-lg px-2 py-1.5 text-sm">
              <option value="all">全部来源</option>
              <option v-for="s in catalogSources" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>

          <div v-if="catalogLoading" class="py-12 text-center text-gray-400">加载中…</div>
          <div v-else class="space-y-2">
            <div
              v-for="item in filteredCatalog"
              :key="item.id"
              class="flex items-center gap-3 p-3 border rounded-xl"
              :class="item.enabled ? 'border-amber-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-70'"
            >
              <div class="text-2xl w-10 text-center">{{ item.emoji }}</div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 flex flex-wrap items-center gap-2">
                  {{ item.name }}
                  <span class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{{ item.cost }} 分</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ item.category }}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{{ sourceLabel(item.source) }}</span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5 truncate">{{ item.description || '无说明' }}</p>
              </div>
              <button
                @click="toggleCatalogEnabled(item)"
                class="px-2.5 py-1 text-xs rounded-lg font-medium"
                :class="item.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
              >{{ item.enabled ? '显示中' : '已隐藏' }}</button>
              <button @click="openCatalogEdit(item)" class="px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded-lg">编辑</button>
              <button @click="confirmDeleteCatalog(item)" class="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg">删除</button>
            </div>
            <div v-if="!filteredCatalog.length" class="text-center text-gray-400 py-10">暂无物品，可「合并三站默认」或手动添加</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加宠物弹窗 -->
    <div v-if="showPetForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showPetForm = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h3 class="text-lg font-bold text-gray-800">添加宠物</h3>
          <button @click="showPetForm = false" class="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">宠物 ID（英文）</label>
            <input v-model="petForm.id" type="text" placeholder="如 fluffy-fox" class="w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" />
            <p class="text-xs text-gray-400 mt-1">小写字母开头，仅字母/数字/连字符</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
            <input v-model="petForm.name" type="text" placeholder="如 毛毛狐" class="w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分类</label>
            <select v-model="petForm.category" class="w-full border rounded-xl px-3 py-2">
              <option value="normal">普通动物</option>
              <option value="mythical">神兽</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">等级图片（Lv0=蛋 … Lv8，至少一张）</label>
            <div class="grid grid-cols-4 gap-2">
              <label v-for="lv in 8" :key="lv" class="border border-dashed rounded-lg p-2 text-center cursor-pointer hover:border-orange-400 min-h-[72px] flex flex-col items-center justify-center relative overflow-hidden">
                <img v-if="petFormPreviews[lv]" :src="petFormPreviews[lv]" class="absolute inset-0 w-full h-full object-contain p-1" />
                <span class="relative z-10 text-xs font-medium bg-white/80 px-1 rounded">Lv{{ lv }}</span>
                <input type="file" accept="image/*" class="hidden" @change="onPetFileChange(lv, $event)" />
              </label>
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showPetForm = false" class="flex-1 py-2.5 border rounded-xl">取消</button>
            <button @click="savePet" :disabled="petSaving" class="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-medium disabled:opacity-50">
              {{ petSaving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除宠物确认 -->
    <div v-if="showPetDeleteConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showPetDeleteConfirm = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div class="bg-red-500 px-6 py-4">
          <h3 class="text-lg font-bold text-white">删除宠物</h3>
        </div>
        <div class="p-6">
          <p class="text-gray-700 mb-2">
            确定删除 <span class="font-bold text-red-600">{{ petToDelete?.name }}</span>
            <span class="font-mono text-sm text-gray-400">({{ petToDelete?.id }})</span>？
          </p>
          <p class="text-sm text-gray-500 mb-6">将删除该宠全部等级图片。内置宠可在「已删除」中恢复条目（需重新上传图片）。</p>
          <div class="flex gap-3">
            <button @click="showPetDeleteConfirm = false" class="flex-1 py-2.5 border rounded-xl">取消</button>
            <button @click="executeDeletePet" :disabled="isDeletingPet" class="flex-1 py-2.5 bg-red-500 text-white rounded-xl disabled:opacity-50">
              {{ isDeletingPet ? '删除中…' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 商城物品表单 -->
    <div v-if="showCatalogForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showCatalogForm = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white">
          <h3 class="font-bold text-lg">{{ editingCatalog ? '编辑物品' : '添加物品' }}</h3>
          <button @click="showCatalogForm = false" class="text-gray-400 text-xl">×</button>
        </div>
        <div class="p-6 space-y-3">
          <div class="flex gap-2">
            <input v-model="catalogForm.emoji" class="w-14 border rounded-xl px-2 py-2 text-center text-xl" />
            <input v-model="catalogForm.name" placeholder="名称" class="flex-1 border rounded-xl px-3 py-2" />
          </div>
          <input v-model="catalogForm.description" placeholder="说明" class="w-full border rounded-xl px-3 py-2 text-sm" />
          <div class="grid grid-cols-2 gap-2">
            <label class="text-sm text-gray-600">积分
              <input v-model.number="catalogForm.cost" type="number" min="1" class="mt-1 w-full border rounded-lg px-2 py-1.5" />
            </label>
            <label class="text-sm text-gray-600">库存（-1 无限）
              <input v-model.number="catalogForm.stock" type="number" class="mt-1 w-full border rounded-lg px-2 py-1.5" />
            </label>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="text-sm text-gray-600">分类
              <input v-model="catalogForm.category" class="mt-1 w-full border rounded-lg px-2 py-1.5" />
            </label>
            <label class="text-sm text-gray-600">来源
              <select v-model="catalogForm.source" class="mt-1 w-full border rounded-lg px-2 py-1.5">
                <option v-for="s in catalogSources" :key="s.id" :value="s.id">{{ s.name }}</option>
                <option value="custom">自定义</option>
              </select>
            </label>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" :checked="!!catalogForm.enabled" @change="catalogForm.enabled = ($event.target as HTMLInputElement).checked ? 1 : 0" />
            默认显示（教师可导入到班级商城）
          </label>
          <div class="flex gap-3 pt-2">
            <button @click="showCatalogForm = false" class="flex-1 py-2.5 border rounded-xl">取消</button>
            <button @click="saveCatalogItem" :disabled="catalogSaving" class="flex-1 py-2.5 bg-orange-500 text-white rounded-xl disabled:opacity-50">
              {{ catalogSaving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除商城物品 -->
    <div v-if="showCatalogDelete" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showCatalogDelete = false">
      <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
        <p class="text-gray-800 mb-4">确定删除 <span class="font-bold text-red-600">{{ catalogToDelete?.emoji }} {{ catalogToDelete?.name }}</span>？</p>
        <div class="flex gap-3">
          <button @click="showCatalogDelete = false" class="flex-1 py-2 border rounded-xl">取消</button>
          <button @click="executeDeleteCatalog" class="flex-1 py-2 bg-red-500 text-white rounded-xl">删除</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="cancelDelete">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div class="bg-red-500 px-6 py-4">
          <h3 class="text-xl font-bold text-white flex items-center gap-2">
            ⚠️ 危险操作
          </h3>
        </div>
        <div class="p-6">
          <p class="text-gray-700 mb-4">
            确定要删除用户 <span class="font-bold text-red-600">{{ teacherToDelete?.username }}</span> 吗？
          </p>
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p class="text-sm text-red-700 font-medium mb-2">此操作将同时删除：</p>
            <ul class="text-sm text-red-600 space-y-1">
              <li>• {{ teacherToDelete?.classCount || 0 }} 个班级</li>
              <li>• {{ teacherToDelete?.totalStudents || 0 }} 名学生</li>
              <li>• {{ teacherToDelete?.totalEvals || 0 }} 条评价记录</li>
            </ul>
            <p class="text-sm text-red-700 mt-3 font-medium">⚠️ 此操作不可恢复！</p>
          </div>
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              请输入用户名 <span class="text-red-600 font-bold">{{ teacherToDelete?.username }}</span> 以确认删除：
            </label>
            <input 
              type="text"
              v-model="deleteConfirmInput"
              class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
              :class="deleteConfirmInput && !canConfirmDelete ? 'border-red-300 bg-red-50' : 'border-gray-300'"
              placeholder="输入用户名确认"
              @keydown.enter="canConfirmDelete && executeDelete()"
            />
            <p v-if="deleteConfirmInput && !canConfirmDelete" class="text-sm text-red-500 mt-1">
              用户名不匹配
            </p>
          </div>
          <div class="flex gap-3">
            <button 
              @click="cancelDelete"
              :disabled="isDeleting"
              class="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button 
              @click="executeDelete"
              :disabled="isDeleting || !canConfirmDelete"
              class="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span v-if="isDeleting" class="animate-spin">⏳</span>
              <span v-else>确认删除</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.expand-enter-active, .expand-leave-active { transition: all 0.2s ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
.expand-enter-to, .expand-leave-from { max-height: 500px; }
</style>