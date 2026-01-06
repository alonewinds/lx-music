/**
 * 歌词编辑器工具函数
 * 用于手动添加歌词功能的辅助工具
 */

/**
 * 将纯文本歌词按行分割
 * @param text 歌词文本
 * @returns 歌词行数组
 */
export function splitLyricText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
}

/**
 * 格式化毫秒时间为 LRC 时间标签 [mm:ss.xx]
 * @param timeMs 时间（毫秒）
 * @returns LRC 格式时间标签
 */
export function formatTimeTag(timeMs: number): string {
  const totalSeconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((timeMs % 1000) / 10)

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  const xx = String(centiseconds).padStart(2, '0')

  return `[${mm}:${ss}.${xx}]`
}

/**
 * 反格式化 LRC 时间标签为毫秒
 * @param timeTag LRC 时间标签 [mm:ss.xx] 或 [mm:ss]
 * @returns 时间（毫秒）
 */
export function parseTimeTag(timeTag: string): number {
  const match = timeTag.match(/\[(\d+):(\d+)(?:\.(\d+))?\]/)
  if (!match) return 0

  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)
  const centiseconds = match[3] ? parseInt(match[3].padEnd(2, '0').slice(0, 2), 10) : 0

  return (minutes * 60 + seconds) * 1000 + centiseconds * 10
}

/**
 * 将行数组和时间戳数组合并为 LRC 格式歌词
 * @param lines 歌词行数组
 * @param timestamps 时间戳数组（毫秒）
 * @returns LRC 格式歌词字符串
 */
export function buildLrcFromLines(lines: string[], timestamps: number[]): string {
  const lrcLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const time = timestamps[i]

    if (time != null && time >= 0) {
      lrcLines.push(`${formatTimeTag(time)}${line}`)
    } else {
      // 未打轴的行不添加时间标签
      lrcLines.push(line)
    }
  }

  return lrcLines.join('\n')
}

/**
 * 解析 LRC 格式歌词为行数组（供预览使用）
 * @param lrc LRC 格式歌词
 * @returns 解析后的行数组
 */
export function parseLrcToLines(lrc: string): Array<{ time: number; text: string }> {
  const lines: Array<{ time: number; text: string }> = []
  const timeTagRegex = /^\[(\d+):(\d+)(?:\.(\d+))?\]/

  for (const line of lrc.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    const match = trimmedLine.match(timeTagRegex)
    if (match) {
      const time = parseTimeTag(match[0])
      const text = trimmedLine.slice(match[0].length)
      lines.push({ time, text })
    } else {
      // 没有时间标签的行，时间设为 -1
      lines.push({ time: -1, text: trimmedLine })
    }
  }

  // 保持原始顺序，不进行排序
  return lines
}

/**
 * 格式化毫秒为可读的时间字符串 mm:ss.xx
 * @param timeMs 时间（毫秒）
 * @returns 可读时间字符串
 */
export function formatTimeDisplay(timeMs: number): string {
  const totalSeconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((timeMs % 1000) / 10)

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  const xx = String(centiseconds).padStart(2, '0')

  return `${mm}:${ss}.${xx}`
}

/**
 * 验证歌词是否已完成打轴
 * @param lines 歌词行数组
 * @param timestamps 时间戳数组
 * @returns 是否所有行都已打轴
 */
export function isAllLinesTimestamped(lines: string[], timestamps: number[]): boolean {
  if (lines.length === 0) return false
  if (timestamps.length < lines.length) return false

  return timestamps.every((t, i) => i >= lines.length || (t != null && t >= 0))
}

/**
 * 获取已打轴的行数
 * @param timestamps 时间戳数组
 * @returns 已打轴行数
 */
export function getTimestampedCount(timestamps: number[]): number {
  return timestamps.filter(t => t != null && t >= 0).length
}

// ============================================
// 逐字歌词（lxlrc）相关类型和工具函数
// ============================================

/**
 * 单个字符的时间信息
 */
export interface WordTimestamp {
  char: string      // 单个字符
  offset: number    // 相对于行起始时间的偏移(ms)，-1 表示未打轴
  duration: number  // 持续时间(ms)，-1 表示未确定
}

/**
 * 歌词行数据（支持逐行和逐字两种模式）
 */
export interface LineData {
  text: string                    // 原始文本
  lineTime: number                // 行起始时间(ms)，-1 表示未打轴
  words: WordTimestamp[]          // 逐字时间数据
  isWordMode: boolean             // 是否已进行逐字打轴
}

/**
 * 将一行文本拆分为字符数组
 * 使用 Intl.Segmenter 正确处理 emoji 和组合字符
 * @param text 文本
 * @returns 字符数组
 */
export function splitLineToWords(text: string): string[] {
  // 使用 Intl.Segmenter 正确分割 Unicode 字符（包括 emoji）
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), s => s.segment)
  }
  // 降级方案：使用扩展运算符（对大多数情况有效）
  return [...text]
}

/**
 * 创建空的逐字时间数组
 * @param text 文本
 * @returns 初始化的 WordTimestamp 数组
 */
export function createEmptyWordTimestamps(text: string): WordTimestamp[] {
  return splitLineToWords(text).map(char => ({
    char,
    offset: -1,
    duration: -1,
  }))
}

/**
 * 从文本和行时间创建 LineData
 * @param text 文本
 * @param lineTime 行起始时间
 * @returns LineData
 */
export function createLineData(text: string, lineTime: number = -1): LineData {
  return {
    text,
    lineTime,
    words: createEmptyWordTimestamps(text),
    isWordMode: false,
  }
}

/**
 * 构建单行 lxlrc 格式字符串
 * @param lineTime 行起始时间(ms)
 * @param words 逐字时间数组
 * @returns lxlrc 格式行，如 "[00:12.50]<0,500>爱<500,300>你"
 */
export function buildLxlrcLine(lineTime: number, words: WordTimestamp[]): string {
  if (lineTime < 0) return words.map(w => w.char).join('')
  
  const timeTag = formatTimeTag(lineTime)
  const wordParts = words.map(w => {
    if (w.offset >= 0 && w.duration >= 0) {
      return `<${w.offset},${w.duration}>${w.char}`
    }
    return w.char
  }).join('')
  
  return `${timeTag}${wordParts}`
}

/**
 * 从 LineData 数组构建完整的 lxlrc 歌词
 * @param linesData LineData 数组
 * @returns lxlrc 格式歌词字符串
 */
export function buildLxlrcFromLines(linesData: LineData[]): string {
  return linesData.map(line => {
    if (line.isWordMode && line.words.some(w => w.offset >= 0)) {
      // 逐字模式：生成带逐字时间的格式
      return buildLxlrcLine(line.lineTime, line.words)
    } else if (line.lineTime >= 0) {
      // 仅逐行模式：生成普通 LRC 格式
      return `${formatTimeTag(line.lineTime)}${line.text}`
    } else {
      // 未打轴：仅返回文本
      return line.text
    }
  }).join('\n')
}

/**
 * 解析单行 lxlrc 格式为 LineData
 * @param line lxlrc 格式行
 * @returns LineData
 */
export function parseLxlrcLine(line: string): LineData {
  const trimmedLine = line.trim()
  if (!trimmedLine) {
    return createLineData('')
  }

  // 匹配行时间标签
  const lineTimeMatch = trimmedLine.match(/^\[(\d+):(\d+)(?:\.(\d+))?\]/)
  let lineTime = -1
  let content = trimmedLine
  
  if (lineTimeMatch) {
    lineTime = parseTimeTag(lineTimeMatch[0])
    content = trimmedLine.slice(lineTimeMatch[0].length)
  }

  // 检查是否有逐字时间标签
  const wordTimeRegex = /<(\d+),(\d+)>/g
  const hasWordTimes = wordTimeRegex.test(content)
  
  if (!hasWordTimes) {
    // 普通 LRC 格式，无逐字时间
    const data = createLineData(content, lineTime)
    return data
  }

  // 解析逐字时间
  wordTimeRegex.lastIndex = 0
  const words: WordTimestamp[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = wordTimeRegex.exec(content)) !== null) {
    // 处理时间标签前的普通字符（如果有）
    if (match.index > lastIndex) {
      const plainText = content.slice(lastIndex, match.index)
      for (const char of splitLineToWords(plainText)) {
        words.push({ char, offset: -1, duration: -1 })
      }
    }

    const offset = parseInt(match[1], 10)
    const duration = parseInt(match[2], 10)
    
    // 找到时间标签后的字符
    const afterTag = content.slice(match.index + match[0].length)
    const chars = splitLineToWords(afterTag)
    if (chars.length > 0) {
      words.push({ char: chars[0], offset, duration })
      lastIndex = match.index + match[0].length + chars[0].length
      wordTimeRegex.lastIndex = lastIndex
    } else {
      lastIndex = match.index + match[0].length
    }
  }

  // 处理剩余的普通字符
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex)
    for (const char of splitLineToWords(remaining)) {
      words.push({ char, offset: -1, duration: -1 })
    }
  }

  return {
    text: words.map(w => w.char).join(''),
    lineTime,
    words,
    isWordMode: words.some(w => w.offset >= 0),
  }
}

/**
 * 解析完整的 lxlrc 歌词为 LineData 数组
 * @param lxlrc lxlrc 格式歌词
 * @returns LineData 数组
 */
export function parseLxlrcToLines(lxlrc: string): LineData[] {
  if (!lxlrc || !lxlrc.trim()) return []
  
  return lxlrc.split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => parseLxlrcLine(line))
}

/**
 * 检查歌词是否为 lxlrc 格式（包含逐字时间标签）
 * @param lyric 歌词字符串
 * @returns 是否为 lxlrc 格式
 */
export function isLxlrcFormat(lyric: string): boolean {
  return /<\d+,\d+>/.test(lyric)
}

/**
 * 获取逐字打轴进度
 * @param words WordTimestamp 数组
 * @returns 已打轴的字数
 */
export function getWordTimestampedCount(words: WordTimestamp[]): number {
  return words.filter(w => w.offset >= 0 && w.duration >= 0).length
}

/**
 * 从普通 LRC 转换为 LineData 数组
 * @param lrc LRC 格式歌词
 * @returns LineData 数组
 */
export function convertLrcToLineData(lrc: string): LineData[] {
  const parsed = parseLrcToLines(lrc)
  return parsed.map(p => createLineData(p.text, p.time))
}
