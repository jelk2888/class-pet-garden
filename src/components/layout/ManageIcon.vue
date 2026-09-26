<script setup lang="ts">
defineProps<{
  name: 'students' | 'rules' | 'levels' | 'groups' | 'teachers' | 'badges' | 'class'
}>()
</script>

<template>
  <svg
    class="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'students'">
      <path d="M8 7h8" />
      <path d="M8 12h8" />
      <path d="M8 17h5" />
      <rect x="4" y="3" width="16" height="18" rx="2" />
    </template>
    <template v-else-if="name === 'rules'">
      <path d="M13 2 4 14h7l-1 8 10-14h-7l1-8Z" />
    </template>
    <template v-else-if="name === 'levels'">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </template>
    <template v-else-if="name === 'groups'">
      <circle cx="9" cy="8" r="2.5" />
      <circle cx="16" cy="9" r="2.2" />
      <path d="M3.5 18.5c.8-2.8 2.6-4 5.5-4s4.7 1.2 5.5 4" />
      <path d="M14 18.5c.4-1.8 1.5-2.8 3.5-3" />
    </template>
    <template v-else-if="name === 'teachers'">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v15H6.5A2.5 2.5 0 0 1 4 14.5v-10A2.5 2.5 0 0 1 6.5 2Z" />
      <path d="M12 7v5" />
      <path d="M9.5 9.5 12 7l2.5 2.5" />
    </template>
    <template v-else-if="name === 'badges'">
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
    </template>
    <template v-else-if="name === 'class'">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </template>
  </svg>
</template>
