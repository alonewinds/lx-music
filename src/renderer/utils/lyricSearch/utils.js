/**
 * 歌词搜索公共工具
 */

/**
 * 格式化歌手名
 * @param {string | string[]} artist 歌手
 * @returns {string}
 */
export const formatArtist = (artist) => {
    if (!artist) return ''
    if (Array.isArray(artist)) return artist.join('、')
    return artist
}

/**
 * 格式化时长（毫秒 -> mm:ss）
 * @param {number} duration 时长（毫秒）
 * @returns {string}
 */
export const formatDuration = (duration) => {
    if (!duration) return '--:--'
    const seconds = Math.floor(duration / 1000)
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
}

/**
 * 并发执行多个Promise，返回所有结果（包括失败的）
 * @param {Promise<T>[]} promises Promise数组
 * @returns {Promise<{success: T[], failed: Error[]}>}
 */
export const settleAll = async (promises) => {
    const results = await Promise.allSettled(promises)
    const success = []
    const failed = []
    for (const result of results) {
        if (result.status === 'fulfilled') {
            success.push(result.value)
        } else {
            failed.push(result.reason)
        }
    }
    return { success, failed }
}

/**
 * 来源平台名称映射
 */
export const sourceNames = {
    tx: 'QQ音乐',
    kg: '酷狗音乐',
    wy: '网易云',
    kw: '酷我音乐',
}
