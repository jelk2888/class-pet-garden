<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { useClasses } from '@/composables/useClasses'
import { useToast } from '@/composables/useToast'

const { api } = useAuth()
const { currentClass, init } = useClasses()
const toast = useToast()

const items = ref<any[]>([])
const recent = ref<any[]>([])
const students = ref<any[]>([])
const catalog = ref<any[]>([])
const name = ref('')
const cost = ref(10)
const emoji = ref('🎁')
const desc = ref('')
const redeemStudent = ref('')
const redeemItem = ref('')
const importing = ref(false)
const showCatalog = ref(false)

const enabledItems = computed(() => items.value.filter((i) => i.enabled))
const redeemOptions = computed(() => enabledItems.value)

async function load() {
  if (!currentClass.value) return
  const [shop, stu] = await Promise.all([
    api.get(`/shop/${currentClass.value.id}`),
    api.get(`/classes/${currentClass.value.id}/students`),
  ])
  items.value = shop.data.items || []
  recent.value = shop.data.recent || []
  students.value = stu.data.students || []
  // 班级商城为空时自动从三站目录导入
  if (!items.value.length) {
    try {
      const res = await api.post(`/shop/${currentClass.value.id}/import-catalog`, {})
      if (res.data?.added) {
        toast.success(`已自动导入 ${res.data.added} 件商城商品`)
        const shop2 = await api.get(`/shop/${currentClass.value.id}`)
        items.value = shop2.data.items || []
        recent.value = shop2.data.recent || []
      }
    } catch { /* ignore */ }
  }
}

async function loadCatalog() {
  try {
    const res = await api.get('/shop/catalog')
    catalog.value = res.data.items || []
  } catch {
    catalog.value = []
  }
}

async function addItem() {
  if (!currentClass.value || !name.value.trim()) return
  await api.post(`/shop/${currentClass.value.id}/items`, {
    name: name.value.trim(),
    cost: cost.value,
    emoji: emoji.value,
    description: desc.value,
  })
  name.value = ''
  toast.success('商品已上架')
  await load()
}

async function removeItem(id: string) {
  await api.delete(`/shop/items/${id}`)
  toast.success('已删除')
  await load()
}

async function toggleEnabled(item: any) {
  await api.put(`/shop/items/${item.id}`, { enabled: item.enabled ? 0 : 1 })
  toast.success(item.enabled ? '已隐藏（不可兑换）' : '已显示')
  await load()
}

async function importAllCatalog() {
  if (!currentClass.value) return
  importing.value = true
  try {
    const res = await api.post(`/shop/${currentClass.value.id}/import-catalog`, {})
    toast.success(`已导入 ${res.data.added} 件（跳过同名）`)
    await load()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '导入失败')
  } finally {
    importing.value = false
  }
}

async function importOne(catalogId: string) {
  if (!currentClass.value) return
  try {
    await api.post(`/shop/${currentClass.value.id}/import-one`, { catalogId })
    toast.success('已上架')
    await load()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '导入失败')
  }
}

async function redeem() {
  if (!currentClass.value || !redeemStudent.value || !redeemItem.value) {
    toast.warning('请选择学生和商品')
    return
  }
  try {
    await api.post(`/shop/${currentClass.value.id}/redeem`, {
      studentId: redeemStudent.value,
      itemId: redeemItem.value,
    })
    toast.success('兑换成功')
    await load()
  } catch (e: any) {
    toast.error(e.response?.data?.error || '兑换失败')
  }
}

watch(currentClass, () => load())
onMounted(async () => {
  await init()
  await load()
  await loadCatalog()
})
</script>

<template>
  <PageLayout>
    <div class="max-w-5xl mx-auto space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">🛒 积分商城</h1>
          <p class="text-sm text-gray-500 mt-1">班级内用积分兑换小奖励；管理员可在后台配置全局目录</p>
        </div>
        <div class="flex gap-2" v-if="currentClass">
          <button
            @click="showCatalog = !showCatalog"
            class="px-3 py-2 text-sm border rounded-xl hover:bg-amber-50"
          >{{ showCatalog ? '收起目录' : '从目录选购' }}</button>
          <button
            @click="importAllCatalog"
            :disabled="importing"
            class="px-3 py-2 text-sm bg-amber-500 text-white rounded-xl font-medium disabled:opacity-50"
          >{{ importing ? '导入中…' : '一键导入显示中物品' }}</button>
        </div>
      </div>

      <div v-if="!currentClass" class="bg-white rounded-2xl p-10 text-center text-gray-400">请先选择班级</div>
      <template v-else>
        <section v-if="showCatalog" class="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
          <h2 class="font-bold mb-2">全局目录（仅显示中）</h2>
          <p class="text-xs text-gray-400 mb-3">来自管理员配置的吾师/班宠/班级优等物品</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            <button
              v-for="c in catalog"
              :key="c.id"
              @click="importOne(c.id)"
              class="text-left p-3 rounded-xl border hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
            >
              <span class="text-lg mr-1">{{ c.emoji }}</span>
              <span class="font-medium text-sm">{{ c.name }}</span>
              <span class="text-amber-600 text-xs ml-1">{{ c.cost }}分</span>
            </button>
            <div v-if="!catalog.length" class="col-span-full text-center text-gray-400 text-sm py-4">目录为空或均已隐藏</div>
          </div>
        </section>

        <div class="grid lg:grid-cols-2 gap-4">
          <section class="bg-white rounded-2xl border p-5 shadow-sm">
            <h2 class="font-bold mb-3">上架奖励</h2>
            <div class="flex gap-2 mb-2">
              <input v-model="emoji" class="w-14 border rounded-xl px-2 py-2 text-center" />
              <input v-model="name" placeholder="奖励名称" class="flex-1 border rounded-xl px-3 py-2" />
            </div>
            <input v-model="desc" placeholder="说明" class="w-full border rounded-xl px-3 py-2 mb-2 text-sm" />
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">花费积分</span>
              <input v-model.number="cost" type="number" min="1" class="w-24 border rounded-lg px-2 py-1" />
              <button @click="addItem" class="ml-auto px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm">上架</button>
            </div>
          </section>

          <section class="bg-white rounded-2xl border p-5 shadow-sm">
            <h2 class="font-bold mb-3">为学生兑换</h2>
            <select v-model="redeemStudent" class="w-full border rounded-xl px-3 py-2 mb-2">
              <option value="">选择学生</option>
              <option v-for="s in students" :key="s.id" :value="s.id">{{ s.name }}（{{ s.total_points || 0 }} 分）</option>
            </select>
            <select v-model="redeemItem" class="w-full border rounded-xl px-3 py-2 mb-3">
              <option value="">选择商品（仅显示中）</option>
              <option v-for="i in redeemOptions" :key="i.id" :value="i.id">{{ i.emoji }} {{ i.name }} · {{ i.cost }} 分</option>
            </select>
            <button @click="redeem" class="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold">确认兑换</button>
          </section>
        </div>

        <section class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <article
            v-for="i in items"
            :key="i.id"
            class="bg-white rounded-2xl border p-4 shadow-sm relative"
            :class="i.enabled ? 'border-amber-100' : 'border-gray-100 opacity-60'"
          >
            <div class="absolute top-2 right-2 flex gap-1">
              <button @click="toggleEnabled(i)" class="text-xs px-1.5 py-0.5 rounded" :class="i.enabled ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'">
                {{ i.enabled ? '显示' : '隐藏' }}
              </button>
              <button @click="removeItem(i.id)" class="text-xs text-red-400 px-1">删除</button>
            </div>
            <div class="text-3xl mb-2">{{ i.emoji }}</div>
            <h3 class="font-bold">{{ i.name }}</h3>
            <p class="text-xs text-gray-400 mt-1 min-h-[1rem]">{{ i.description }}</p>
            <div class="mt-3 text-amber-600 font-bold">{{ i.cost }} 积分</div>
          </article>
          <div v-if="!items.length" class="col-span-full text-center text-gray-400 py-8 bg-white rounded-2xl">还没有商品，可一键导入目录或手动上架</div>
        </section>

        <section class="bg-white rounded-2xl border p-5">
          <h2 class="font-bold mb-3">兑换记录</h2>
          <div v-for="r in recent" :key="r.id" class="flex justify-between text-sm py-1.5 border-b border-gray-50">
            <span>{{ r.emoji }} {{ r.student_name }} → {{ r.item_name }}</span>
            <span class="text-amber-600">-{{ r.cost }}</span>
          </div>
          <div v-if="!recent.length" class="text-gray-400 text-center py-4 text-sm">暂无兑换</div>
        </section>
      </template>
    </div>
  </PageLayout>
</template>
