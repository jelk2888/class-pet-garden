<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageLayout from './PageLayout.vue'

defineProps<{
  contentClass?: string
  noPadding?: boolean
}>()

const route = useRoute()
const embed = computed(() => !!route.meta.embed)
</script>

<template>
  <PageLayout v-if="!embed" :content-class="contentClass" :no-padding="noPadding">
    <slot />
  </PageLayout>
  <div v-else class="w-full">
    <slot />
  </div>
</template>
