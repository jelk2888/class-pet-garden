<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'

const { api } = useAuth()
const { currentClass, init } = useClasses()
const toast = useToast()

const tasks = ref<any[]>([])
const recent = ref<any[]>([])
const students = ref<any[]>([])
const newName = ref('')
const newPoints = ref(2)
const newDesc = ref('')
const selectedTask = ref<any>(null)
const selectedStudents = ref<Set<string>>(new Set())
const loading = ref(false)

async function load() {
  if (!currentClass.value) return
  loading.value = true
  try {
    const [tRes, sRes] = await Promise.all([
      api.get(`/tasks/${currentClass.value.id}`),
      api.get(`/classes/${currentClass.value.id}/students`),
    ])
    tasks.value = tRes.data.tasks || []
    recent.value = tRes.data.recent || []
    students.value = sRes.data.students || []
  } catch (e: any) {
    toast.error(e.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

async function addTask() {
  if (!currentClass.value || !newName.value.trim()) return
  await api.post(`/tasks/${currentClass.value.id}`, {
    name: newName.value.trim(),
    description: newDesc.value,
    points: newPoints.value,
  })
  newName.value = ''
  newDesc.value = ''
  toast.success('任务已添加')
  await load()
}

async function removeTask(id: string) {
  await api.delete(`/tasks/task/${id}`)
  toast.success('已删除')
  await load()
}

function toggleStu(id: string) {
  const s = new Set(selectedStudents.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedStudents.value = s
}

async function completeTask() {
  if (!selectedTask.value || !selectedStudents.value.size) {
    toast.warning('请选择任务和学生')
    return
  }
  await api.post(`/tasks/task/${selectedTask.value.id}/complete`, {
    studentIds: [...selectedStudents.value],
  })
  toast.success('已完成并加分')
  selectedStudents.value = new Set()
  await load()
}

watch(currentClass, () => load())
onMounted(async () => {
  await init()
  await load()
})
</script>

<template>
  <PageLayout>
    <div class="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">✅ 任务中心</h1>
        <p class="text-sm text-gray-500 mt-1">布置课堂小任务，完成后一键加分（班级内激励，非商用任务）</p>
      </div>

      <div v-if="!currentClass" class="bg-white rounded-2xl p-10 text-center text-gray-400">请先选择班级</div>
      <template v-else>
        <div class="grid lg:grid-cols-2 gap-4">
          <section class="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
            <h2 class="font-bold mb-3">新建任务</h2>
            <input v-model="newName" placeholder="任务名称，如：值日认真" class="w-full border rounded-xl px-3 py-2 mb-2" />
            <textarea v-model="newDesc" placeholder="说明（可选）" class="w-full border rounded-xl px-3 py-2 mb-2 text-sm" rows="2" />
            <div class="flex items-center gap-2 mb-3">
              <label class="text-sm text-gray-500">积分</label>
              <input v-model.number="newPoints" type="number" min="1" class="w-20 border rounded-lg px-2 py-1" />
              <button @click="addTask" class="ml-auto px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold">添加</button>
            </div>
            <div class="space-y-2 max-h-72 overflow-auto">
              <div
                v-for="t in tasks"
                :key="t.id"
                class="flex items-center gap-2 p-3 rounded-xl border cursor-pointer"
                :class="selectedTask?.id === t.id ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:bg-gray-50'"
                @click="selectedTask = t"
              >
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ t.name }}</div>
                  <div class="text-xs text-gray-400">+{{ t.points }} 分 · 今日 {{ t.todayCount }} 次</div>
                </div>
                <button @click.stop="removeTask(t.id)" class="text-xs text-red-400 hover:text-red-600">删除</button>
              </div>
              <div v-if="!tasks.length" class="text-sm text-gray-400 py-6 text-center">还没有任务</div>
            </div>
          </section>

          <section class="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
            <h2 class="font-bold mb-1">完成任务</h2>
            <p class="text-xs text-gray-400 mb-3">当前：{{ selectedTask?.name || '请先点选左侧任务' }}</p>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-auto mb-4">
              <button
                v-for="s in students"
                :key="s.id"
                @click="toggleStu(s.id)"
                class="px-2 py-2 rounded-xl text-sm border truncate"
                :class="selectedStudents.has(s.id) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-gray-100'"
              >{{ s.name }}</button>
            </div>
            <button
              @click="completeTask"
              class="w-full py-3 rounded-2xl bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold disabled:opacity-40"
              :disabled="!selectedTask || !selectedStudents.size"
            >确认完成（{{ selectedStudents.size }} 人）</button>
          </section>
        </div>

        <section class="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
          <h2 class="font-bold mb-3">最近完成</h2>
          <div class="space-y-2 text-sm">
            <div v-for="r in recent" :key="r.id" class="flex justify-between gap-2 py-1.5 border-b border-gray-50">
              <span><b>{{ r.student_name }}</b> · {{ r.task_name }}</span>
              <span class="text-orange-600">+{{ r.points }}</span>
            </div>
            <div v-if="!recent.length" class="text-gray-400 text-center py-4">暂无记录</div>
          </div>
        </section>
      </template>
    </div>
  </PageLayout>
</template>
