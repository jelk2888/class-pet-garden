<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageLayout from '@/components/layout/PageLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useLoginModal } from '@/composables/useLoginModal'
import AuthModal from '@/components/AuthModal.vue'
import ClassModal from '@/components/modals/ClassModal.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const { api, isGuest } = useAuth()
const { classes, currentClass, loadClasses, createClass, init } = useClasses()
const { showLoginModal, closeLoginModal, openLoginModal } = useLoginModal()
const toast = useToast()

const loading = ref(true)
const desktopDownloads = ref<{ id: string; name: string; url: string; size?: number; note?: string }[]>([])
const stats = ref({
  studentCount: 0,
  withPet: 0,
  graduated: 0,
  todayEvals: 0,
  totalPoints: 0,
  badgeCount: 0,
  injured: 0,
  dead: 0,
})
const topStudents = ref<any[]>([])
const showClassModal = ref(false)

const tips = [
  { icon: '①', title: '创建班级', desc: '先建一个班级作为成长空间', action: 'createClass', label: '去创建' },
  { icon: '②', title: '导入学生', desc: '添加名单，让每位同学领养宠物', action: '/students', label: '学生管理' },
  { icon: '③', title: '课堂评价', desc: '在宠物教室随手加分，看见进步', action: '/', label: '进入教室' },
]

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return '上午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

async function loadOverview() {
  loading.value = true
  try {
    if (!currentClass.value) {
      stats.value = { studentCount: 0, withPet: 0, graduated: 0, todayEvals: 0, totalPoints: 0, badgeCount: 0, injured: 0, dead: 0 }
      topStudents.value = []
      return
    }
    const res = await api.get(`/classes/${currentClass.value.id}/overview`)
    stats.value = res.data.stats
    topStudents.value = res.data.topStudents || []
  } catch (e) {
    // fallback: derive from students list if overview API missing
    try {
      if (!currentClass.value) return
      const [stuRes, rankRes] = await Promise.all([
        api.get(`/classes/${currentClass.value.id}/students`),
        api.get(`/settings/ranking/${currentClass.value.id}`).catch(() => null),
      ])
      const students = stuRes.data.students || []
      stats.value = {
        studentCount: students.length,
        withPet: students.filter((s: any) => s.pet_type).length,
        graduated: students.filter((s: any) => (s.pet_level || 1) >= 8).length,
        todayEvals: 0,
        totalPoints: students.reduce((a: number, s: any) => a + (s.total_points || 0), 0),
        badgeCount: students.reduce((a: number, s: any) => a + (s.badge_count || 0), 0),
        injured: students.filter((s: any) => s.pet_status === 'injured').length,
        dead: students.filter((s: any) => s.pet_status === 'dead').length,
      }
      topStudents.value = (rankRes?.data?.ranking || students)
        .slice()
        .sort((a: any, b: any) => (b.total_points || 0) - (a.total_points || 0))
        .slice(0, 5)
    } catch {
      console.error(e)
    }
  } finally {
    loading.value = false
  }
}

async function handleCreateClass(name: string) {
  if (!name.trim()) return
  if (isGuest.value) {
    toast.warning('请先登录后再创建班级')
    openLoginModal()
    return
  }
  try {
    await createClass(name.trim())
    showClassModal.value = false
    toast.success('班级创建成功！')
    await loadClasses()
    router.push('/students')
  } catch {
    toast.error('创建失败')
  }
}

function runTip(tip: (typeof tips)[0]) {
  if (tip.action === 'createClass') {
    if (isGuest.value) {
      openLoginModal()
      return
    }
    showClassModal.value = true
    return
  }
  router.push(tip.action)
}

function handleLogin() {
  closeLoginModal()
  window.location.reload()
}

function formatSize(n?: number) {
  if (!n || n <= 0) return ''
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

async function loadDesktopDownloads() {
  try {
    const res = await api.get('/downloads')
    const items = res.data?.items || []
    desktopDownloads.value = items.filter((x: any) => x.url)
  } catch {
    // 兼容仅有静态文件、无 API 的情况
    desktopDownloads.value = [
      { id: 'win7', name: 'Win7 客户端', url: '/downloads/班级宠物园-Win7客户端.exe', note: 'Windows 7' },
      { id: 'win10', name: 'Win10 客户端', url: '/downloads/班级宠物园-Win10客户端.exe', note: 'Windows 10/11' },
    ]
  }
}

watch(currentClass, () => loadOverview())

onMounted(async () => {
  await init()
  await Promise.all([loadOverview(), loadDesktopDownloads()])
})
</script>

<template>
  <PageLayout>
    <div class="max-w-6xl mx-auto space-y-6">
      <!-- Hero -->
      <section class="relative overflow-hidden rounded-3xl text-white p-6 md:p-8 theme-hero">
        <div class="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl"></div>
        <div class="absolute right-16 bottom-0 w-28 h-28 rounded-full bg-amber-300/20 blur-xl"></div>
        <div class="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p class="text-white/80 text-sm mb-1">{{ greeting }}，东郭工作室 · 班级宠物园</p>
            <h1 class="text-2xl md:text-3xl font-bold tracking-tight">
              {{ currentClass?.name || '欢迎回来' }}
            </h1>
            <p class="mt-2 text-white/85 text-sm md:text-base max-w-xl">
              以学养宠，以宠励学 —— 把每一次课堂鼓励，变成看得见的成长。科任老师邀请码入班后也可加扣分。
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <router-link to="/wizard" class="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition">🧭 开班向导</router-link>
            <router-link to="/" class="px-4 py-2 rounded-xl bg-white font-semibold text-sm shadow hover:shadow-md transition theme-link">🐾 进入宠物教室</router-link>
            <router-link to="/ranking" class="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition">🏆 排行榜</router-link>
            <a
              v-for="d in desktopDownloads"
              :key="d.id"
              :href="d.url"
              class="px-4 py-2 rounded-xl bg-amber-300 text-amber-950 font-semibold text-sm shadow hover:bg-amber-200 transition"
              :title="d.note || d.name"
            >💻 {{ d.id === 'win7' ? '下载 Win7 客户端' : d.id === 'win10' ? '下载 Win10 客户端' : d.name }}</a>
          </div>
        </div>
      </section>

      <!-- Empty onboard -->
      <section v-if="!classes.length" class="grid md:grid-cols-3 gap-4">
        <button
          v-for="tip in tips"
          :key="tip.icon"
          @click="runTip(tip)"
          class="text-left bg-white rounded-2xl p-5 border border-sky-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <div class="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold mb-3">{{ tip.icon }}</div>
          <h3 class="font-bold text-gray-800">{{ tip.title }}</h3>
          <p class="text-sm text-gray-500 mt-1 mb-3">{{ tip.desc }}</p>
          <span class="text-sm text-sky-600 font-medium">{{ tip.label }} →</span>
        </button>
      </section>

      <section v-if="!classes.length && desktopDownloads.length" class="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
        <h2 class="font-bold text-gray-800 mb-2">💻 一键到桌面</h2>
        <p class="text-sm text-gray-500 mb-3">下载客户端后可在桌面完成班级登录与管理员管理。</p>
        <div class="flex flex-wrap gap-2">
          <a
            v-for="d in desktopDownloads"
            :key="'empty-' + d.id"
            :href="d.url"
            class="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
          >{{ d.id === 'win7' ? 'Win7 客户端' : d.id === 'win10' ? 'Win10 客户端' : d.name }} ↓</a>
        </div>
      </section>

      <!-- Stats -->
      <section v-else class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div class="stat-card">
          <div class="stat-label">学生人数</div>
          <div class="stat-value">{{ stats.studentCount }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已领养</div>
          <div class="stat-value text-sky-600">{{ stats.withPet }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">今日评价</div>
          <div class="stat-value text-amber-600">{{ stats.todayEvals }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">毕业徽章</div>
          <div class="stat-value text-rose-500">{{ stats.graduated }}</div>
        </div>
      </section>

      <div v-if="classes.length" class="grid lg:grid-cols-5 gap-4">
        <!-- Quick links -->
        <section class="lg:col-span-2 bg-white rounded-2xl border border-sky-100 p-5 shadow-sm">
          <h2 class="font-bold text-gray-800 mb-4">快捷入口</h2>
          <div class="grid grid-cols-2 gap-3">
            <router-link to="/" class="quick-tile">🐾<span>宠物教室</span></router-link>
            <router-link to="/students" class="quick-tile">👥<span>学生管理</span></router-link>
            <router-link to="/tasks" class="quick-tile">✅<span>任务中心</span></router-link>
            <router-link to="/toolbox" class="quick-tile">🧰<span>老师工具箱</span></router-link>
            <router-link to="/groups" class="quick-tile">🐣<span>一组一宠</span></router-link>
            <router-link to="/shop" class="quick-tile">🛒<span>积分商城</span></router-link>
            <router-link to="/honors" class="quick-tile">🎖️<span>荣誉墙</span></router-link>
          </div>

          <!-- 一键到桌面：客户端下载 -->
          <div class="mt-5 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 class="font-bold text-gray-800 text-sm">💻 一键到桌面</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  下载 Win7 / Win10 客户端，班级登录与管理员系统管理均可在桌面完成。首次打开请填写服务器地址。
                </p>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <a
                v-for="d in desktopDownloads"
                :key="'card-' + d.id"
                :href="d.url"
                class="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-amber-100 hover:border-orange-300 hover:shadow-sm transition text-sm"
              >
                <span class="font-medium text-gray-800">
                  {{ d.id === 'win7' ? 'Windows 7 客户端' : d.id === 'win10' ? 'Windows 10/11 客户端' : d.name }}
                </span>
                <span class="text-xs text-orange-600 font-semibold">
                  {{ formatSize(d.size) || '下载 EXE' }} ↓
                </span>
              </a>
              <p v-if="!desktopDownloads.length" class="text-xs text-gray-400">客户端打包后将出现在此处</p>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
            <div class="rounded-xl bg-amber-50 py-2"><div class="text-lg font-bold text-amber-600">{{ stats.injured }}</div>受伤</div>
            <div class="rounded-xl bg-slate-50 py-2"><div class="text-lg font-bold text-slate-600">{{ stats.dead }}</div>阵亡</div>
            <div class="rounded-xl bg-emerald-50 py-2"><div class="text-lg font-bold text-emerald-600">{{ stats.totalPoints }}</div>总积分</div>
          </div>
        </section>

        <!-- Top students -->
        <section class="lg:col-span-3 bg-white rounded-2xl border border-sky-100 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-gray-800">积分先锋</h2>
            <router-link to="/ranking" class="text-sm text-sky-600 hover:underline">完整榜单</router-link>
          </div>
          <div v-if="loading" class="text-gray-400 text-sm py-8 text-center">加载中…</div>
          <div v-else-if="!topStudents.length" class="text-gray-400 text-sm py-8 text-center">还没有学生数据</div>
          <div v-else class="space-y-2">
            <div
              v-for="(s, i) in topStudents"
              :key="s.id"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sky-50 transition-colors"
            >
              <span
                class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                :class="i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-sky-100 text-sky-700'"
              >{{ i + 1 }}</span>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 truncate">{{ s.name }}</div>
                <div class="text-xs text-gray-400">Lv.{{ s.pet_level || 1 }} · {{ s.pet_type || '未领养' }}</div>
              </div>
              <div class="font-bold text-sky-600">{{ s.total_points || 0 }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <AuthModal :show="showLoginModal" @close="closeLoginModal" @login="handleLogin" />
    <ClassModal :show="showClassModal" @close="showClassModal = false" @submit="handleCreateClass" />
  </PageLayout>
</template>

<style scoped>
.stat-card {
  @apply bg-white rounded-2xl border border-sky-100 px-4 py-4 shadow-sm;
}
.stat-label {
  @apply text-xs text-gray-500 mb-1;
}
.stat-value {
  @apply text-2xl font-bold text-gray-800;
}
.quick-tile {
  @apply flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-gradient-to-br from-sky-50 to-cyan-50 border border-sky-100 text-sm font-medium text-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all;
}
</style>
