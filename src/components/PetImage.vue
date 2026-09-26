<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  src: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  rounded?: boolean
  roundedClass?: string
  hoverScale?: boolean
  showLoading?: boolean
  fixedEmojiSize?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  size: 'md',
  rounded: true,
  roundedClass: '',
  hoverScale: true,
  showLoading: true,
  fixedEmojiSize: false
})

const isLoaded = ref(false)
const hasError = ref(false)
const currentSrc = ref(props.src)
const triedFallback = ref(false)

watch(
  () => props.src,
  (v) => {
    currentSrc.value = v
    isLoaded.value = false
    hasError.value = false
    triedFallback.value = false
  }
)

const sizeClasses = computed(() => {
  const sizes: Record<string, string> = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    full: 'w-full h-full'
  }
  return sizes[props.size] || sizes.md
})

const roundedClass = computed(() => {
  if (props.roundedClass) return props.roundedClass
  return props.rounded ? 'rounded-full' : ''
})

const emojiSizeClass = computed(() => {
  if (props.fixedEmojiSize) {
    return 'text-xl'
  }
  const sizes: Record<string, string> = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
    full: 'text-6xl'
  }
  return sizes[props.size] || sizes.md
})

function onLoad() {
  isLoaded.value = true
}

function onError() {
  // 缺某级图时先回退到 lv1，减少全员变成狗脸 emoji
  if (!triedFallback.value && /\/lv\d+\.png(?:\?|$)/i.test(currentSrc.value)) {
    triedFallback.value = true
    currentSrc.value = currentSrc.value.replace(/\/lv\d+\.png/i, '/lv1.png')
    isLoaded.value = false
    hasError.value = false
    return
  }
  hasError.value = true
  isLoaded.value = true
}

const loadingEmojis = ['🐾', '🐕', '🐈', '🐇', '🐹', '🦆', '🦙', '🐼', '🐯', '🦄', '🐉', '🦅']
const randomEmoji = computed(() => loadingEmojis[Math.floor(Math.random() * loadingEmojis.length)])
</script>

<template>
  <div 
    class="relative overflow-hidden flex items-center justify-center"
    :class="[
      sizeClasses,
      roundedClass
    ]"
  >
    <Transition name="fade">
      <div 
        v-if="showLoading && !isLoaded" 
        class="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 to-pink-100"
      >
        <div class="flex flex-col items-center gap-2">
          <span :class="[emojiSizeClass, 'animate-bounce']">{{ randomEmoji }}</span>
          <div class="flex gap-1 text-xs">
            <span class="animate-pulse" style="animation-delay: 0ms">🐾</span>
            <span class="animate-pulse" style="animation-delay: 150ms">🐾</span>
            <span class="animate-pulse" style="animation-delay: 300ms">🐾</span>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div 
        v-if="hasError" 
        class="absolute inset-0 flex items-center justify-center bg-gray-100"
      >
        <span :class="[emojiSizeClass, 'text-gray-400']">🐾</span>
      </div>
    </Transition>

    <img
      :src="currentSrc"
      :alt="alt"
      loading="lazy"
      class="w-full h-full object-contain transition-all duration-300"
      :class="[
        isLoaded ? 'opacity-100' : 'opacity-0',
        hoverScale ? 'hover:scale-110' : ''
      ]"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
