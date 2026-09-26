<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PageLayout from '@/components/layout/PageLayout.vue'
import { useClasses } from '@/composables/useClasses'
import { useStudents } from '@/composables/useStudents'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const { currentClass, init } = useClasses()
const { students, loadStudents, batchEvaluate } = useStudents()
const toast = useToast()

/** 统一线框 SVG 图标（viewBox 0 0 24 24） */
const tools = [
  {
    id: 'atlas',
    title: '宠物图鉴',
    desc: '查看全部宠物进化形态',
    to: '/preview',
    tint: 'from-amber-400 to-orange-500',
    paths: ['M12 3c-2.5 2.2-4 4.8-4 7.2a4 4 0 0 0 8 0C16 7.8 14.5 5.2 12 3z', 'M9 20c1-.8 2-.8 3-.8s2 0 3 .8', 'M8 14.5c.8 1.2 2.2 2 4 2s3.2-.8 4-2'],
  },
  {
    id: 'groups',
    title: '一组一宠',
    desc: '小组共同养宠与集体能量',
    to: '/manage/groups',
    tint: 'from-sky-400 to-blue-500',
    paths: ['M16 11a3 3 0 1 0-2.8-4', 'M8 11a3 3 0 1 0 2.8-4', 'M12 14a4 4 0 0 0-4 2.2V19h8v-2.8A4 4 0 0 0 12 14z', 'M5.5 19v-1.5A3.5 3.5 0 0 1 8 14.2', 'M18.5 19v-1.5A3.5 3.5 0 0 0 16 14.2'],
  },
  {
    id: 'shop',
    title: '小卖部',
    desc: '积分兑换课堂特权与奖励',
    to: '/shop',
    tint: 'from-emerald-400 to-teal-500',
    paths: ['M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8z', 'M8 8V6a4 4 0 0 1 8 0v2', 'M9 12v4', 'M15 12v4'],
  },
  {
    id: 'records',
    title: '成长记录',
    desc: '评价流水与可撤销记录',
    to: '/records',
    tint: 'from-violet-400 to-purple-500',
    paths: ['M8 4h9a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z', 'M10 9h6', 'M10 13h6', 'M10 17h3'],
  },
  {
    id: 'honors',
    title: '徽章荣誉',
    desc: '毕业徽章与荣誉墙',
    to: '/honors',
    tint: 'from-yellow-400 to-amber-500',
    paths: ['M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7L12 3z', 'M8 19h8', 'M9.5 21h5'],
  },
  {
    id: 'table',
    title: '表格批量记分',
    desc: '粘贴名单快速批量加分',
    action: 'table',
    tint: 'from-cyan-400 to-sky-500',
    paths: ['M4 5h16v14H4z', 'M4 10h16', 'M4 15h16', 'M10 5v14', 'M15 5v14'],
  },
  {
    id: 'seating',
    title: '座位表',
    desc: '快速排座、换座轮换，支持全屏与打印',
    to: '/seating',
    tint: 'from-violet-400 to-indigo-500',
    paths: ['M3 4h7v7H3z', 'M14 4h7v7h-7z', 'M3 13h7v7H3z', 'M14 13h7v7h-7z'],
  },
  {
    id: 'random',
    title: '随机点名',
    desc: '全屏滚动点名并快速记分',
    action: 'random',
    tint: 'from-rose-400 to-pink-500',
    paths: ['M5 5h6v6H5z', 'M13 13h6v6h-6z', 'M14 5h5v5', 'M5 14h5v5', 'M9 9l6 6'],
  },
  {
    id: 'timer',
    title: '课堂计时器',
    desc: '倒计时 / 正计时，支持全屏',
    action: 'timer',
    tint: 'from-orange-400 to-red-500',
    paths: ['M12 7v5l3 2', 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M9 3h6', 'M12 3v2'],
  },
  {
    id: 'rank',
    title: '排行榜',
    desc: '按积分查看班级排名',
    to: '/ranking',
    tint: 'from-fuchsia-400 to-purple-600',
    paths: ['M6 20V11', 'M12 20V5', 'M18 20v-6', 'M4 20h16'],
  },
] as const

const showRandom = ref(false)
const showTimer = ref(false)
const showTable = ref(false)
const rolling = ref(false)
const picked = ref<any>(null)
const rollName = ref('点击开始')
let rollTimer: number | null = null

const timerMode = ref<'down' | 'up'>('down')
const timerSeconds = ref(60)
const timerLeft = ref(60)
const timerRunning = ref(false)
let tick: number | null = null

const tableText = ref('')
const tablePoints = ref(1)
const tableReason = ref('表格批量记分')

function openTool(t: (typeof tools)[number]) {
  if (t.to) {
    router.push(t.to)
    return
  }
  if (t.action === 'random') {
    showRandom.value = true
    picked.value = null
    rollName.value = '点击开始'
  } else if (t.action === 'timer') {
    showTimer.value = true
    timerLeft.value = timerSeconds.value
  } else if (t.action === 'table') {
    showTable.value = true
  }
}

function startRoll() {
  if (!students.value.length) {
    toast.warning('请先添加学生')
    return
  }
  rolling.value = true
  picked.value = null
  let i = 0
  if (rollTimer) clearInterval(rollTimer)
  rollTimer = window.setInterval(() => {
    const s = students.value[i % students.value.length]
    rollName.value = s.name
    i++
  }, 60)
  window.setTimeout(() => {
    if (rollTimer) clearInterval(rollTimer)
    rolling.value = false
    picked.value = students.value[Math.floor(Math.random() * students.value.length)]
    rollName.value = picked.value.name
  }, 2200)
}

function startTimer() {
  if (timerRunning.value) return
  timerRunning.value = true
  if (timerMode.value === 'down') timerLeft.value = timerSeconds.value
  tick = window.setInterval(() => {
    if (timerMode.value === 'down') {
      if (timerLeft.value <= 0) {
        stopTimer()
        toast.success('时间到！')
        return
      }
      timerLeft.value -= 1
    } else {
      timerLeft.value += 1
    }
  }, 1000)
}

function stopTimer() {
  timerRunning.value = false
  if (tick) clearInterval(tick)
  tick = null
}

function resetTimer() {
  stopTimer()
  timerLeft.value = timerMode.value === 'down' ? timerSeconds.value : 0
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function goFullscreen(el?: HTMLElement | null) {
  const target = el || document.documentElement
  try {
    if (!document.fullscreenElement) await target.requestFullscreen()
    else await document.exitFullscreen()
  } catch {
    toast.warning('当前浏览器不支持全屏')
  }
}

async function submitTable() {
  if (!currentClass.value) return
  const names = tableText.value
    .split(/\n/)
    .map(l => l.trim().split(/[,，\t\s]+/)[0])
    .filter(Boolean)
  if (!names.length) {
    toast.warning('请粘贴学生姓名，每行一个')
    return
  }
  const map = new Map(students.value.map(s => [s.name, s]))
  const ids = names.map(n => map.get(n)?.id).filter(Boolean) as string[]
  if (!ids.length) {
    toast.warning('没有匹配到班级内学生')
    return
  }
  try {
    await batchEvaluate(ids, {
      points: tablePoints.value,
      name: tableReason.value || '表格批量记分',
      category: '其他',
    })
    toast.success(`已为 ${ids.length} 人记分`)
    showTable.value = false
  } catch {
    toast.error('批量记分失败')
  }
}

onMounted(async () => {
  await init()
  await loadStudents()
})

onUnmounted(() => {
  if (rollTimer) clearInterval(rollTimer)
  stopTimer()
})
</script>

<template>
  <PageLayout>
    <div class="max-w-5xl mx-auto space-y-6">
      <div class="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">教师工具箱</h1>
          <p class="text-sm text-gray-500 mt-1">课堂互动实用小工具：点名、计时、批量记分等</p>
        </div>
          <button type="button" @click="goFullscreen()" class="px-3 py-1.5 rounded-xl border text-sm text-gray-600 hover:bg-orange-50 inline-flex items-center gap-1.5">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 3H4v4" /><path d="M16 3h4v4" /><path d="M8 21H4v-4" /><path d="M16 21h4v-4" />
            </svg>
            全屏
          </button>
      </div>

      <div v-if="!currentClass" class="bg-white rounded-2xl p-10 text-center text-gray-400">请先选择班级</div>
      <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="t in tools"
          :key="t.id"
          type="button"
          @click="openTool(t)"
          class="tool-card text-left bg-white rounded-2xl border border-orange-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div
            class="w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform"
            :class="t.tint"
          >
            <svg
              class="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.85"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path v-for="(d, i) in t.paths" :key="i" :d="d" />
            </svg>
          </div>
          <div class="font-bold text-gray-800">{{ t.title }}</div>
          <div class="text-sm text-gray-500 mt-1">{{ t.desc }}</div>
          <div class="text-xs text-orange-600 mt-3 font-medium">点击进入 →</div>
        </button>
      </div>
    </div>

    <!-- 随机点名 -->
    <div v-if="showRandom" class="fixed inset-0 z-50 bg-slate-900/95 text-white flex flex-col items-center justify-center p-6" @keydown.esc="showRandom=false">
      <button class="absolute top-4 right-4 text-white/70" @click="showRandom=false">关闭</button>
      <button class="absolute top-4 left-4 text-white/70" @click="goFullscreen()">全屏</button>
      <div class="text-sm text-white/60 mb-4">随机点名</div>
      <div class="text-6xl md:text-8xl font-black tracking-wide mb-10 min-h-[1.2em]">{{ rollName }}</div>
      <div class="flex gap-3">
        <button @click="startRoll" class="px-8 py-3 rounded-2xl bg-orange-500 font-bold" :disabled="rolling">{{ rolling ? '点名中…' : '开始点名' }}</button>
      </div>
    </div>

    <!-- 计时器 -->
    <div v-if="showTimer" class="fixed inset-0 z-50 bg-slate-900/95 text-white flex flex-col items-center justify-center p-6">
      <button class="absolute top-4 right-4 text-white/70" @click="stopTimer(); showTimer=false">关闭</button>
      <div class="flex gap-2 mb-6">
        <button class="px-3 py-1 rounded-lg" :class="timerMode==='down'?'bg-orange-500':'bg-white/10'" @click="timerMode='down'; resetTimer()">倒计时</button>
        <button class="px-3 py-1 rounded-lg" :class="timerMode==='up'?'bg-orange-500':'bg-white/10'" @click="timerMode='up'; timerLeft=0; stopTimer()">正计时</button>
      </div>
      <div v-if="timerMode==='down' && !timerRunning" class="mb-4 flex items-center gap-2">
        <input v-model.number="timerSeconds" type="number" min="1" class="w-24 text-center text-black rounded-lg px-2 py-1" />
        <span class="text-white/60 text-sm">秒</span>
      </div>
      <div class="text-7xl md:text-8xl font-black tabular-nums mb-8">{{ fmt(timerLeft) }}</div>
      <div class="flex gap-3">
        <button v-if="!timerRunning" @click="startTimer" class="px-6 py-3 rounded-2xl bg-orange-500 font-bold">开始</button>
        <button v-else @click="stopTimer" class="px-6 py-3 rounded-2xl bg-white/20 font-bold">暂停</button>
        <button @click="resetTimer" class="px-6 py-3 rounded-2xl bg-white/10 font-bold">复位</button>
      </div>
    </div>

    <!-- 表格记分 -->
    <div v-if="showTable" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" @click.self="showTable=false">
      <div class="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h3 class="text-lg font-bold mb-2 flex items-center gap-2">
          <span class="inline-flex w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-sky-500 items-center justify-center">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 5h16v14H4z" /><path d="M4 10h16" /><path d="M4 15h16" /><path d="M10 5v14" /><path d="M15 5v14" />
            </svg>
          </span>
          表格批量记分
        </h3>
        <p class="text-sm text-gray-500 mb-3">每行一个姓名（可从 Excel / 微信群复制粘贴）</p>
        <textarea v-model="tableText" rows="8" class="w-full border rounded-xl px-3 py-2 text-sm font-mono" placeholder="张小明&#10;李小红"></textarea>
        <div class="flex gap-3 mt-3">
          <input v-model.number="tablePoints" type="number" class="w-24 border rounded-xl px-3 py-2" />
          <input v-model="tableReason" class="flex-1 border rounded-xl px-3 py-2 text-sm" placeholder="原因" />
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showTable=false" class="px-4 py-2 text-gray-500">取消</button>
          <button @click="submitTable" class="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold">提交记分</button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>
