<script setup lang="ts">
import { onActivated, onMounted } from 'vue'
import { useClasses } from '@/composables/useClasses'
import { useTheme, type ThemeId } from '@/composables/useTheme'
import Header from './Header.vue'
import Footer from './Footer.vue'
import { watch } from 'vue'

defineProps<{
  contentClass?: string
  transparent?: boolean
  noPadding?: boolean
}>()

const { syncCurrentClass, currentClass } = useClasses()
const { setTheme } = useTheme()

function syncThemeFromClass() {
  const t = (currentClass.value as any)?.ui_theme as ThemeId | undefined
  if (t) setTheme(t)
}

onActivated(() => {
  syncCurrentClass()
  syncThemeFromClass()
})

onMounted(syncThemeFromClass)
watch(currentClass, syncThemeFromClass)
</script>

<template>
  <div
    class="min-h-screen flex flex-col theme-page-bg"
    :class="transparent ? '' : ''"
    :style="transparent ? undefined : undefined"
  >
    <Header />
    <main class="flex-1" :class="[noPadding ? '' : 'p-5 md:p-6', contentClass]">
      <slot />
    </main>
    <Footer />
  </div>
</template>
