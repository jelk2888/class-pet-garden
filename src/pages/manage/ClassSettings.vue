<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClasses } from '@/composables/useClasses'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useTheme, type ThemeId, THEME_OPTIONS } from '@/composables/useTheme'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const router = useRouter()
const { currentClass, updateClass, updateClassTheme, deleteClass, loadClasses } = useClasses()
const { api, isGuest } = useAuth()
const toast = useToast()
const { confirmDialog, showConfirm, closeConfirm } = useConfirm()
const { setTheme, currentTheme } = useTheme()

const editingName = ref(false)
const nameDraft = ref('')
const resetting = ref(false)

const canManageDanger = computed(() => {
  const c = currentClass.value
  if (!c || isGuest.value) return false
  return !!(c.is_owner || c.role === 'owner' || !c.role)
})

watch(
  currentClass,
  (c) => {
    nameDraft.value = c?.name || ''
    editingName.value = false
  },
  { immediate: true }
)

async function saveName() {
  if (!currentClass.value || !nameDraft.value.trim()) return
  try {
    await updateClass(currentClass.value.id, nameDraft.value.trim())
    toast.success('班级名称已更新')
    editingName.value = false
    await loadClasses()
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '保存失败')
  }
}

async function pickTheme(id: ThemeId) {
  setTheme(id)
  if (!currentClass.value) return
  try {
    await updateClassTheme(currentClass.value.id, id)
    toast.success('页面样式已更新')
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || ''
    toast.error(msg ? `样式保存失败：${msg}` : '样式保存失败')
  }
}

function handleResetPoints() {
  if (!currentClass.value || !canManageDanger.value) return
  const name = currentClass.value.name
  showConfirm({
    title: '班级积分重置',
    message: `将清空「${name}」全体学生的积分、经验与等级（宠物类型保留），并删除本班评价记录。此操作不可恢复，确定继续？`,
    confirmText: '确认重置',
    cancelText: '取消',
    type: 'warning',
    onConfirm: async () => {
      closeConfirm()
      resetting.value = true
      try {
        const res = await api.post(`/classes/${currentClass.value!.id}/reset-points`)
        toast.success(`已重置 ${res.data.students || 0} 名学生的积分`)
      } catch (e: any) {
        toast.error(e?.response?.data?.error || '重置失败')
      } finally {
        resetting.value = false
      }
    },
  })
}

function handleDelete() {
  if (!currentClass.value || !canManageDanger.value) return
  const name = currentClass.value.name
  showConfirm({
    title: '删除班级',
    message: `删除「${name}」后，所有学生、积分、宠物数据将永久丢失，不可恢复。确定继续？`,
    confirmText: '永久删除',
    cancelText: '取消',
    type: 'danger',
    onConfirm: async () => {
      closeConfirm()
      try {
        await deleteClass(currentClass.value!.id)
        toast.success('班级已删除')
        router.push('/overview')
      } catch (e: any) {
        toast.error(e?.response?.data?.error || '删除失败')
      }
    },
  })
}

onMounted(() => {
  /* keep */
})
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-5">
    <div>
      <h1 class="text-2xl font-bold text-gray-800">班级设置</h1>
      <p class="text-sm text-gray-500 mt-1">管理班级名称、页面样式、积分重置与危险操作。</p>
    </div>

    <div v-if="!currentClass" class="bg-white rounded-2xl p-10 text-center text-gray-400">请先选择班级</div>
    <template v-else>
      <section class="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
        <div class="text-xs font-semibold text-gray-400 mb-3">基本信息</div>
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="min-w-0 flex-1">
            <div class="text-xs text-gray-400 mb-1">班级名称</div>
            <input
              v-if="editingName"
              v-model="nameDraft"
              class="w-full max-w-xs border-2 border-gray-200 rounded-xl px-3 py-2 text-lg font-bold focus:outline-none focus:border-orange-400"
              @keyup.enter="saveName"
            />
            <div v-else class="text-xl font-bold text-gray-800 truncate">{{ currentClass.name }}</div>
          </div>
          <div class="flex gap-2">
            <template v-if="editingName">
              <button class="px-3 py-1.5 text-sm rounded-lg border" @click="editingName = false">取消</button>
              <button class="px-3 py-1.5 text-sm rounded-lg text-white font-medium" style="background: var(--accent)" @click="saveName">保存</button>
            </template>
            <button v-else class="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50" @click="editingName = true">编辑</button>
          </div>
        </div>
        <div class="mt-3 text-sm text-gray-500">学生数等数据请在「学生」中管理。</div>
      </section>

      <section class="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
        <div class="text-xs font-semibold text-gray-400 mb-3">页面样式</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            v-for="t in THEME_OPTIONS"
            :key="t.id"
            type="button"
            class="rounded-xl border-2 p-3 text-left transition"
            :class="currentTheme === t.id ? 'border-orange-400 ring-2 ring-orange-100' : 'border-transparent bg-gray-50 hover:bg-gray-100'"
            @click="pickTheme(t.id)"
          >
            <div class="flex gap-1 mb-2">
              <span class="w-4 h-4 rounded-full" :style="{ background: t.swatch[0] }" />
              <span class="w-4 h-4 rounded-full" :style="{ background: t.swatch[1] }" />
              <span class="w-4 h-4 rounded-full" :style="{ background: t.swatch[2] }" />
            </div>
            <div class="text-sm font-medium text-gray-800">{{ t.name }}</div>
          </button>
        </div>
      </section>

      <section v-if="canManageDanger" class="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
        <div class="text-xs font-semibold text-amber-600 mb-2">新学期 / 积分重置</div>
        <p class="text-sm text-gray-500 mb-3">
          清空本班全体学生积分、经验与等级，并删除评价记录。学生名单与宠物类型保留。
        </p>
        <button
          class="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-60"
          :disabled="resetting"
          @click="handleResetPoints"
        >
          班级积分重置
        </button>
      </section>

      <section v-if="canManageDanger" class="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
        <div class="text-xs font-semibold text-red-400 mb-2">危险操作</div>
        <p class="text-sm text-gray-500 mb-3">删除后所有学生、积分、宠物数据将永久丢失，不可恢复。</p>
        <button class="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600" @click="handleDelete">
          删除班级
        </button>
      </section>
      <p v-else-if="isGuest" class="text-xs text-gray-400">游客不可执行危险操作，请先登录。</p>
      <p v-else-if="currentClass.role === 'teacher'" class="text-xs text-sky-600">任教教师可加扣分，不可重置积分或删除班级。</p>
    </template>

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
  </div>
</template>
