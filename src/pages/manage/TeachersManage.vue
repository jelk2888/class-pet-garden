<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'

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

onMounted(load)
watch(currentClass, load)

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
    await loadClasses()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '离开失败')
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">科任老师</h1>
      <p class="text-sm text-gray-500 mt-1">邀请任课教师入班后可共同加扣分；班主任可管理成员与邀请码。</p>
    </div>

    <div v-if="isGuest" class="bg-white rounded-2xl p-8 text-center text-gray-400">请先登录后管理科任老师</div>
    <div v-else-if="!currentClass" class="bg-white rounded-2xl p-8 text-center text-gray-400">请先选择班级</div>
    <template v-else>
      <div v-if="isOwner && inviteCode" class="mb-5 p-5 rounded-2xl bg-orange-50 border border-orange-100">
        <div class="text-xs text-orange-600 mb-1 font-medium">班级邀请码（分享给任课教师）</div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-2xl font-bold tracking-widest text-orange-700">{{ inviteCode }}</span>
          <button class="text-sm px-3 py-1.5 rounded-lg bg-white border hover:bg-orange-50" @click="copyCode">复制</button>
          <button class="text-sm px-3 py-1.5 rounded-lg bg-white border hover:bg-orange-50" @click="resetCode">重置</button>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div v-if="loading" class="text-sm text-gray-400 py-10 text-center">加载中…</div>
        <ul v-else class="divide-y divide-gray-50">
          <li
            v-for="t in teachers"
            :key="t.id"
            class="flex items-center justify-between px-4 py-3.5"
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
          <li v-if="!teachers.length" class="text-sm text-gray-400 text-center py-8">暂无教师</li>
        </ul>
      </div>

      <button
        v-if="!isOwner"
        class="mt-5 w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm hover:bg-red-50"
        @click="leaveClass"
      >
        离开本班
      </button>
    </template>
  </div>
</template>
