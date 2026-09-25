<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { api, isGuest } = useAuth()
const { currentClass, loadClasses } = useClasses()
const toast = useToast()

const teachers = ref<any[]>([])
const inviteCode = ref('')
const isOwner = ref(false)
const loading = ref(false)

const className = computed(() => currentClass.value?.name || '')

async function load() {
  if (!currentClass.value || isGuest.value) return
  loading.value = true
  try {
    const res = await api.get(`/classes/${currentClass.value.id}/teachers`)
    teachers.value = res.data.teachers || []
    inviteCode.value = res.data.invite_code || currentClass.value.invite_code || ''
    isOwner.value = !!res.data.is_owner
  } catch (e: any) {
    toast.error(e.response?.data?.error || '加载教师列表失败')
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (v) => {
  if (v) load()
})

async function copyCode() {
  if (!inviteCode.value) return
  try {
    await navigator.clipboard.writeText(inviteCode.value)
    toast.success('邀请码已复制')
  } catch {
    toast.warning('复制失败，请手动选择邀请码')
  }
}

async function resetCode() {
  if (!currentClass.value) return
  if (!confirm('旧邀请码将立即失效，确定重置？')) return
  try {
    const res = await api.post(`/classes/${currentClass.value.id}/invite-code/reset`)
    inviteCode.value = res.data.invite_code
    toast.success('邀请码已重置')
    await loadClasses()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '重置失败')
  }
}

async function removeTeacher(t: any) {
  if (!currentClass.value) return
  if (!confirm(`确定将「${t.username}」移出本班？`)) return
  try {
    await api.delete(`/classes/${currentClass.value.id}/teachers/${t.user_id}`)
    toast.success('已移除')
    await load()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '移除失败')
  }
}

async function leaveClass() {
  if (!currentClass.value) return
  if (!confirm(`确定离开「${className.value}」？离开后将无法再给学生加分。`)) return
  try {
    await api.post(`/classes/${currentClass.value.id}/leave`)
    toast.success('已离开班级')
    emit('close')
    await loadClasses()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '离开失败')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        @click.self="emit('close')"
      >
        <div class="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">本班教师 · {{ className }}</h3>
            <button class="text-gray-400 hover:text-gray-600 text-xl" @click="emit('close')">×</button>
          </div>

          <div v-if="isOwner && inviteCode" class="mb-5 p-4 rounded-2xl bg-orange-50 border border-orange-100">
            <div class="text-xs text-orange-600 mb-1 font-medium">班级邀请码（分享给任课教师）</div>
            <div class="flex items-center gap-2">
              <span class="text-2xl font-bold tracking-widest text-orange-700">{{ inviteCode }}</span>
              <button class="text-sm px-2 py-1 rounded-lg bg-white border hover:bg-orange-50" @click="copyCode">复制</button>
              <button class="text-sm px-2 py-1 rounded-lg bg-white border hover:bg-orange-50" @click="resetCode">重置</button>
            </div>
          </div>

          <div v-if="loading" class="text-sm text-gray-400 py-6 text-center">加载中…</div>
          <ul v-else class="space-y-2">
            <li
              v-for="t in teachers"
              :key="t.id"
              class="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50"
            >
              <div>
                <span class="font-medium text-gray-800">{{ t.username }}</span>
                <span
                  class="ml-2 text-xs px-1.5 py-0.5 rounded"
                  :class="t.role === 'owner' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'"
                >{{ t.role === 'owner' ? '班主任' : '任教' }}</span>
              </div>
              <button
                v-if="isOwner && t.role !== 'owner'"
                class="text-xs text-red-500 hover:underline"
                @click="removeTeacher(t)"
              >移除</button>
            </li>
            <li v-if="!teachers.length" class="text-sm text-gray-400 text-center py-4">暂无教师</li>
          </ul>

          <button
            v-if="!isOwner && currentClass"
            class="mt-5 w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm hover:bg-red-50"
            @click="leaveClass"
          >
            离开本班
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
