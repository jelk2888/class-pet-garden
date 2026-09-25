// 可爱的加载动画表情
export const loadingEmojis = {
  paws: ['🐾', '🐾', '🐾'],
  dogs: ['🐕', '🐩', '🦮', '🐕‍🦺'],
  cats: ['🐈', '🐈‍⬛', '🐱'],
  small: ['🐇', '🐹', '🐿️', '🦔'],
  birds: ['🦆', '🐥', '🐤', '🐣'],
  mythical: ['🐉', '🐲', '🦄', '🦅', '🐯'],
  all: ['🐾', '🐕', '🐈', '🐇', '🐹', '🦆', '🦙', '🐼', '🐯', '🦄', '🐉', '🦅']
}

// 随机获取加载表情
export function getRandomLoadingEmoji(category: keyof typeof loadingEmojis = 'all'): string {
  const emojis = loadingEmojis[category] || loadingEmojis.all
  return emojis[Math.floor(Math.random() * emojis.length)]
}

// 获取多个随机表情（用于动画序列）
export function getRandomLoadingEmojis(count: number = 3, category: keyof typeof loadingEmojis = 'all'): string[] {
  const emojis = loadingEmojis[category] || loadingEmojis.all
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    result.push(emojis[Math.floor(Math.random() * emojis.length)])
  }
  return result
}