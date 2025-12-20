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
