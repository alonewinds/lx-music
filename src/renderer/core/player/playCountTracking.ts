import { incrementPlayCount } from '@renderer/store/playCount'
import { onTimeupdate, setCurrentTime as setPlayerCurrentTime, getCurrentTime, getDuration } from '@renderer/plugins/player'
import { playMusicInfo, resetNaturalPlayState, updateNaturalPlayTime, markForwardSeek, naturalPlayState } from '@renderer/store/player/state'

/**
 * 播放次数跟踪状态
 */
interface PlayCountTrackingState {
    /**
     * 当前跟踪的歌曲ID
     */
    currentMusicId: string | null
    /**
     * 是否已达到80%进度
     */
    hasReached80Percent: boolean
    /**
     * 是否是手动操作（拖动进度条）
     */
    isManualSeek: boolean
    /**
     * 上一次的播放时间
     */
    lastTime: number
}

const trackingState: PlayCountTrackingState = {
    currentMusicId: null,
    hasReached80Percent: false,
    isManualSeek: false,
    lastTime: 0,
}

/**
 * 重置跟踪状态
 */
export const resetPlayCountTracking = (musicId?: string) => {
    console.log('[PlayCount] Resetting tracking state for music:', musicId)
    trackingState.currentMusicId = musicId ?? null
    trackingState.hasReached80Percent = false
    trackingState.isManualSeek = false
    trackingState.lastTime = 0
    // 同步重置自然播放状态
    resetNaturalPlayState(musicId)
}

/**
 * 标记为手动操作
 * 当用户手动拖动进度条时调用此函数
 */
export const markManualSeek = () => {
    console.log('[PlayCount] Manual seek marked')
    trackingState.isManualSeek = true
}

/**
 * 处理播放进度更新
 */
const handleTimeUpdate = () => {
    const currentTime = getCurrentTime()
    const duration = getDuration()
    const musicId = playMusicInfo.musicInfo?.id

    // 如果没有歌曲信息或时长无效，直接返回
    if (!musicId || !duration || duration <= 0) {
        return
    }

    // 如果歌曲切换了，重置跟踪状态
    if (trackingState.currentMusicId !== musicId) {
        resetPlayCountTracking(musicId)
    }

    // 始终更新自然播放状态追踪（不受 playCount 跟踪状态影响）
    updateNaturalPlayTime(currentTime)

    // 如果已经达到80%或者是手动操作，不再处理播放次数统计
    if (trackingState.hasReached80Percent || trackingState.isManualSeek) {
        trackingState.lastTime = currentTime
        return
    }

    // 检测是否是手动拖动：当前时间与上次时间差距过大（超过2秒）
    const timeDiff = Math.abs(currentTime - trackingState.lastTime)
    if (timeDiff > 2 && trackingState.lastTime > 0) {
        // 检测是否是向前拖动
        if (currentTime > trackingState.lastTime) {
            console.log('[PlayCount] Manual seek detected (time jump > 2s), disabling tracking')
            trackingState.isManualSeek = true
            trackingState.lastTime = currentTime
            return
        }
    }

    trackingState.lastTime = currentTime

    // 计算播放进度百分比
    const progress = currentTime / duration

    // 如果达到80%，增加播放次数
    if (progress >= 0.8) {
        console.log(`[PlayCount] Threshold reached (80%), incrementing count for: ${musicId}`)
        trackingState.hasReached80Percent = true
        void incrementPlayCount(musicId)
    }
}

/**
 * 初始化播放次数跟踪
 */
export const initPlayCountTracking = () => {
    console.log('[PlayCount] Initializing play count tracking')
    // 监听播放进度更新事件
    onTimeupdate(handleTimeUpdate)

    // 监听歌曲切换事件
    window.app_event.on('musicToggled', () => {
        const musicId = playMusicInfo.musicInfo?.id
        resetPlayCountTracking(musicId ?? undefined)
    })
}

// 导出原始的 setCurrentTime，并包装一个会标记手动操作的版本
// 这个函数用于用户主动拖动进度条的场景
export const setCurrentTime = (time: number) => {
    const currentTime = getCurrentTime()
    // 只有向前跳转才标记为手动操作，破坏自然播放
    if (time > currentTime) {
        markManualSeek()
        markForwardSeek()
    }
    // 设置 isSeeking 标志，让 updateNaturalPlayTime 跳过下一次的时间差检测
    // 这避免了播放器跳转过程中的竞态条件导致误判
    naturalPlayState.isSeeking = true
    setPlayerCurrentTime(time)
}

/**
 * 设置播放时间但不进行跳转检测
 * 用于自动恢复播放位置、缓冲恢复等非用户操作场景
 * 不会触发向前跳转检测，不会破坏自然播放状态
 */
export const setCurrentTimeWithoutTracking = (time: number) => {
    // 设置 isSeeking 标志避免 updateNaturalPlayTime 误判
    naturalPlayState.isSeeking = true
    setPlayerCurrentTime(time)
}
