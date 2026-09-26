<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import EmbedAwareLayout from '@/components/layout/EmbedAwareLayout.vue'
import PetImage from '@/components/PetImage.vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'
import { PET_TYPES, getPetLevelImage, getPetType } from '@/data/pets'

const { api } = useAuth()
const { currentClass, init } = useClasses()
const toast = useToast()

const groups = ref<any[]>([])
const ungrouped = ref<any[]>([])
const rules = ref<any[]>([])
const recent = ref<any[]>([])
const newName = ref('')
const activeGroup = ref<any>(null)
const pickIds = ref<Set<string>>(new Set())
const showPetPicker = ref(false)

const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#06b6d4']

const nextLevelHint = computed(() => {
  const g = activeGroup.value
  if (!g) return ''
  // 与 server LEVEL_CONFIG 一致的粗略提示
  const cfg = [20, 30, 40, 50, 60, 70, 80]
  let total = 0
  const lv = g.pet_level || 1
  for (let i = 0; i < lv; i++) total += cfg[i] || 0
  const need = Math.max(0, total - (g.groupEnergy || 0))
  if (lv >= 8) return '已达最高等级'
  return need > 0 ? `距升级还差 ${need} 点小组能量` : '即将升级'
})

async function load() {
  if (!currentClass.value) return
  const res = await api.get(`/groups/${currentClass.value.id}`)
  groups.value = res.data.groups || []
  ungrouped.value = res.data.ungrouped || []
  rules.value = res.data.rules || []
  recent.value = res.data.recent || []
  if (activeGroup.value) {
    activeGroup.value = groups.value.find((g: any) => g.id === activeGroup.value.id) || null
  }
}

async function addGroup() {
  if (!currentClass.value || !newName.value.trim()) return
  const color = colors[groups.value.length % colors.length]
  await api.post(`/groups/${currentClass.value.id}`, { name: newName.value.trim(), color })
  newName.value = ''
  toast.success('小组已创建')
  await load()
}

async function removeGroup(id: string) {
  await api.delete(`/groups/group/${id}`)
  if (activeGroup.value?.id === id) activeGroup.value = null
  toast.success('已解散')
  await load()
}

function togglePick(id: string) {
  const s = new Set(pickIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  pickIds.value = s
}

async function assign() {
  if (!activeGroup.value || !pickIds.value.size) {
    toast.warning('请选择小组和未分组学生')
    return
  }
  await api.post(`/groups/group/${activeGroup.value.id}/members`, { studentIds: [...pickIds.value] })
  pickIds.value = new Set()
  toast.success('已加入小组')
  await load()
}

async function kick(gid: string, sid: string) {
  await api.delete(`/groups/group/${gid}/members/${sid}`)
  await load()
}

async function setPet(petId: string) {
  if (!activeGroup.value) return
  await api.patch(`/groups/group/${activeGroup.value.id}`, { petType: petId })
  showPetPicker.value = false
  toast.success('小组宠物已设置')
  await load()
}

async function addEnergy(ruleKey: string) {
  if (!activeGroup.value) {
    toast.warning('请先选择小组')
    return
  }
  const rule = rules.value.find((r: any) => r.key === ruleKey)
  const res = await api.post(`/groups/group/${activeGroup.value.id}/energy`, { ruleKey })
  if (res.data.leveledUp) toast.success(`+${rule?.points || ''} 能量，小组宠物升级了！`)
  else toast.success(`已记集体表现 +${rule?.points || ''}（能量 ${res.data.group.groupEnergy}）`)
  await load()
}

function petSrc(g: any) {
  if (!g?.pet_type) return ''
  return getPetLevelImage(g.pet_type, g.pet_level || 1)
}

function petName(g: any) {
  if (!g?.pet_type) return '未领养'
  return getPetType(g.pet_type)?.name || g.pet_type
}

watch(currentClass, () => load())
onMounted(async () => {
  await init()
  await load()
})
</script>

<template>
  <EmbedAwareLayout>
    <div class="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">小组管理</h1>
        <p class="text-sm text-gray-500 mt-1">
          个人积分归个人；集体表现从本组入口加能量。小组榜按<strong>小组净能量</strong>排序，尖子生个人分不会抬高整组。
        </p>
      </div>

      <div v-if="!currentClass" class="bg-white rounded-2xl p-10 text-center text-gray-400">请先选择班级</div>
      <template v-else>
        <!-- 四条最小规则 -->
        <section class="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <div class="text-sm font-bold text-amber-800 mb-2">开学第一周 · 只记这 4 类集体表现</div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              v-for="r in rules"
              :key="r.key"
              @click="addEnergy(r.key)"
              class="text-left rounded-xl bg-white border border-amber-100 p-3 hover:border-orange-400 hover:shadow transition"
              :disabled="!activeGroup"
              :title="activeGroup ? r.hint : '请先选择下方小组'"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">{{ r.hint }}</span>
                <span class="text-orange-600 font-bold">+{{ r.points }}</span>
              </div>
              <div class="font-medium text-gray-800 mt-1 text-sm">{{ r.name }}</div>
            </button>
          </div>
          <p class="text-xs text-amber-700/80 mt-2">先点左侧选中小组，再点规则按钮；能量只加给当前组的共同宠物。</p>
        </section>

        <!-- 小组宠物卡片榜 -->
        <section class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            v-for="(g, i) in groups"
            :key="g.id"
            @click="activeGroup = g"
            class="rounded-2xl p-4 text-left border-2 bg-white shadow-sm transition"
            :class="activeGroup?.id === g.id ? 'border-orange-400 ring-2 ring-orange-100' : 'border-transparent'"
          >
            <div class="flex items-start gap-3">
              <div class="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-50 to-rose-50 flex items-center justify-center shrink-0">
                <PetImage v-if="g.pet_type" :src="petSrc(g)" :alt="petName(g)" size="lg" :rounded="false" rounded-class="rounded-2xl" />
                <span v-else class="text-3xl">🥚</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">#{{ i + 1 }}</span>
                  <span class="font-bold text-gray-800 truncate">{{ g.name }}</span>
                </div>
                <div class="text-sm text-gray-500 mt-0.5">{{ petName(g) }} · Lv.{{ g.pet_level || 1 }}</div>
                <div class="mt-2 flex items-end gap-2">
                  <span class="text-2xl font-black text-orange-600">{{ g.groupEnergy || 0 }}</span>
                  <span class="text-xs text-gray-400 mb-1">小组能量</span>
                </div>
                <div class="text-xs text-gray-400">{{ g.memberCount }} 人 · 个人合计 {{ g.personalPoints || 0 }}（不计入榜）</div>
              </div>
            </div>
          </button>
          <div v-if="!groups.length" class="col-span-full bg-white rounded-2xl p-8 text-center text-gray-400">先建小组，再给每组领一只共同宠物</div>
        </section>

        <div class="grid lg:grid-cols-2 gap-4">
          <section class="bg-white rounded-2xl border p-5">
            <h2 class="font-bold mb-3">小组管理</h2>
            <div class="flex gap-2 mb-4">
              <input v-model="newName" placeholder="小组名称，如：火箭队" class="flex-1 border rounded-xl px-3 py-2" @keyup.enter="addGroup" />
              <button @click="addGroup" class="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm">创建</button>
            </div>
            <div class="space-y-2">
              <button
                v-for="g in groups"
                :key="g.id"
                @click="activeGroup = g"
                class="w-full text-left p-3 rounded-xl border flex items-center gap-3"
                :class="activeGroup?.id === g.id ? 'border-orange-400 bg-orange-50' : 'border-gray-100'"
              >
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: g.color }"></span>
                <div class="flex-1 min-w-0">
                  <div class="font-medium">{{ g.name }}</div>
                  <div class="text-xs text-gray-400">{{ g.memberCount }} 人 · 能量 {{ g.groupEnergy || 0 }}</div>
                </div>
                <button @click.stop="removeGroup(g.id)" class="text-xs text-red-400">解散</button>
              </button>
            </div>
          </section>

          <section class="bg-white rounded-2xl border p-5">
            <div class="flex items-center justify-between mb-1">
              <h2 class="font-bold">{{ activeGroup?.name || '选择小组' }}</h2>
              <button
                v-if="activeGroup"
                @click="showPetPicker = !showPetPicker"
                class="text-xs px-2 py-1 rounded-lg bg-orange-50 text-orange-600 font-medium"
              >{{ activeGroup.pet_type ? '更换宠物' : '领养小组宠物' }}</button>
            </div>
            <p v-if="activeGroup" class="text-xs text-orange-600 mb-3">{{ nextLevelHint }}</p>
            <p v-else class="text-xs text-gray-400 mb-3">目标小组：请先选择左侧小组</p>

            <div v-if="showPetPicker && activeGroup" class="mb-4 max-h-40 overflow-auto flex flex-wrap gap-2 border rounded-xl p-2">
              <button
                v-for="p in PET_TYPES"
                :key="p.id"
                @click="setPet(p.id)"
                class="px-2 py-1 rounded-lg text-xs border hover:border-orange-400"
              >{{ p.name }}</button>
            </div>

            <div class="mb-3">
              <div class="text-xs text-gray-500 mb-1">未分组学生</div>
              <div class="flex flex-wrap gap-2 max-h-32 overflow-auto">
                <button
                  v-for="s in ungrouped"
                  :key="s.id"
                  @click="togglePick(s.id)"
                  class="px-2 py-1 rounded-lg text-sm border"
                  :class="pickIds.has(s.id) ? 'bg-orange-500 text-white border-orange-500' : ''"
                >{{ s.name }}</button>
                <span v-if="!ungrouped.length" class="text-gray-400 text-sm">全部已分组</span>
              </div>
            </div>
            <button @click="assign" class="w-full py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm mb-4">加入当前小组</button>

            <div v-if="activeGroup" class="border-t pt-3">
              <div class="text-xs text-gray-500 mb-2">组员</div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="m in activeGroup.members"
                  :key="m.id"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-sm"
                >
                  {{ m.name }}
                  <button @click="kick(activeGroup.id, m.id)" class="text-red-400 text-xs">×</button>
                </span>
              </div>
            </div>
          </section>
        </div>

        <!-- 周五复盘：最近集体能量 -->
        <section v-if="recent.length" class="bg-white rounded-2xl border p-5">
          <h2 class="font-bold mb-3">最近集体表现（周五复盘用）</h2>
          <div v-for="r in recent" :key="r.id" class="flex items-center gap-3 py-2 border-b border-gray-50 text-sm">
            <span class="w-2 h-2 rounded-full" :style="{ background: r.group_color }"></span>
            <span class="font-medium w-24 truncate">{{ r.group_name }}</span>
            <span class="flex-1 text-gray-600 truncate">{{ r.reason }}</span>
            <span class="font-bold" :class="r.points > 0 ? 'text-orange-600' : 'text-gray-400'">
              {{ r.points > 0 ? '+' : '' }}{{ r.points }}
            </span>
          </div>
        </section>

        <section v-if="groups.length" class="bg-white rounded-2xl border p-5">
          <h2 class="font-bold mb-3">小组能量榜</h2>
          <div v-for="(g, i) in groups" :key="g.id" class="flex items-center gap-3 py-2 border-b border-gray-50">
            <span class="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 text-sm font-bold flex items-center justify-center">{{ i + 1 }}</span>
            <span class="w-2.5 h-2.5 rounded-full" :style="{ background: g.color }"></span>
            <span class="flex-1 font-medium">{{ g.name }}</span>
            <span class="text-sm text-gray-400">{{ petName(g) }} Lv.{{ g.pet_level || 1 }}</span>
            <span class="font-bold text-orange-600">{{ g.groupEnergy || 0 }}</span>
          </div>
        </section>
      </template>
    </div>
  </EmbedAwareLayout>
</template>
