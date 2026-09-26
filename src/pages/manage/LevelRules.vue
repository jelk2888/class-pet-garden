<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getLevelName, MAX_PET_LEVEL, LEVEL_CONFIG as DEFAULT_CFG } from '@/data/pets'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'

const { api } = useAuth()
const { currentClass } = useClasses()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const editing = ref(false)
const config = ref<number[]>([...DEFAULT_CFG])
const draft = ref<number[]>([...DEFAULT_CFG])
const isDefault = ref(true)

const rows = computed(() => {
  const cfg = editing.value ? draft.value : config.value
  let cumulative = 0
  return cfg.map((need, i) => {
    const from = i
    const to = i + 1
    cumulative += need
    return {
      from,
      to,
      fromName: getLevelName(from),
      toName: getLevelName(to),
      need,
      cumulative,
      segment: i === 0 ? null : need,
    }
  })
})

const totalExp = computed(() =>
  (editing.value ? draft.value : config.value).reduce((a, b) => a + b, 0)
)

async function load() {
  if (!currentClass.value) {
    config.value = [...DEFAULT_CFG]
    draft.value = [...DEFAULT_CFG]
    loading.value = false
    return
  }
  loading.value = true
  try {
    const res = await api.get(`/classes/${currentClass.value.id}/level-config`)
    config.value = res.data.config || [...DEFAULT_CFG]
    draft.value = [...config.value]
    isDefault.value = !!res.data.isDefault
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '加载等级规则失败')
  } finally {
    loading.value = false
  }
}

function startEdit() {
  draft.value = [...config.value]
  editing.value = true
}

function cancelEdit() {
  draft.value = [...config.value]
  editing.value = false
}

function resetDefaults() {
  draft.value = [...DEFAULT_CFG]
}

async function save() {
  if (!currentClass.value) return
  const cleaned = draft.value.map((n) => Math.max(1, Math.min(9999, Math.round(Number(n) || 1))))
  saving.value = true
  try {
    const res = await api.put(`/classes/${currentClass.value.id}/level-config`, { config: cleaned })
    config.value = res.data.config
    draft.value = [...config.value]
    editing.value = false
    isDefault.value = false
    toast.success(`已保存，并重算 ${res.data.studentsUpdated || 0} 名学生等级`)
  } catch (e: any) {
    toast.error(e?.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(currentClass, load)
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-6 flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">等级规则</h1>
        <p class="text-sm text-gray-500 mt-1">
          宠物从 Lv0（蛋）成长到 Lv{{ MAX_PET_LEVEL }}（{{ getLevelName(MAX_PET_LEVEL) }}）。调整后对全班即时生效。
        </p>
      </div>
      <div class="flex gap-2 print:hidden">
        <template v-if="!editing">
          <button class="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-orange-50" @click="startEdit">✏️ 编辑</button>
        </template>
        <template v-else>
          <button class="px-3 py-2 rounded-xl border text-sm" @click="resetDefaults">恢复默认值</button>
          <button class="px-3 py-2 rounded-xl border text-sm" @click="cancelEdit">取消</button>
          <button
            class="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style="background: var(--accent)"
            :disabled="saving"
            @click="save"
          >保存</button>
        </template>
      </div>
    </div>

    <div v-if="!currentClass" class="bg-white rounded-2xl p-10 text-center text-gray-400">请先选择班级</div>
    <div v-else-if="loading" class="bg-white rounded-2xl p-10 text-center text-gray-400">加载中…</div>
    <template v-else>
      <div class="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div class="grid grid-cols-4 gap-2 px-4 py-3 text-xs font-semibold text-gray-400 bg-gray-50 border-b">
          <div>等级</div>
          <div>所需累计经验</div>
          <div>本段经验</div>
          <div>段差说明</div>
        </div>
        <div
          v-for="row in rows"
          :key="row.from"
          class="grid grid-cols-4 gap-2 px-4 py-3 text-sm border-b border-gray-50 items-center"
        >
          <div>
            <span class="font-bold text-gray-800">Lv.{{ row.to }}</span>
            <span class="text-xs text-gray-400 ml-1">{{ row.toName }}</span>
          </div>
          <div class="font-semibold text-gray-700">{{ row.cumulative }}</div>
          <div>
            <input
              v-if="editing"
              v-model.number="draft[row.from]"
              type="number"
              min="1"
              max="9999"
              class="w-20 border rounded-lg px-2 py-1 text-orange-600 font-semibold"
            />
            <span v-else class="font-semibold text-orange-600">{{ row.need }}</span>
          </div>
          <div class="text-xs text-gray-400">
            {{ row.from === 0 ? '—' : `+${row.need}` }}
          </div>
        </div>
      </div>

      <div class="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm text-amber-900/80">
        满级共需 <strong>{{ totalExp }}</strong> 点经验。
        <span v-if="isDefault && !editing">当前为系统默认阈值。</span>
        等级阈值调整后对全班所有学生即时生效。
      </div>
    </template>
  </div>
</template>
