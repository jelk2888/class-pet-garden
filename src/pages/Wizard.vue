<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageLayout from '@/components/layout/PageLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'
import { useLoginModal } from '@/composables/useLoginModal'
import ClassModal from '@/components/modals/ClassModal.vue'
import AuthModal from '@/components/AuthModal.vue'

const router = useRouter()
const { api, isGuest } = useAuth()
const { classes, currentClass, createClass, loadClasses, init } = useClasses()
const toast = useToast()
const { showLoginModal, openLoginModal, closeLoginModal } = useLoginModal()

const step = ref(1)
const showClassModal = ref(false)
const showImportForm = ref(false)
const importText = ref('')
const studentCount = ref(0)

const steps = [
  { n: 1, title: '创建班级', desc: '给班级起个名字，建立成长空间' },
  { n: 2, title: '导入学生', desc: '添加名单，每位同学可领养宠物' },
  { n: 3, title: '开始激励', desc: '进入宠物教室，随手评价加分' },
]

const canStep3 = computed(() => studentCount.value > 0)

async function refreshCount() {
  if (!currentClass.value) {
    studentCount.value = 0
    return
  }
  try {
    const res = await api.get(`/classes/${currentClass.value.id}/students`)
    studentCount.value = (res.data.students || []).length
  } catch {
    studentCount.value = 0
  }
}

async function handleCreate(name: string) {
  if (isGuest.value) {
    openLoginModal()
    return
  }
  await createClass(name.trim())
  showClassModal.value = false
  toast.success('班级已创建')
  await loadClasses()
  step.value = 2
  await refreshCount()
}

async function handleImport() {
  if (!currentClass.value) return
  if (!importText.value.trim()) {
    toast.warning('请输入学生信息')
    return
  }
  const lines = importText.value.trim().split('\n').filter(l => l.trim())
  const students = lines.map(line => {
    const parts = line.split(/[,，;；\t\s]+/).filter(Boolean)
    return { name: parts[0], studentNo: parts[1] || '' }
  }).filter(s => s.name)
  try {
    await api.post('/students/import', { classId: currentClass.value.id, students })
    toast.success(`成功导入 ${students.length} 名学生`)
    showImportForm.value = false
    importText.value = ''
    await refreshCount()
    if (studentCount.value > 0) step.value = 3
  } catch {
    toast.error('导入失败')
  }
}

onMounted(async () => {
  await init()
  if (currentClass.value) step.value = 2
  await refreshCount()
  if (studentCount.value > 0) step.value = 3
})

watch(currentClass, () => refreshCount())
</script>

<template>
  <PageLayout>
    <div class="max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-800 mb-1">🧭 开班向导</h1>
      <p class="text-sm text-gray-500 mb-6">三步上手：建班 → 名单 → 课堂激励</p>

      <div class="flex gap-2 mb-8">
        <div
          v-for="s in steps"
          :key="s.n"
          class="flex-1 rounded-2xl border p-3 text-center transition"
          :class="step >= s.n ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'"
        >
          <div class="text-xs text-gray-400 mb-1">步骤 {{ s.n }}</div>
          <div class="font-bold text-sm" :class="step >= s.n ? 'text-orange-600' : 'text-gray-500'">{{ s.title }}</div>
        </div>
      </div>

      <section v-if="step === 1" class="bg-white rounded-3xl border border-orange-100 p-8 shadow-sm text-center">
        <div class="text-5xl mb-4">🏫</div>
        <h2 class="text-xl font-bold mb-2">创建你的第一个班级</h2>
        <p class="text-gray-500 mb-6">{{ steps[0].desc }}</p>
        <button
          @click="isGuest ? openLoginModal() : (showClassModal = true)"
          class="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold shadow hover:shadow-lg"
        >➕ 创建班级</button>
        <p v-if="classes.length" class="mt-4 text-sm text-gray-500">
          已有班级「{{ currentClass?.name }}」，
          <button class="text-orange-600 underline" @click="step = 2">下一步</button>
        </p>
      </section>

      <section v-else-if="step === 2" class="bg-white rounded-3xl border border-orange-100 p-8 shadow-sm text-center">
        <div class="text-5xl mb-4">👥</div>
        <h2 class="text-xl font-bold mb-2">导入学生名单</h2>
        <p class="text-gray-500 mb-2">当前班级：<b>{{ currentClass?.name || '未选择' }}</b></p>
        <p class="text-gray-500 mb-6">已有 {{ studentCount }} 名学生</p>
        <div class="flex flex-wrap gap-3 justify-center">
          <button @click="showImportForm = true" class="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold">📥 批量导入</button>
          <router-link to="/manage/students" class="px-6 py-3 rounded-2xl border border-orange-200 text-orange-600 font-bold">👥 学生管理</router-link>
          <button v-if="canStep3" @click="step = 3" class="px-6 py-3 rounded-2xl bg-white border text-gray-600 font-bold">下一步 →</button>
        </div>
      </section>

      <section v-else class="bg-white rounded-3xl border border-orange-100 p-8 shadow-sm text-center">
        <div class="text-5xl mb-4">🐾</div>
        <h2 class="text-xl font-bold mb-2">开始课堂激励</h2>
        <p class="text-gray-500 mb-6">在宠物教室评价个人；用「一组一宠」记集体表现——个人分不进小组能量。</p>
        <div class="grid sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto mb-6">
          <router-link to="/" class="p-4 rounded-2xl bg-orange-50 hover:bg-orange-100">🐾 宠物教室</router-link>
          <router-link to="/manage/groups" class="p-4 rounded-2xl bg-violet-50 hover:bg-violet-100">🐣 小组管理</router-link>
          <router-link to="/tasks" class="p-4 rounded-2xl bg-sky-50 hover:bg-sky-100">✅ 任务中心</router-link>
          <router-link to="/shop" class="p-4 rounded-2xl bg-amber-50 hover:bg-amber-100">🛒 积分商城</router-link>
        </div>
        <button @click="router.push('/')" class="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold">进入宠物教室</button>
      </section>
    </div>

    <ClassModal :show="showClassModal" @close="showClassModal = false" @submit="handleCreate" />
    <AuthModal :show="showLoginModal" @close="closeLoginModal" @login="() => { closeLoginModal(); location.reload() }" />

    <div v-if="showImportForm" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showImportForm = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <h3 class="text-lg font-bold mb-4">📥 批量导入学生</h3>
        <p class="text-sm text-gray-500 mb-3">每行一个学生，格式：姓名,学号</p>
        <textarea v-model="importText" rows="10" placeholder="张三,001&#10;李四,002" class="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-orange-400"></textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showImportForm = false" class="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm">取消</button>
          <button @click="handleImport" class="px-4 py-2 bg-gradient-to-r from-orange-400 to-pink-500 text-white rounded-xl text-sm font-medium">导入</button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>
