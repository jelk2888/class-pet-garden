<script setup lang="ts">
defineProps<{
  name:
    | 'home'
    | 'wizard'
    | 'classroom'
    | 'ranking'
    | 'tasks'
    | 'honors'
    | 'toolbox'
    | 'shop'
    | 'manage'
    | 'more'
  class?: string
}>()
</script>

<template>
  <svg
    class="nav-icon"
    :class="$props.class"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 首页 -->
    <template v-if="name === 'home'">
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.8V20h11V9.8" />
      <path d="M10 20v-5.5h4V20" />
    </template>
    <!-- 开班向导 -->
    <template v-else-if="name === 'wizard'">
      <path d="m12 3 1.8 4.6L18.5 9l-3.8 2.9L16 17l-4-2.4L8 17l1.3-5.1L5.5 9l4.7-1.4L12 3Z" />
    </template>
    <!-- 宠物教室 -->
    <template v-else-if="name === 'classroom'">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <circle cx="9" cy="11" r="1.5" />
      <circle cx="15" cy="11" r="1.5" />
      <path d="M7 14.2c1-.9 2-.9 3-.9s2 0 3 .9" />
    </template>
    <!-- 排行 -->
    <template v-else-if="name === 'ranking'">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4.5a2 2 0 0 0 1.8 3.2" />
      <path d="M17 5h2.5a2 2 0 0 1-1.8 3.2" />
    </template>
    <!-- 任务 -->
    <template v-else-if="name === 'tasks'">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
      <path d="m7 8 .8.8L9.2 7.4" />
    </template>
    <!-- 荣誉墙 -->
    <template v-else-if="name === 'honors'">
      <circle cx="12" cy="8.5" r="4" />
      <path d="M9 12.2 7.8 20l4.2-2 4.2 2L15 12.2" />
    </template>
    <!-- 教师工具箱 -->
    <template v-else-if="name === 'toolbox'">
      <path d="M14.2 6.8 17 4l3 3-2.8 2.8" />
      <path d="m12.2 8.8 6 6" />
      <path d="M3.8 15.5 12.2 7l3 3L6.8 18.5H3.8v-3Z" />
    </template>
    <!-- 积分商城 -->
    <template v-else-if="name === 'shop'">
      <path d="M4 8h16l-1.1 11a2 2 0 0 1-2 1.8H7.1a2 2 0 0 1-2-1.8L4 8Z" />
      <path d="M8 8V6.2A4 4 0 0 1 12 2.5 4 4 0 0 1 16 6.2V8" />
    </template>
    <!-- 班级管理 -->
    <template v-else-if="name === 'manage'">
      <path d="M4 20V9.5L12 4l8 5.5V20" />
      <path d="M9 20v-5h6v5" />
      <path d="M9 11h.01M12 11h.01M15 11h.01" />
    </template>
    <!-- 更多 -->
    <template v-else-if="name === 'more'">
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </template>
  </svg>
</template>

<style scoped>
.nav-icon {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  display: inline-block;
  vertical-align: -0.12em;
}
</style>
