<script setup lang="ts">
defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function close() {
  emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in text-center">
        <img src="/logo.png" alt="东郭工作室" class="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-md object-cover" />
        <h3 class="text-xl font-bold mb-2 text-gray-800">东郭工作室</h3>
        <p class="text-sm text-gray-500 mb-4">班级宠物园</p>
        <p class="text-gray-600 mb-6 leading-relaxed">
          本系统由东郭工作室维护与定制，将班级积分评价与虚拟宠物养成相结合，助力课堂激励与习惯养成。
        </p>
        <button
          @click="close"
          class="bg-gradient-to-r from-orange-400 to-pink-500 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
        >
          知道了
        </button>
      </div>
    </div>
  </Transition>
</template>
