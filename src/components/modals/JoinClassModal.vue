<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; joined: [] }>()

const { api, isGuest } = useAuth()
const { loadClasses, selectClass } = useClasses()
const toast = useToast()

const inviteCode = ref('')
const loading = ref(false)

watch(() => props.show, (v) => {
  if (v) inviteCode.value = ''
})

async function submit() {
  if (isGuest.value) {
    toast.warning('请先登录后再用邀请码入班')
    return
  }
  const code = inviteCode.value.trim().toUpperCase()
  if (code.length < 4) {
    toast.warning('请输入班级邀请码')
    return
  }
  loading.value = true
  try {
    const res = await api.post('/classes/join', { inviteCode: code })
    toast.success(res.data.message || '入班成功')
    await loadClasses()
    if (res.data.class) {
      await selectClass(res.data.class)
    }
    emit('joined')
    emit('close')
  } catch (e: any) {
    toast.error(e.response?.data?.error || '入班失败')
  } finally {
    loading.value = false
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
        <div class="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">教师入班</h3>
            <button class="text-gray-400 hover:text-gray-600 text-xl" @click="emit('close')">×</button>
          </div>
          <p class="text-sm text-gray-500 mb-4">
            向班主任索取<strong>班级邀请码</strong>，加入后即可给学生加分、评宠（任教教师权限）。
          </p>
          <label class="block text-sm text-gray-600 mb-1">邀请码</label>
          <input
            v-model="inviteCode"
            type="text"
            maxlength="12"
            placeholder="例如 AB3K9M"
            class="w-full px-4 py-3 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 tracking-widest uppercase text-center text-lg font-semibold"
            @keyup.enter="submit"
          />
          <button
            class="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-orange-400 to-rose-500 text-white font-semibold disabled:opacity-60"
            :disabled="loading"
            @click="submit"
          >
            {{ loading ? '加入中…' : '确认入班' }}
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
