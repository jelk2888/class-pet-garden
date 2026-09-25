import { ref, computed } from 'vue'
import { useAuth } from './useAuth'

const RECENT_KEY = 'pet-garden-recent-teachers'
const PREFILL_KEY = 'pet-garden-login-prefill'

export interface RecentTeacher {
  username: string
  lastAt: number
}

function loadRecent(): RecentTeacher[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as RecentTeacher[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const recentTeachers = ref<RecentTeacher[]>(loadRecent())

function saveRecent(list: RecentTeacher[]) {
  recentTeachers.value = list.slice(0, 8)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recentTeachers.value))
}

export function useTeacherAccounts() {
  const { username, isGuest } = useAuth()

  const others = computed(() =>
    recentTeachers.value.filter((t) => isGuest.value || t.username !== username.value)
  )

  function rememberTeacher(name: string) {
    if (!name || name === '游客') return
    const now = Date.now()
    const next = [
      { username: name, lastAt: now },
      ...recentTeachers.value.filter((t) => t.username !== name),
    ]
    saveRecent(next)
  }

  function getLoginPrefill(): string {
    return localStorage.getItem(PREFILL_KEY) || ''
  }

  function clearLoginPrefill() {
    localStorage.removeItem(PREFILL_KEY)
  }

  function prepareSwitch(toUsername: string) {
    if (toUsername) localStorage.setItem(PREFILL_KEY, toUsername)
    else localStorage.removeItem(PREFILL_KEY)
  }

  function removeRecent(name: string) {
    saveRecent(recentTeachers.value.filter((t) => t.username !== name))
  }

  return {
    recentTeachers,
    others,
    rememberTeacher,
    getLoginPrefill,
    clearLoginPrefill,
    prepareSwitch,
    removeRecent,
  }
}

export function rememberLoggedInTeacher(name: string) {
  if (!name || name === '游客') return
  const now = Date.now()
  const list = loadRecent()
  const next = [{ username: name, lastAt: now }, ...list.filter((t) => t.username !== name)]
  recentTeachers.value = next.slice(0, 8)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recentTeachers.value))
}
