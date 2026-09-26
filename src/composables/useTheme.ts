import { ref, watch } from 'vue'

export type ThemeId = 'peach' | 'ocean' | 'forest' | 'paper' | 'violet'

export interface ThemeOption {
  id: ThemeId
  name: string
  desc: string
  swatch: [string, string, string]
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'forest', name: '翠绿', desc: '自然生长，小组竞赛', swatch: ['#4ade80', '#22c55e', '#059669'] },
  { id: 'peach', name: '桃红暖色', desc: '热情课堂，鼓励与表扬', swatch: ['#fb923c', '#f43f5e', '#ec4899'] },
  { id: 'ocean', name: '海洋蓝', desc: '清爽投影，专注听讲', swatch: ['#38bdf8', '#0ea5e9', '#2563eb'] },
  { id: 'paper', name: '纸黄色', desc: '书卷笔记，温润阅读', swatch: ['#fbbf24', '#d97706', '#92400e'] },
  { id: 'violet', name: '暮光紫', desc: '现代活力，创意展示', swatch: ['#c084fc', '#8b5cf6', '#6366f1'] },
]

const STORAGE_KEY = 'pet-garden-ui-theme'
const currentTheme = ref<ThemeId>(readStored())

function readStored(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    if (v && THEME_OPTIONS.some((t) => t.id === v)) return v
  } catch { /* ignore */ }
  return 'forest'
}

function applyDom(id: ThemeId) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', id)
  document.body?.setAttribute('data-theme', id)
}

applyDom(currentTheme.value)

watch(currentTheme, (id) => {
  applyDom(id)
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* ignore */ }
})

export function useTheme() {
  function setTheme(id: ThemeId) {
    if (!THEME_OPTIONS.some((t) => t.id === id)) return
    currentTheme.value = id
  }

  function themeMeta(id?: string) {
    return THEME_OPTIONS.find((t) => t.id === id) || THEME_OPTIONS.find((t) => t.id === 'forest') || THEME_OPTIONS[0]
  }

  return {
    currentTheme,
    themes: THEME_OPTIONS,
    setTheme,
    themeMeta,
  }
}
