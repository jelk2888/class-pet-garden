<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageLayout from '@/components/layout/PageLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useStudents } from '@/composables/useStudents'
import { useToast } from '@/composables/useToast'

interface SeatChart {
  id: string
  name: string
  rows: number
  pattern: number[]
  podium: 'top' | 'bottom'
  seats: (string | null)[]
  updated_at?: number
}

const router = useRouter()
const { api } = useAuth()
const { currentClass, init } = useClasses()
const { students, loadStudents } = useStudents()
const toast = useToast()

const loading = ref(true)
const charts = ref<SeatChart[]>([])
const active = ref<SeatChart | null>(null)
const dirty = ref(false)
const editing = ref(false)
const showCreate = ref(false)
const saving = ref(false)

const draftName = ref('开学座位表')
const draftRows = ref(6)
const draftPattern = ref('1-1-1-1')
const draftPodium = ref<'top' | 'bottom'>('top')
const draftMode = ref<'single' | 'pair' | 'custom'>('single')

const selectedSeat = ref<number | null>(null)
const selectedStudent = ref<string | null>(null)
const history = ref<(string | null)[][]>([])

const presets = ['1-1-1-1', '2-2-2', '1-2-1-2', '1-1-2-2', '2-3-2']

const studentMap = computed(() => {
  const m = new Map<string, any>()
  for (const s of students.value) m.set(s.id, s)
  return m
})

function parsePattern(raw: string | number[]): number[] {
  if (Array.isArray(raw)) return raw.map((n) => Math.max(1, Number(n) || 1)).filter(Boolean)
  return String(raw)
    .split(/[-,，\s]+/)
    .map((n) => Math.max(1, parseInt(n, 10) || 1))
    .filter(Boolean)
}

const previewTotal = computed(() => draftRows.value * (parsePattern(draftPattern.value).reduce((a, b) => a + b, 0) || 1))

const unassigned = computed(() => {
  if (!active.value) return students.value
  const used = new Set(active.value.seats.filter(Boolean) as string[])
  return students.value.filter((s) => !used.has(s.id))
})

const seatsPerRow = computed(() => {
  const p = active.value?.pattern || parsePattern(draftPattern.value)
  return p.reduce((a, b) => a + b, 0) || 1
})

const emptyCount = computed(() => {
  if (!active.value) return 0
  return active.value.seats.filter((x) => !x).length
})

async function loadCharts() {
  if (!currentClass.value) {
    charts.value = []
    active.value = null
    return
  }
  loading.value = true
  try {
    const keepId = active.value?.id
    const res = await api.get(`/seating/${currentClass.value.id}`)
    charts.value = res.data.charts || []
    if (keepId) {
      active.value = charts.value.find((c) => c.id === keepId) || null
      editing.value = !!active.value
    } else {
      active.value = null
      editing.value = false
    }
    dirty.value = false
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '加载座位表失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  const n = students.value.length || 24
  const cols = 4
  draftRows.value = Math.min(20, Math.max(4, Math.ceil(n / cols)))
  draftPattern.value = '1-1-1-1'
  draftMode.value = 'single'
  draftName.value = charts.value.length ? `座位表 ${charts.value.length + 1}` : '开学座位表'
  draftPodium.value = 'top'
  showCreate.value = true
}

function applyMode(mode: 'single' | 'pair' | 'custom') {
  draftMode.value = mode
  if (mode === 'single') draftPattern.value = '1-1-1-1'
  if (mode === 'pair') draftPattern.value = '2-2-2'
}

async function createChart(autoFill = true) {
  if (!currentClass.value) return
  const pattern = parsePattern(draftPattern.value)
  if (!pattern.length) {
    toast.warning('请填写有效列组，如 2-2-2')
    return
  }
  saving.value = true
  try {
    const res = await api.post(`/seating/${currentClass.value.id}`, {
      name: draftName.value,
      rows: draftRows.value,
      pattern,
      podium: draftPodium.value,
      autoFill,
    })
    showCreate.value = false
    active.value = res.data.chart
    editing.value = true
    dirty.value = false
    history.value = []
    await loadCharts()
    active.value = charts.value.find((c) => c.id === res.data.chart.id) || res.data.chart
    toast.success('座位表已创建')
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '创建失败')
  } finally {
    saving.value = false
  }
}

function pushHistory() {
  if (!active.value) return
  history.value.push([...active.value.seats])
  if (history.value.length > 30) history.value.shift()
}

function undo() {
  const prev = history.value.pop()
  if (!prev || !active.value) return
  active.value = { ...active.value, seats: prev }
  dirty.value = true
}

function seatName(id: string | null) {
  if (!id) return ''
  return studentMap.value.get(id)?.name || '？'
}

function clickSeat(idx: number) {
  if (!active.value) return
  const sid = active.value.seats[idx]
  if (selectedStudent.value) {
    // 把选中学生放到此座（若原位有人则互换/挤出到待安排）
    pushHistory()
    const seats = [...active.value.seats]
    const fromIdx = seats.findIndex((x) => x === selectedStudent.value)
    const prev = seats[idx]
    seats[idx] = selectedStudent.value
    if (fromIdx >= 0) seats[fromIdx] = prev
    active.value = { ...active.value, seats }
    selectedStudent.value = null
    selectedSeat.value = null
    dirty.value = true
    return
  }
  if (selectedSeat.value != null && selectedSeat.value !== idx) {
    // 两座互换
    pushHistory()
    const seats = [...active.value.seats]
    const a = seats[selectedSeat.value]
    seats[selectedSeat.value] = seats[idx]
    seats[idx] = a
    active.value = { ...active.value, seats }
    selectedSeat.value = null
    dirty.value = true
    return
  }
  if (selectedSeat.value === idx) {
    selectedSeat.value = null
    return
  }
  selectedSeat.value = idx
  if (sid) selectedStudent.value = null
}

function pickStudent(id: string) {
  if (selectedSeat.value != null && active.value) {
    pushHistory()
    const seats = [...active.value.seats]
    const fromIdx = seats.findIndex((x) => x === id)
    const prev = seats[selectedSeat.value]
    seats[selectedSeat.value] = id
    if (fromIdx >= 0) seats[fromIdx] = prev
    active.value = { ...active.value, seats }
    selectedSeat.value = null
    selectedStudent.value = null
    dirty.value = true
    return
  }
  selectedStudent.value = selectedStudent.value === id ? null : id
  selectedSeat.value = null
}

function clearSeat(idx: number) {
  if (!active.value || !active.value.seats[idx]) return
  pushHistory()
  const seats = [...active.value.seats]
  seats[idx] = null
  active.value = { ...active.value, seats }
  dirty.value = true
  selectedSeat.value = null
}

function randomFill() {
  if (!active.value) return
  pushHistory()
  const pool = [...students.value.map((s) => s.id)]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const seats = active.value.seats.map(() => null as string | null)
  pool.forEach((id, i) => {
    if (i < seats.length) seats[i] = id
  })
  active.value = { ...active.value, seats }
  dirty.value = true
  toast.success('已随机排座')
}

function clearAll() {
  if (!active.value) return
  if (!confirm('确定清空所有座位？')) return
  pushHistory()
  active.value = { ...active.value, seats: active.value.seats.map(() => null) }
  dirty.value = true
}

function rotateCols(dir: 1 | -1) {
  if (!active.value) return
  const cols = seatsPerRow.value
  const rows = active.value.rows
  pushHistory()
  const seats = [...active.value.seats]
  const next = Array(seats.length).fill(null)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nc = (c + dir + cols) % cols
      next[r * cols + nc] = seats[r * cols + c]
    }
  }
  active.value = { ...active.value, seats: next }
  dirty.value = true
}

function rotateRows(dir: 1 | -1) {
  if (!active.value) return
  const cols = seatsPerRow.value
  const rows = active.value.rows
  pushHistory()
  const seats = [...active.value.seats]
  const next = Array(seats.length).fill(null)
  for (let r = 0; r < rows; r++) {
    const nr = (r + dir + rows) % rows
    for (let c = 0; c < cols; c++) {
      next[nr * cols + c] = seats[r * cols + c]
    }
  }
  active.value = { ...active.value, seats: next }
  dirty.value = true
}

function mirrorLR() {
  if (!active.value) return
  const cols = seatsPerRow.value
  const rows = active.value.rows
  pushHistory()
  const seats = [...active.value.seats]
  const next = Array(seats.length).fill(null)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      next[r * cols + (cols - 1 - c)] = seats[r * cols + c]
    }
  }
  active.value = { ...active.value, seats: next }
  dirty.value = true
}

async function save() {
  if (!currentClass.value || !active.value) return
  saving.value = true
  try {
    const res = await api.put(`/seating/${currentClass.value.id}/${active.value.id}`, {
      name: active.value.name,
      rows: active.value.rows,
      pattern: active.value.pattern,
      podium: active.value.podium,
      seats: active.value.seats,
    })
    active.value = res.data.chart
    dirty.value = false
    await loadCharts()
    toast.success('已保存并同步')
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeChart() {
  if (!currentClass.value || !active.value) return
  if (!confirm(`确定删除「${active.value.name}」？`)) return
  try {
    await api.delete(`/seating/${currentClass.value.id}/${active.value.id}`)
    active.value = null
    editing.value = false
    await loadCharts()
    toast.success('已删除')
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '删除失败')
  }
}

function goFullscreen() {
  const el = document.documentElement
  if (!document.fullscreenElement) el.requestFullscreen?.()
  else document.exitFullscreen?.()
}

function printChart() {
  window.print()
}

function exitToList() {
  if (dirty.value && !confirm('有未保存修改，确定离开？')) return
  editing.value = false
  active.value = null
  dirty.value = false
}

function openChart(c: SeatChart) {
  active.value = c
  editing.value = true
  dirty.value = false
  history.value = []
  selectedSeat.value = null
  selectedStudent.value = null
}

/** 按行渲染：座位块 + 过道 */
function rowCells(rowIdx: number) {
  const pattern = active.value?.pattern || parsePattern(draftPattern.value)
  const cols = pattern.reduce((a, b) => a + b, 0)
  const base = rowIdx * cols
  const cells: Array<{ type: 'seat'; index: number } | { type: 'aisle' }> = []
  let col = 0
  pattern.forEach((g, gi) => {
    for (let i = 0; i < g; i++) {
      cells.push({ type: 'seat', index: base + col })
      col++
    }
    if (gi < pattern.length - 1) cells.push({ type: 'aisle' })
  })
  return cells
}

watch(currentClass, async () => {
  await loadStudents()
  await loadCharts()
})

onMounted(async () => {
  await init()
  await loadStudents()
  await loadCharts()
})
</script>

<template>
  <PageLayout>
    <div class="max-w-6xl mx-auto seat-page">
      <!-- 顶栏 -->
      <div class="flex items-center justify-between gap-3 flex-wrap mb-5 print:hidden">
        <div class="flex items-center gap-3">
          <button class="text-sm text-gray-500 hover:text-orange-600" @click="router.push('/toolbox')">← 教师工具箱</button>
          <h1 class="text-2xl font-bold text-gray-800">座位表</h1>
        </div>
        <div v-if="editing && active" class="flex flex-wrap items-center gap-2">
          <span v-if="dirty" class="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">有未保存修改</span>
          <button class="px-3 py-1.5 rounded-xl border text-sm" @click="goFullscreen">全屏</button>
          <button class="px-3 py-1.5 rounded-xl border text-sm" @click="printChart">打印</button>
          <button class="px-3 py-1.5 rounded-xl border text-sm" @click="exitToList">退出编辑</button>
          <button
            class="px-4 py-1.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style="background: var(--accent)"
            :disabled="saving || !dirty"
            @click="save"
          >保存</button>
        </div>
      </div>

      <div v-if="!currentClass" class="bg-white rounded-2xl p-12 text-center text-gray-400">请先选择班级</div>
      <div v-else-if="loading" class="bg-white rounded-2xl p-12 text-center text-gray-400">加载中…</div>

      <!-- 空状态 / 列表 -->
      <template v-else-if="!editing">
        <div v-if="!charts.length" class="bg-white rounded-3xl border border-black/5 shadow-sm p-12 text-center max-w-lg mx-auto">
          <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-violet-500 text-white flex items-center justify-center">
            <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="13" width="7" height="7" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/></svg>
          </div>
          <h2 class="text-xl font-bold text-gray-800">还没有座位表</h2>
          <p class="text-sm text-gray-500 mt-2">选择常见布局，几分钟排好全班座位</p>
          <div class="mt-6 flex justify-center gap-3">
            <button class="px-4 py-2.5 rounded-xl border text-sm" @click="router.push('/toolbox')">返回工具箱</button>
            <button class="px-5 py-2.5 rounded-xl text-white text-sm font-bold bg-violet-500 hover:bg-violet-600" @click="openCreate">+ 创建第一张座位表</button>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="flex justify-between items-center">
            <p class="text-sm text-gray-500">本班共 {{ charts.length }} 张座位表 · {{ students.length }} 名学生</p>
            <button class="px-4 py-2 rounded-xl text-white text-sm font-bold bg-violet-500" @click="openCreate">+ 新建座位表</button>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            <button
              v-for="c in charts"
              :key="c.id"
              type="button"
              class="text-left bg-white rounded-2xl border border-orange-100 p-5 shadow-sm hover:shadow-md transition"
              @click="openChart(c)"
            >
              <div class="font-bold text-gray-800">{{ c.name }}</div>
              <div class="text-xs text-gray-400 mt-1">
                {{ c.rows }} 排 · 每排 {{ c.pattern.reduce((a,b)=>a+b,0) }} 座 · 布局 {{ c.pattern.join('-') }}
              </div>
              <div class="text-xs text-violet-600 mt-3 font-medium">打开编辑 →</div>
            </button>
          </div>
        </div>
      </template>

      <!-- 编辑器 -->
      <template v-else-if="active">
        <div class="flex flex-col lg:flex-row gap-4">
          <!-- 侧栏：待安排 -->
          <aside class="lg:w-52 shrink-0 print:hidden">
            <div class="bg-white rounded-2xl border border-black/5 p-3 sticky top-4">
              <div class="text-xs font-semibold text-gray-400 mb-2">待安排学生 · {{ unassigned.length }}</div>
              <div class="max-h-[50vh] overflow-auto space-y-1">
                <button
                  v-for="s in unassigned"
                  :key="s.id"
                  type="button"
                  class="w-full text-left px-2.5 py-1.5 rounded-lg text-sm truncate"
                  :class="selectedStudent === s.id ? 'bg-violet-100 text-violet-700 font-medium' : 'hover:bg-gray-50'"
                  @click="pickStudent(s.id)"
                >{{ s.name }}</button>
                <div v-if="!unassigned.length" class="text-xs text-gray-400 py-4 text-center">没有待安排学生</div>
              </div>
              <div class="mt-3 pt-3 border-t space-y-1.5">
                <button class="w-full text-xs py-1.5 rounded-lg border hover:bg-violet-50" @click="randomFill">随机排座</button>
                <button class="w-full text-xs py-1.5 rounded-lg border hover:bg-gray-50" @click="clearAll">清空重置</button>
                <button class="w-full text-xs py-1.5 rounded-lg border hover:bg-red-50 text-red-500" @click="removeChart">删除此表</button>
              </div>
            </div>
          </aside>

          <!-- 主区 -->
          <div class="flex-1 min-w-0">
            <div class="bg-white rounded-2xl border border-black/5 shadow-sm p-4 md:p-6">
              <div class="flex flex-wrap items-center gap-2 mb-4 print:mb-2">
                <input
                  v-model="active.name"
                  class="font-bold text-lg border-b border-transparent hover:border-gray-200 focus:border-violet-400 focus:outline-none bg-transparent max-w-[12rem] print:border-0"
                  @input="dirty = true"
                />
                <span class="text-xs text-gray-400">{{ students.length }} 人 · 空余 {{ emptyCount }} 座</span>
                <div class="ml-auto flex flex-wrap gap-1.5 print:hidden">
                  <button
                    class="px-2.5 py-1 rounded-lg text-xs border"
                    :class="active.podium==='top' ? 'bg-violet-50 border-violet-300 text-violet-700' : ''"
                    @click="active.podium='top'; dirty=true"
                  >讲台在上</button>
                  <button
                    class="px-2.5 py-1 rounded-lg text-xs border"
                    :class="active.podium==='bottom' ? 'bg-violet-50 border-violet-300 text-violet-700' : ''"
                    @click="active.podium='bottom'; dirty=true"
                  >讲台在下</button>
                </div>
              </div>

              <div class="podium mb-3" v-if="active.podium==='top'">讲台</div>

              <div class="space-y-2 overflow-x-auto">
                <div
                  v-for="r in active.rows"
                  :key="r"
                  class="flex items-center justify-center gap-1.5 min-w-max mx-auto"
                >
                  <template v-for="(cell, ci) in rowCells(r - 1)" :key="ci">
                    <div v-if="cell.type==='aisle'" class="w-3 md:w-4 border-l border-dashed border-gray-300 self-stretch mx-0.5" title="过道" />
                    <button
                      v-else
                      type="button"
                      class="seat-cell"
                      :class="{
                        'seat-filled': !!active.seats[cell.index],
                        'seat-selected': selectedSeat === cell.index,
                      }"
                      @click="clickSeat(cell.index)"
                      @dblclick.prevent="clearSeat(cell.index)"
                    >
                      {{ seatName(active.seats[cell.index]) || '空座' }}
                    </button>
                  </template>
                </div>
              </div>

              <div class="podium mt-3" v-if="active.podium==='bottom'">讲台</div>

              <p class="text-xs text-gray-400 mt-4 print:hidden text-center">
                点击座位再点学生安排；点两个座位可互换；双击座位清空
              </p>
            </div>

            <!-- 轮换工具 -->
            <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 print:hidden">
              <button class="tool-btn" @click="undo" :disabled="!history.length">撤销换座</button>
              <button class="tool-btn" @click="rotateCols(-1)">整列向左</button>
              <button class="tool-btn" @click="rotateCols(1)">整列向右</button>
              <button class="tool-btn" @click="rotateRows(-1)">整排向前</button>
              <button class="tool-btn" @click="rotateRows(1)">整排向后</button>
              <button class="tool-btn" @click="mirrorLR">左右对称对调</button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 创建弹窗 -->
    <div v-if="showCreate" class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" @click.self="showCreate=false">
      <div class="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-auto shadow-2xl">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 class="font-bold text-lg">创建座位表</h3>
          <div class="flex items-center gap-3">
            <span class="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
              本班 {{ students.length }} 人 · 空余 {{ Math.max(0, previewTotal - students.length) }} 个座位
            </span>
            <button class="text-gray-400 text-xl" @click="showCreate=false">×</button>
          </div>
        </div>

        <div class="grid md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x">
          <div class="p-5 space-y-3">
            <div class="text-xs font-semibold text-gray-400">布局模式</div>
            <button
              type="button"
              class="mode-card w-full"
              :class="draftMode==='single' && 'mode-active'"
              @click="applyMode('single')"
            >
              <div class="font-bold text-sm">单人列组</div>
              <div class="text-xs text-gray-500 mt-0.5">单人连续座位 · 默认 1-1-1-1</div>
            </button>
            <button
              type="button"
              class="mode-card w-full"
              :class="draftMode==='pair' && 'mode-active'"
              @click="applyMode('pair')"
            >
              <div class="font-bold text-sm">双人拼桌</div>
              <div class="text-xs text-gray-500 mt-0.5">默认 2-2-2，组间保留过道</div>
            </button>
            <button
              type="button"
              class="mode-card w-full"
              :class="draftMode==='custom' && 'mode-active'"
              @click="applyMode('custom')"
            >
              <div class="font-bold text-sm">自定义列组</div>
              <div class="text-xs text-gray-500 mt-0.5">输入 1-2-1-2 等任意列组</div>
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div class="text-xs font-semibold text-gray-400">布局设置</div>
            <div>
              <label class="text-xs text-gray-500">座位表名称</label>
              <input v-model="draftName" class="mt-1 w-full border rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-gray-500">座位排数（最多 20）</label>
              <div class="mt-1 flex items-center gap-2">
                <button class="w-9 h-9 rounded-lg border" @click="draftRows=Math.max(1,draftRows-1)">−</button>
                <span class="font-bold w-10 text-center">{{ draftRows }}</span>
                <button class="w-9 h-9 rounded-lg border" @click="draftRows=Math.min(20,draftRows+1)">+</button>
                <span class="text-xs text-gray-400">排 · 共 {{ previewTotal }} 座</span>
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-500">每排列组</label>
              <input v-model="draftPattern" class="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-mono" @focus="draftMode='custom'" />
              <div class="flex flex-wrap gap-1.5 mt-2">
                <button
                  v-for="p in presets"
                  :key="p"
                  type="button"
                  class="px-2 py-1 rounded-lg border text-xs font-mono hover:bg-violet-50"
                  :class="draftPattern===p && 'border-violet-400 bg-violet-50'"
                  @click="draftPattern=p; draftMode= p==='1-1-1-1'?'single':p==='2-2-2'?'pair':'custom'"
                >{{ p }}</button>
              </div>
              <p class="text-[11px] text-gray-400 mt-2">数字表示一组连续座位，短横线表示组间过道。</p>
            </div>
            <div class="flex gap-2">
              <button class="px-3 py-1.5 rounded-lg border text-xs" :class="draftPodium==='top'&&'bg-violet-50 border-violet-300'" @click="draftPodium='top'">讲台在上</button>
              <button class="px-3 py-1.5 rounded-lg border text-xs" :class="draftPodium==='bottom'&&'bg-violet-50 border-violet-300'" @click="draftPodium='bottom'">讲台在下</button>
            </div>
          </div>

          <div class="p-5">
            <div class="text-xs font-semibold text-gray-400 mb-3">布局示意</div>
            <div class="rounded-xl bg-slate-50 p-3">
              <div v-if="draftPodium==='top'" class="h-6 mb-2 rounded bg-slate-700 text-white text-[10px] flex items-center justify-center">讲台</div>
              <div class="space-y-1">
                <div v-for="r in Math.min(draftRows, 8)" :key="r" class="flex justify-center gap-0.5">
                  <template v-for="(g, gi) in parsePattern(draftPattern)" :key="gi">
                    <div v-for="i in g" :key="i" class="w-4 h-4 rounded border border-sky-300 bg-white" />
                    <div v-if="gi < parsePattern(draftPattern).length-1" class="w-2 border-l border-dashed border-gray-300" />
                  </template>
                </div>
                <div v-if="draftRows > 8" class="text-[10px] text-center text-gray-400">…共 {{ draftRows }} 排</div>
              </div>
              <div v-if="draftPodium==='bottom'" class="h-6 mt-2 rounded bg-slate-700 text-white text-[10px] flex items-center justify-center">讲台</div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-3xl">
          <p class="text-xs text-gray-400">座位表保存后才会同步给班级。</p>
          <div class="flex gap-2">
            <button class="px-4 py-2 rounded-xl border text-sm" @click="showCreate=false">取消</button>
            <button class="px-5 py-2 rounded-xl text-white text-sm font-bold bg-violet-500 disabled:opacity-60" :disabled="saving" @click="createChart(true)">
              生成并进入编辑
            </button>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.podium {
  @apply mx-auto max-w-md h-9 rounded-xl bg-slate-700 text-white text-sm font-medium flex items-center justify-center tracking-widest;
}
.seat-cell {
  @apply w-[4.5rem] md:w-20 h-11 md:h-12 rounded-xl border-2 border-sky-200 bg-sky-50/50 text-xs md:text-sm
    text-gray-500 font-medium truncate px-1 transition hover:border-violet-400;
}
.seat-filled {
  @apply bg-white border-violet-200 text-gray-800 shadow-sm;
}
.seat-selected {
  @apply ring-2 ring-violet-400 border-violet-400;
}
.tool-btn {
  @apply px-3 py-2 rounded-xl border bg-white text-xs text-gray-600 hover:bg-violet-50 hover:border-violet-200 transition disabled:opacity-40;
}
.mode-card {
  @apply text-left rounded-xl border border-gray-200 p-3 hover:border-violet-300 transition;
}
.mode-active {
  @apply border-violet-400 bg-violet-50 ring-1 ring-violet-200;
}
@media print {
  .seat-page { max-width: none !important; }
  .seat-cell { border-color: #94a3b8 !important; }
}
</style>
