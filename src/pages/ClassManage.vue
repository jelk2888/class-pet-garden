<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/components/layout/PageLayout.vue'
import ManageIcon from '@/components/layout/ManageIcon.vue'
import { useClasses } from '@/composables/useClasses'

const route = useRoute()
const router = useRouter()
const { currentClass } = useClasses()

const sections = [
  { id: 'students', label: '学生', icon: 'students' as const },
  { id: 'rules', label: '积分规则', icon: 'rules' as const },
  { id: 'levels', label: '等级规则', icon: 'levels' as const },
  { id: 'groups', label: '小组管理', icon: 'groups' as const },
  { id: 'teachers', label: '科任老师', icon: 'teachers' as const },
  { id: 'badges', label: '徽章管理', icon: 'badges' as const },
  { id: 'class', label: '班级设置', icon: 'class' as const },
]

const activeId = computed(() => {
  const seg = String(route.params.section || 'students')
  return sections.some((s) => s.id === seg) ? seg : 'students'
})

function go(id: string) {
  router.push(`/manage/${id}`)
}
</script>

<template>
  <PageLayout :no-padding="true" content-class="!p-0">
    <div class="flex flex-col lg:flex-row min-h-[calc(100vh-8.5rem)]">
      <!-- 左侧导航：参考班宠乐园班级管理 -->
      <aside class="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-black/5 bg-white/80 backdrop-blur">
        <div class="px-4 pt-5 pb-3">
          <div class="text-xs font-semibold tracking-wide text-gray-400 uppercase">班级管理</div>
          <div class="mt-1 text-sm font-bold text-gray-800 truncate">
            {{ currentClass?.name || '未选择班级' }}
          </div>
        </div>
        <nav class="px-2 pb-4 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
          <button
            v-for="s in sections"
            :key="s.id"
            type="button"
            class="manage-nav-item"
            :class="activeId === s.id && 'manage-nav-item-active'"
            @click="go(s.id)"
          >
            <span class="manage-nav-icon" :data-icon="s.icon">
              <ManageIcon :name="s.icon" />
            </span>
            <span>{{ s.label }}</span>
          </button>
        </nav>
      </aside>

      <!-- 内容区 -->
      <div class="flex-1 min-w-0 p-4 md:p-6 overflow-auto">
        <router-view />
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.manage-nav-item {
  @apply flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-600 whitespace-nowrap
    hover:bg-[var(--accent-soft)] transition-colors shrink-0 lg:w-full text-left;
}
.manage-nav-item-active {
  @apply font-semibold;
  background: var(--accent-soft);
  color: var(--accent);
}
.manage-nav-icon {
  @apply w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white;
}
.manage-nav-icon[data-icon='students'] { background: linear-gradient(135deg, #a78bfa, #7c3aed); }
.manage-nav-icon[data-icon='rules'] { background: linear-gradient(135deg, #fb923c, #ea580c); }
.manage-nav-icon[data-icon='levels'] { background: linear-gradient(135deg, #38bdf8, #2563eb); }
.manage-nav-icon[data-icon='groups'] { background: linear-gradient(135deg, #fbbf24, #d97706); }
.manage-nav-icon[data-icon='teachers'] { background: linear-gradient(135deg, #4ade80, #16a34a); }
.manage-nav-icon[data-icon='badges'] { background: linear-gradient(135deg, #f472b6, #db2777); }
.manage-nav-icon[data-icon='class'] { background: linear-gradient(135deg, #94a3b8, #475569); }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
