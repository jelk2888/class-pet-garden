<script setup lang="ts">
import { onActivated } from 'vue'
import { useClasses } from '@/composables/useClasses'
import Header from './Header.vue'
import Footer from './Footer.vue'

defineProps<{
  contentClass?: string
  transparent?: boolean
  noPadding?: boolean
}>()

const { syncCurrentClass } = useClasses()

onActivated(() => {
  syncCurrentClass()
})
</script>

<template>
  <div
    class="min-h-screen flex flex-col"
    :class="transparent ? '' : 'bg-[radial-gradient(ellipse_at_top,_#fff7ed_0%,_#fdf2f8_40%,_#f0f9ff_100%)]'"
  >
    <Header />
    <main class="flex-1" :class="[noPadding ? '' : 'p-5 md:p-6', contentClass]">
      <slot />
    </main>
    <Footer />
  </div>
</template>
