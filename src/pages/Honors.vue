<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import PetImage from '@/components/PetImage.vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { getPetType, getPetLevelImage } from '@/data/pets'

const { api } = useAuth()
const { currentClass, init } = useClasses()

const loading = ref(true)
const honors = ref<Array<{
  id: string
  name: string
  pet_type: string | null
  pet_level: number
  total_points: number
  badge_count: number
  badges: Array<{ id: string; pet_type: string; earned_at: number }>
}>>([])

async function load() {
  loading.value = true
  try {
    if (!currentClass.value) {
      honors.value = []
      return
    }
    const res = await api.get(`/classes/${currentClass.value.id}/honors`)
    honors.value = res.data.honors || []
  } catch {
    // fallback
    try {
      if (!currentClass.value) return
      const res = await api.get(`/classes/${currentClass.value.id}/students`)
      const students = res.data.students || []
      honors.value = students
        .filter((s: any) => (s.pet_level || 1) >= 8 || (s.badge_count || 0) > 0)
        .map((s: any) => ({
          ...s,
          badge_count: s.badge_count || (s.pet_level >= 8 ? 1 : 0),
          badges: [],
        }))
        .sort((a: any, b: any) => (b.badge_count || 0) - (a.badge_count || 0) || (b.total_points || 0) - (a.total_points || 0))
    } catch (e) {
      console.error(e)
      honors.value = []
    }
  } finally {
    loading.value = false
  }
}

function petName(type: string | null) {
  if (!type) return '未领养'
  return getPetType(type)?.name || type
}

function petImg(s: any) {
  if (!s.pet_type) return ''
  return getPetLevelImage(s.pet_type, s.pet_level || 8)
}

watch(currentClass, () => load())
onMounted(async () => {
  await init()
  await load()
})
</script>

<template>
  <PageLayout>
    <div class="max-w-6xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span>🎖️</span> 荣誉墙
        </h1>
        <p class="text-sm text-gray-500 mt-1">毕业徽章与高光时刻 —— 让坚持被看见</p>
      </div>

      <div v-if="!currentClass" class="bg-white rounded-2xl border border-sky-100 p-12 text-center text-gray-400">
        请先选择或创建班级
      </div>
      <div v-else-if="loading" class="bg-white rounded-2xl border border-sky-100 p-12 text-center text-gray-400">
        加载中…
      </div>
      <div v-else-if="!honors.length" class="bg-white rounded-2xl border border-dashed border-amber-200 p-12 text-center">
        <div class="text-5xl mb-3">✨</div>
        <h3 class="font-bold text-gray-700 mb-2">荣誉墙还很安静</h3>
        <p class="text-sm text-gray-500">学生宠物达到传说等级（毕业）后，徽章会出现在这里</p>
      </div>
      <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <article
          v-for="s in honors"
          :key="s.id"
          class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-white to-rose-50 border border-amber-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all p-5"
        >
          <div class="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400 text-white">
            ×{{ s.badge_count || 1 }}
          </div>
          <div class="flex items-center gap-4">
            <div class="w-20 h-20 rounded-2xl bg-white shadow-inner flex items-center justify-center overflow-hidden">
              <PetImage v-if="s.pet_type" :src="petImg(s)" :alt="petName(s.pet_type)" class="w-full h-full object-contain" />
              <span v-else class="text-3xl">🏅</span>
            </div>
            <div class="min-w-0">
              <h3 class="font-bold text-gray-800 truncate">{{ s.name }}</h3>
              <p class="text-sm text-amber-700 mt-0.5">{{ petName(s.pet_type) }} · Lv.{{ s.pet_level || 8 }}</p>
              <p class="text-xs text-gray-500 mt-1">积分 {{ s.total_points || 0 }}</p>
            </div>
          </div>
          <div v-if="s.badges?.length" class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="b in s.badges"
              :key="b.id"
              class="text-xs px-2 py-1 rounded-lg bg-white/80 border border-amber-100 text-amber-800"
            >
              🏆 {{ petName(b.pet_type) }}
            </span>
          </div>
          <div v-else class="mt-4 text-xs text-amber-700/80">🏆 毕业荣耀</div>
        </article>
      </div>
    </div>
  </PageLayout>
</template>
