<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useStudents } from '@/composables/useStudents'
import { useToast } from '@/composables/useToast'
import PetImage from '@/components/PetImage.vue'
import { getPetLevelImage, getPetType } from '@/data/pets'

const { api, isGuest } = useAuth()
const { currentClass } = useClasses()
const { students, loadStudents } = useStudents()
const toast = useToast()

const tab = ref<'micro' | 'grad'>('micro')
const loading = ref(false)
const types = ref<any[]>([])
const awards = ref<any[]>([])
const graduation = ref<any[]>([])

const showAward = ref(false)
const showCreateType = ref(false)
const awardStudentId = ref('')
const awardTypeId = ref('')
const awardNote = ref('')
const newName = ref('')
const newEmoji = ref('🏅')
const newColor = ref('#f59e0b')
const emojiPresets = ['⭐', '🎖️', '🏆', '💡', '📚', '🤝', '🧹', '⚽', '🌸', '✨', '🙋', '📈', '🎯', '💪', '🏅']

async function load() {
  if (!currentClass.value) {
    types.value = []
    awards.value = []
    graduation.value = []
    return
  }
  loading.value = true
  try {
    await loadStudents()
    const res = await api.get(`/micro-badges/${currentClass.value.id}`)
    types.value = res.data.types || []
    awards.value = res.data.awards || []
    graduation.value = res.data.graduation || []
    if (!awardTypeId.value && types.value.length) awardTypeId.value = types.value[0].id
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(currentClass, load)

function petName(type: string) {
  return getPetType(type)?.name || type || '宠物'
}

function fmt(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function createType() {
  if (!currentClass.value || !newName.value.trim()) {
    toast.warning('请填写微章名称')
    return
  }
  try {
    await api.post(`/micro-badges/${currentClass.value.id}/types`, {
      name: newName.value.trim(),
      emoji: newEmoji.value,
      color: newColor.value,
    })
    toast.success('微章已创建')
    showCreateType.value = false
    newName.value = ''
    await load()
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '创建失败')
  }
}

async function removeType(t: any) {
  if (!currentClass.value) return
  if (!confirm(`删除微章「${t.name}」及其全部颁发记录？`)) return
  try {
    await api.delete(`/micro-badges/${currentClass.value.id}/types/${t.id}`)
    toast.success('已删除')
    await load()
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '删除失败')
  }
}

async function award() {
  if (!currentClass.value || !awardStudentId.value || !awardTypeId.value) {
    toast.warning('请选择学生和微章')
    return
  }
  try {
    await api.post(`/micro-badges/${currentClass.value.id}/award`, {
      studentId: awardStudentId.value,
      typeId: awardTypeId.value,
      note: awardNote.value.trim() || undefined,
    })
    toast.success('已颁发')
    showAward.value = false
    awardNote.value = ''
    await load()
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '颁发失败')
  }
}

async function revoke(a: any) {
  if (!currentClass.value) return
  if (!confirm(`撤销「${a.student_name}」的「${a.badge_name}」？`)) return
  try {
    await api.delete(`/micro-badges/${currentClass.value.id}/awards/${a.id}`)
    toast.success('已撤销')
    await load()
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '撤销失败')
  }
}

const sortedStudents = computed(() =>
  [...students.value].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
)
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="mb-6 flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">徽章管理</h1>
        <p class="text-sm text-gray-500 mt-1">颁发教师荣誉微章，并查看毕业徽章持有情况。</p>
      </div>
      <div class="flex gap-2">
        <router-link
          to="/honors"
          class="text-sm px-3 py-1.5 rounded-xl border bg-white hover:bg-[var(--accent-soft)] transition"
          style="color: var(--accent)"
        >荣誉墙 →</router-link>
        <button
          v-if="!isGuest && currentClass"
          class="text-sm px-4 py-1.5 rounded-xl text-white font-bold bg-violet-500 hover:bg-violet-600"
          @click="showAward = true"
        >+ 颁发微章</button>
      </div>
    </div>

    <div class="flex gap-2 mb-5">
      <button
        class="px-4 py-2 rounded-xl text-sm font-medium transition"
        :class="tab==='micro' ? 'bg-white shadow text-violet-600' : 'bg-white/50 text-gray-500'"
        @click="tab='micro'"
      >教师微章</button>
      <button
        class="px-4 py-2 rounded-xl text-sm font-medium transition"
        :class="tab==='grad' ? 'bg-white shadow text-amber-600' : 'bg-white/50 text-gray-500'"
        @click="tab='grad'"
      >毕业徽章</button>
    </div>

    <div v-if="!currentClass" class="bg-white rounded-2xl p-10 text-center text-gray-400">请先选择班级</div>
    <div v-else-if="loading" class="bg-white rounded-2xl p-10 text-center text-gray-400">加载中…</div>

    <template v-else-if="tab === 'micro'">
      <div class="bg-white rounded-2xl border border-black/5 shadow-sm p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm font-semibold text-gray-700">微章种类</div>
          <button
            v-if="!isGuest"
            class="text-xs px-3 py-1.5 rounded-lg border hover:bg-violet-50"
            @click="showCreateType = true"
          >+ 新建种类</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="t in types"
            :key="t.id"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border"
            :style="{ borderColor: t.color + '55', background: t.color + '14' }"
          >
            <span class="text-lg leading-none">{{ t.emoji }}</span>
            <span class="font-medium text-gray-800">{{ t.name }}</span>
            <button
              v-if="!isGuest"
              class="text-gray-400 hover:text-red-500 text-xs ml-1"
              title="删除"
              @click="removeType(t)"
            >×</button>
          </div>
        </div>
      </div>

      <div v-if="!awards.length" class="bg-white rounded-2xl p-10 text-center text-gray-400">
        <div class="text-5xl mb-3">🏅</div>
        <p>暂无老师颁发类微章持有记录</p>
        <button
          v-if="!isGuest"
          class="mt-4 text-sm text-violet-600 font-medium"
          @click="showAward = true"
        >去颁发第一枚 →</button>
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="a in awards"
          :key="a.id"
          class="bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-3 flex items-center gap-3"
        >
          <span
            class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            :style="{ background: (a.color || '#f59e0b') + '22' }"
          >{{ a.emoji }}</span>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-gray-800 truncate">{{ a.student_name }} · {{ a.badge_name }}</div>
            <div class="text-xs text-gray-400 mt-0.5">
              {{ fmt(a.earned_at) }}
              <span v-if="a.teacher_name"> · {{ a.teacher_name }}</span>
              <span v-if="a.note"> · {{ a.note }}</span>
            </div>
          </div>
          <button
            v-if="!isGuest"
            class="text-xs text-red-500 hover:underline shrink-0"
            @click="revoke(a)"
          >撤销</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="!graduation.length" class="bg-white rounded-2xl p-10 text-center text-gray-400">
        <div class="text-5xl mb-3">🏆</div>
        <p>暂无毕业徽章</p>
        <p class="text-xs mt-2">学生宠物达到传说满级后会出现在这里</p>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="s in graduation"
          :key="s.id"
          class="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-start gap-4"
        >
          <div class="w-14 h-14 rounded-xl overflow-hidden bg-amber-50 shrink-0">
            <PetImage
              :src="getPetLevelImage(s.pet_type, s.pet_level || 8)"
              :alt="s.name"
              size="md"
              :rounded="false"
              rounded-class="rounded-xl"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-gray-800">{{ s.name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                ×{{ s.badge_count || s.badges?.length || 1 }}
              </span>
            </div>
            <div class="text-sm text-gray-500 mt-0.5">
              {{ petName(s.pet_type) }} · Lv.{{ s.pet_level || 8 }}
            </div>
            <div v-if="s.badges?.length" class="mt-2 flex flex-wrap gap-2">
              <span
                v-for="b in s.badges"
                :key="b.id"
                class="text-xs px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100"
              >
                {{ petName(b.pet_type) }} · {{ fmt(b.earned_at) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 颁发弹窗 -->
    <div v-if="showAward" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" @click.self="showAward=false">
      <div class="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <h3 class="font-bold text-lg mb-4">颁发微章</h3>
        <label class="text-xs text-gray-500">学生</label>
        <select v-model="awardStudentId" class="w-full border rounded-xl px-3 py-2 mt-1 mb-3">
          <option value="">请选择</option>
          <option v-for="s in sortedStudents" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <label class="text-xs text-gray-500">微章</label>
        <select v-model="awardTypeId" class="w-full border rounded-xl px-3 py-2 mt-1 mb-3">
          <option v-for="t in types" :key="t.id" :value="t.id">{{ t.emoji }} {{ t.name }}</option>
        </select>
        <label class="text-xs text-gray-500">备注（可选）</label>
        <input v-model="awardNote" class="w-full border rounded-xl px-3 py-2 mt-1 mb-4" placeholder="例如：本周课堂表现突出" />
        <div class="flex justify-end gap-2">
          <button class="px-4 py-2 rounded-xl border" @click="showAward=false">取消</button>
          <button class="px-5 py-2 rounded-xl text-white font-bold bg-violet-500" @click="award">确认颁发</button>
        </div>
      </div>
    </div>

    <!-- 新建种类 -->
    <div v-if="showCreateType" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" @click.self="showCreateType=false">
      <div class="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <h3 class="font-bold text-lg mb-4">新建微章种类</h3>
        <label class="text-xs text-gray-500">名称</label>
        <input v-model="newName" class="w-full border rounded-xl px-3 py-2 mt-1 mb-3" placeholder="如：朗读小达人" />
        <label class="text-xs text-gray-500">图标</label>
        <div class="flex flex-wrap gap-2 mt-1 mb-2">
          <button
            v-for="e in emojiPresets"
            :key="e"
            type="button"
            class="w-9 h-9 rounded-lg border text-lg"
            :class="newEmoji===e ? 'border-violet-400 bg-violet-50' : ''"
            @click="newEmoji=e"
          >{{ e }}</button>
        </div>
        <input v-model="newEmoji" class="w-full border rounded-xl px-3 py-2 mb-3" maxlength="4" />
        <label class="text-xs text-gray-500">主题色</label>
        <input v-model="newColor" type="color" class="mt-1 mb-4 w-16 h-9 rounded cursor-pointer" />
        <div class="flex justify-end gap-2">
          <button class="px-4 py-2 rounded-xl border" @click="showCreateType=false">取消</button>
          <button class="px-5 py-2 rounded-xl text-white font-bold bg-violet-500" @click="createType">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>
