import { pinyin } from 'pinyin-pro'

/**
 * 获取拼音首字母
 * @example getPinyinInitials('张三') => 'zs'
 */
export function getPinyinInitials(text: string): string {
  return pinyin(text, { pattern: 'first', toneType: 'none' })
    .replace(/\s/g, '')
    .toLowerCase()
}

/**
 * 获取完整拼音
 * @example getPinyinFull('张三') => 'zhangsan'
 */
export function getPinyinFull(text: string): string {
  return pinyin(text, { toneType: 'none' })
    .replace(/\s/g, '')
    .toLowerCase()
}

/**
 * 综合匹配：支持汉字、拼音首字母、完整拼音
 * @param text 目标文本（如学生姓名）
 * @param query 搜索关键词
 * @example matchByPinyin('张三', 'zs') => true
 * @example matchByPinyin('张三', 'zhang') => true
 * @example matchByPinyin('张三', '张') => true
 */
export function matchByPinyin(text: string, query: string): boolean {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  // 直接匹配汉字
  if (lowerText.includes(lowerQuery)) return true
  
  // 拼音首字母匹配
  if (getPinyinInitials(text).includes(lowerQuery)) return true
  
  // 完整拼音匹配
  if (getPinyinFull(text).includes(lowerQuery)) return true
  
  return false
}