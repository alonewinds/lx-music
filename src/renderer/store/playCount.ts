import { debounce } from '@common/utils'
import { rendererInvoke, rendererSend } from '@common/rendererIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'

/**
 * 播放次数数据管理
 * 存储格式: { musicId: playCount }
 */

const DATA_KEY = 'playCount'
let playCountData: Map<string, number> | null = null
let isLoading = false

/**
 * 加载播放次数数据
 */
const loadPlayCountData = async (): Promise<void> => {
  if (playCountData !== null) return
  if (isLoading) {
    // 等待加载完成
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    return
  }

  isLoading = true
  try {
    console.log('[PlayCount] Loading data from store...')
    const data = await rendererInvoke<string, Record<string, number> | null>(WIN_MAIN_RENDERER_EVENT_NAME.get_data, DATA_KEY)
    console.log('[PlayCount] Loaded data:', data)
    playCountData = new Map(Object.entries(data ?? {}))
  } catch (error) {
    console.error('Failed to load play count data:', error)
    playCountData = new Map()
  } finally {
    isLoading = false
  }
}

/**
 * 保存播放次数数据（防抖）
 */
const savePlayCountData = debounce(async (): Promise<void> => {
  if (playCountData === null) return

  try {
    console.log('[PlayCount] Saving data to store...', Object.fromEntries(playCountData))
    const data = Object.fromEntries(playCountData)
    rendererSend<{ path: string; data: Record<string, number> }>(WIN_MAIN_RENDERER_EVENT_NAME.save_data, { path: DATA_KEY, data })
  } catch (error) {
    console.error('Failed to save play count data:', error)
  }
}, 3000)

/**
 * 获取指定歌曲的播放次数
 */
export const getPlayCount = async (musicId: string): Promise<number> => {
  await loadPlayCountData()
  return playCountData!.get(musicId) ?? 0
}

/**
 * 增加指定歌曲的播放次数
 */
export const incrementPlayCount = async (musicId: string): Promise<void> => {
  await loadPlayCountData()

  const currentCount = playCountData!.get(musicId) ?? 0
  playCountData!.set(musicId, currentCount + 1)

  // 异步保存数据
  void savePlayCountData()
}

/**
 * 批量获取播放次数
 */
export const getBatchPlayCount = async (musicIds: string[]): Promise<Map<string, number>> => {
  await loadPlayCountData()

  const result = new Map<string, number>()
  for (const id of musicIds) {
    const count = playCountData!.get(id) ?? 0
    result.set(id, count)
  }

  return result
}
