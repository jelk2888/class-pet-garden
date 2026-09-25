<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useTeacherAccounts } from '@/composables/useTeacherAccounts'
import { useLoginModal } from '@/composables/useLoginModal'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { username, isGuest, logout } = useAuth()
const { others, prepareSwitch, removeRecent, recentTeachers } = useTeacherAccounts()
const { openLoginModal } = useLoginModal()

const newName = ref('')

watch(() => props.show, (v) => {
  if (v) newName.value = ''
})

function switchTo(name: string) {
  prepareSwitch(name)
  logout()
  emit('close')
  openLoginModal()
}

function switchToNew() {
  const name = newName.value.trim()
  if (!name) return
  switchTo(name)
}

function loginOther() {
  prepareSwitch('')
  logout()
  emit('close')
  openLoginModal()
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
            <h3 class="text-lg font-bold text-gray-800">切换教师</h3>
            <button class="text-gray-400 hover:text-gray-600 text-xl" @click="emit('close')">×</button>
          </div>

          <p class="text-sm text-gray-500 mb-3">
            当前：<span class="font-medium text-gray-800">{{ isGuest ? '游客' : username }}</span>
            <span class="text-gray-400"> · 本机记住最近登录的教师账号，方便科任老师快速切换</span>
          </p>

          <ul v-if="others.length" class="space-y-2 mb-4">
            <li
              v-for="t in others"
              :key="t.username"
              class="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-orange-50"
            >
              <button class="flex-1 text-left font-medium text-gray-800" @click="switchTo(t.username)">
                {{ t.username }}
              </button>
              <button class="text-xs text-gray-400 hover:text-red-500 px-2" @click="removeRecent(t.username)">清除</button>
            </li>
          </ul>
          <p v-else-if="recentTeachers.length <= 1" class="text-sm text-gray-400 mb-4">
            暂无其他教师账号。登录过的账号会出现在这里。
          </p>

          <div class="flex gap-2 mb-3">
            <input
              v-model="newName"
              type="text"
              placeholder="输入要切换的教师用户名"
              class="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              @keyup.enter="switchToNew"
            />
            <button
              class="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium disabled:opacity-50"
              :disabled="!newName.trim()"
              @click="switchToNew"
            >切换</button>
          </div>

          <button
            class="w-full py-2.5 rounded-xl border border-orange-200 text-orange-600 text-sm hover:bg-orange-50"
            @click="loginOther"
          >
            登录其他账号…
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
