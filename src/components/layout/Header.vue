<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useLoginModal } from '@/composables/useLoginModal'
import { rememberLoggedInTeacher } from '@/composables/useTeacherAccounts'
import ClassModal from '@/components/modals/ClassModal.vue'
import RewardModal from '@/components/modals/RewardModal.vue'
import JoinClassModal from '@/components/modals/JoinClassModal.vue'
import ClassTeachersModal from '@/components/modals/ClassTeachersModal.vue'
import SwitchTeacherModal from '@/components/modals/SwitchTeacherModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

defineProps<{ batchMode?: boolean }>()

const route = useRoute()
const router = useRouter()
const { logout, isGuest, isAdmin, username, isLoggedIn } = useAuth()
const { classes, currentClass, selectClass, loadClasses, createClass: doCreateClass, updateClass: doUpdateClass, deleteClass: doDeleteClass, init } = useClasses()
const toast = useToast()
const { confirmDialog, showConfirm, closeConfirm } = useConfirm()
const { openLoginModal } = useLoginModal()

const showUserMenu = ref(false)
const showClassSelect = ref(false)
const showClassModal = ref(false)
const showRewardModal = ref(false)
const showMoreNav = ref(false)
const showJoinModal = ref(false)
const showTeachersModal = ref(false)
const showSwitchTeacher = ref(false)
const editingClass = ref<any>(null)

const roleLabel = computed(() => {
  if (!currentClass.value) return ''
  if (currentClass.value.is_owner || currentClass.value.role === 'owner') return '班主任'
  if (currentClass.value.role === 'teacher') return '任教'
  return ''
})

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}

function handleLogin() {
  showUserMenu.value = false
  openLoginModal()
}

function handleLogout() {
  logout()
  showUserMenu.value = false
  window.location.reload()
}

function openSwitchTeacher() {
  showUserMenu.value = false
  showSwitchTeacher.value = true
}

function openJoinClass() {
  showClassSelect.value = false
  if (isGuest.value) {
    toast.warning('请先登录后再用邀请码入班')
    openLoginModal()
    return
  }
  showJoinModal.value = true
}

function openTeachers() {
  showClassSelect.value = false
  if (!currentClass.value) return
  if (isGuest.value) {
    toast.warning('请先登录')
    openLoginModal()
    return
  }
  showTeachersModal.value = true
}

function handleSelectClass(cls: any) {
  selectClass(cls)
  showClassSelect.value = false
}

function openCreateClassModal() {
  editingClass.value = null
  showClassSelect.value = false
  showClassModal.value = true
}

function openEditClassModal() {
  if (!currentClass.value) return
  editingClass.value = currentClass.value
  showClassSelect.value = false
  showClassModal.value = true
}

function handleDeleteClass() {
  if (!currentClass.value) return
  if (isGuest.value) {
    toast.warning('游客无法删除班级，请先注册登录')
    showClassSelect.value = false
    openLoginModal()
    return
  }
  if (currentClass.value.role === 'teacher' && !currentClass.value.is_owner) {
    toast.warning('任教教师不能删除班级，可由班主任删除，或你自行「离开本班」')
    showClassSelect.value = false
    return
  }
  showClassSelect.value = false
  showConfirm({
    title: '删除班级',
    message: '确定删除该班级？所有学生数据将一并删除！',
    confirmText: '删除',
    type: 'danger',
    onConfirm: async () => {
      try {
        await doDeleteClass(currentClass.value!.id)
        toast.success('班级删除成功！')
        await loadClasses()
      } catch {
        toast.error('删除失败')
      }
    },
  })
}

async function handleClassSubmit(name: string) {
  if (!name.trim()) {
    toast.warning('请输入班级名称')
    return
  }
  try {
    if (editingClass.value) {
      await doUpdateClass(editingClass.value.id, name.trim())
      toast.success('班级更新成功！')
    } else {
      await doCreateClass(name.trim())
      toast.success('班级创建成功！')
      router.push('/wizard')
    }
    showClassModal.value = false
    editingClass.value = null
    await loadClasses()
  } catch {
    toast.error(editingClass.value ? '更新班级失败' : '创建班级失败')
  }
}

onMounted(() => {
  init()
  if (isLoggedIn.value && username.value) {
    rememberLoggedInTeacher(username.value)
  }
})
</script>

<template>
  <header class="sticky top-0 z-50 shadow-lg">
    <div class="bg-gradient-to-r from-orange-400 via-rose-400 to-pink-500">
      <div class="px-4 py-3 flex items-center justify-between gap-3">
        <router-link to="/overview" class="flex items-center gap-2 text-white font-bold hover:opacity-90 shrink-0">
          <img src="/logo.png" alt="东郭工作室" class="w-9 h-9 rounded-lg shadow object-cover bg-white/90" />
          <span class="text-lg drop-shadow hidden sm:inline">东郭工作室·班级宠物园</span>
          <span class="text-lg drop-shadow sm:hidden">班级宠物园</span>
        </router-link>

        <div class="flex items-center gap-2 sm:gap-3">
          <span v-if="isGuest" class="hidden md:inline text-xs text-white/80">游客模式，请登录后使用完整功能</span>

          <div class="relative">
            <button
              @click="showClassSelect = !showClassSelect"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/20 text-white hover:bg-white/30"
            >
              <span>📚</span>
              <span class="max-w-[7rem] truncate">{{ currentClass?.name || '选择班级' }}</span>
              <span v-if="roleLabel" class="text-[10px] px-1 py-0.5 rounded bg-white/25">{{ roleLabel }}</span>
              <span class="opacity-70">▾</span>
            </button>
            <div v-if="showClassSelect" @click="showClassSelect = false" class="fixed inset-0 z-40"></div>
            <div v-if="showClassSelect" class="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border py-1.5 w-60 z-50 overflow-hidden text-gray-800">
              <div class="max-h-48 overflow-auto">
                <button
                  v-for="cls in classes"
                  :key="cls.id"
                  @click="handleSelectClass(cls)"
                  class="w-full text-left px-4 py-2 text-sm hover:bg-orange-50 flex items-center justify-between gap-2"
                  :class="currentClass?.id === cls.id ? 'bg-orange-50 text-orange-600 font-medium' : ''"
                >
                  <span class="truncate">{{ cls.name }}</span>
                  <span
                    v-if="cls.role === 'teacher'"
                    class="shrink-0 text-[10px] px-1 rounded bg-sky-100 text-sky-600"
                  >任教</span>
                  <span
                    v-else-if="cls.is_owner || cls.role === 'owner'"
                    class="shrink-0 text-[10px] px-1 rounded bg-orange-100 text-orange-600"
                  >班主任</span>
                </button>
                <div v-if="!classes.length" class="px-4 py-2 text-sm text-gray-400">暂无班级</div>
              </div>
              <div class="border-t border-gray-100 pt-1">
                <button @click="openCreateClassModal" class="w-full text-left px-4 py-2 text-sm hover:bg-orange-50">➕ 新建班级</button>
                <button @click="openJoinClass" class="w-full text-left px-4 py-2 text-sm hover:bg-orange-50">🔑 邀请码入班</button>
                <button v-if="currentClass" @click="openTeachers" class="w-full text-left px-4 py-2 text-sm hover:bg-orange-50">👩‍🏫 本班教师 / 邀请码</button>
                <button v-if="currentClass" @click="openEditClassModal" class="w-full text-left px-4 py-2 text-sm hover:bg-orange-50">✏️ 重命名</button>
                <button
                  v-if="currentClass && !isGuest && (currentClass.is_owner || currentClass.role === 'owner' || !currentClass.role)"
                  @click="handleDeleteClass"
                  class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                >🗑️ 删除班级</button>
                <div v-else-if="currentClass && isGuest" class="px-4 py-2 text-xs text-gray-400">游客不可删除班级（请登录）</div>
              </div>
            </div>
          </div>

          <button @click="openCreateClassModal" class="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white hover:bg-white/30">➕ 新建</button>
          <button @click="openJoinClass" class="hidden md:inline-flex px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white hover:bg-white/30">🔑 入班</button>

          <div class="relative">
            <button @click="showUserMenu = !showUserMenu" class="w-9 h-9 rounded-full bg-white/95 shadow flex items-center justify-center overflow-hidden">
              <span v-if="isGuest">👤</span>
              <span v-else class="w-full h-full rounded-full bg-gradient-to-r from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                {{ username.charAt(0).toUpperCase() }}
              </span>
            </button>
            <div v-if="showUserMenu" @click="showUserMenu = false" class="fixed inset-0 z-40"></div>
            <div v-if="showUserMenu" class="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border py-1.5 w-48 z-50 text-gray-800">
              <div class="px-3 py-2 text-sm text-gray-500 border-b">{{ isGuest ? '游客模式' : `已登录: ${username}` }}</div>
              <button v-if="isGuest" @click="handleLogin" class="w-full text-left px-3 py-2 text-sm hover:bg-orange-50">🔑 登录 / 注册</button>
              <template v-else>
                <button @click="openSwitchTeacher" class="w-full text-left px-3 py-2 text-sm hover:bg-orange-50">🔄 切换教师</button>
                <button @click="handleLogout" class="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50">🚪 退出登录</button>
              </template>
              <button @click="showRewardModal = true; showUserMenu = false" class="w-full text-left px-3 py-2 text-sm hover:bg-orange-50">ℹ️ 关于</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white/95 backdrop-blur border-b border-orange-100 px-2 sm:px-4">
      <nav class="flex items-center gap-0.5 overflow-x-auto py-1.5 text-sm no-scrollbar">
        <router-link to="/overview" class="nav-tab" :class="isActive('/overview') && 'nav-tab-active'">📊 总览</router-link>
        <router-link to="/wizard" class="nav-tab" :class="isActive('/wizard') && 'nav-tab-active'">🧭 开班向导</router-link>
        <router-link to="/" class="nav-tab" :class="isActive('/') && 'nav-tab-active'">🐾 宠物教室</router-link>
        <router-link to="/students" class="nav-tab" :class="isActive('/students') && 'nav-tab-active'">👥 学生</router-link>
        <router-link to="/ranking" class="nav-tab" :class="isActive('/ranking') && 'nav-tab-active'">🏆 排行</router-link>
        <router-link to="/tasks" class="nav-tab" :class="isActive('/tasks') && 'nav-tab-active'">✅ 任务</router-link>
        <router-link to="/honors" class="nav-tab" :class="isActive('/honors') && 'nav-tab-active'">🎖️ 荣誉墙</router-link>
        <router-link to="/groups" class="nav-tab" :class="isActive('/groups') && 'nav-tab-active'">🐣 一组一宠</router-link>
        <router-link to="/toolbox" class="nav-tab" :class="isActive('/toolbox') && 'nav-tab-active'">🧰 工具箱</router-link>
        <router-link to="/shop" class="nav-tab" :class="isActive('/shop') && 'nav-tab-active'">🛒 积分商城</router-link>

        <div class="relative ml-auto shrink-0">
          <button @click="showMoreNav = !showMoreNav" class="nav-tab">⋯ 更多</button>
          <div v-if="showMoreNav" @click="showMoreNav = false" class="fixed inset-0 z-40"></div>
          <div v-if="showMoreNav" class="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border py-1.5 w-40 z-50">
            <router-link to="/records" class="block px-3 py-2 text-sm hover:bg-orange-50" :class="isActive('/records') && 'text-orange-600 font-medium'">📋 评价记录</router-link>
            <router-link to="/preview" class="block px-3 py-2 text-sm hover:bg-orange-50" :class="isActive('/preview') && 'text-orange-600 font-medium'">📖 宠物图鉴</router-link>
            <router-link to="/settings" class="block px-3 py-2 text-sm hover:bg-orange-50" :class="isActive('/settings') && 'text-orange-600 font-medium'">⚙️ 规则设置</router-link>
            <router-link to="/posts" class="block px-3 py-2 text-sm hover:bg-orange-50" :class="isActive('/posts') && 'text-orange-600 font-medium'">💬 留言板</router-link>
            <router-link v-if="isAdmin" to="/admin" class="block px-3 py-2 text-sm hover:bg-orange-50" :class="isActive('/admin') && 'text-orange-600 font-medium'">🔐 系统管理</router-link>
          </div>
        </div>
      </nav>
    </div>
  </header>

  <ClassModal :show="showClassModal" :editing="editingClass" @close="showClassModal = false; editingClass = null" @submit="handleClassSubmit" />
  <RewardModal :show="showRewardModal" @close="showRewardModal = false" />
  <JoinClassModal :show="showJoinModal" @close="showJoinModal = false" @joined="loadClasses" />
  <ClassTeachersModal :show="showTeachersModal" @close="showTeachersModal = false" />
  <SwitchTeacherModal :show="showSwitchTeacher" @close="showSwitchTeacher = false" />
  <ConfirmDialog
    :show="confirmDialog.show"
    :title="confirmDialog.title"
    :message="confirmDialog.message"
    :confirm-text="confirmDialog.confirmText"
    :cancel-text="confirmDialog.cancelText"
    :type="confirmDialog.type"
    @confirm="confirmDialog.onConfirm"
    @cancel="closeConfirm"
  />
</template>

<style scoped>
.nav-tab {
  @apply px-3 py-1.5 rounded-lg whitespace-nowrap text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors shrink-0;
}
.nav-tab-active {
  @apply bg-orange-500 text-white font-semibold shadow-sm hover:bg-orange-500 hover:text-white;
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
