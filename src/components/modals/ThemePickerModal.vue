<script setup lang="ts">
import { THEME_OPTIONS, type ThemeId, useTheme } from '@/composables/useTheme'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; select: [id: ThemeId] }>()
const { currentTheme } = useTheme()

function pick(id: ThemeId) {
  emit('select', id)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        @click.self="emit('close')"
      >
        <div class="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-auto">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-bold text-gray-800">班级页面样式</h3>
            <button class="text-gray-400 hover:text-gray-600 text-xl" @click="emit('close')">×</button>
          </div>
          <p class="text-sm text-gray-500 mb-4">为当前班级选择一套配色，顶栏、导航、背景与主按钮会一起切换。</p>
          <div class="grid gap-3">
            <button
              v-for="t in THEME_OPTIONS"
              :key="t.id"
              type="button"
              class="text-left rounded-2xl border p-3.5 hover:shadow-md transition flex items-center gap-3"
              :class="currentTheme === t.id ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-100'"
              @click="pick(t.id)"
            >
              <div class="flex gap-1 shrink-0">
                <span
                  v-for="(c, i) in t.swatch"
                  :key="i"
                  class="w-5 h-8 rounded-md"
                  :style="{ background: c }"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-gray-800">{{ t.name }}</div>
                <div class="text-xs text-gray-500 mt-0.5">{{ t.desc }}</div>
              </div>
              <span v-if="currentTheme === t.id" class="text-xs text-orange-600 font-medium">使用中</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
