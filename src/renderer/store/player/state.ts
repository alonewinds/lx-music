import { reactive, shallowReactive, ref } from '@common/utils/vueTools'

export interface PlayerMusicInfo {
  id: string | null
  pic: string | null
  lrc: string | null
  tlrc: string | null
  rlrc: string | null
  lxlrc: string | null
  rawlrc: string | null
  // url: string | null
  name: string
  singer: string
  album: string
}

export const musicInfo = window.lxData.musicInfo = reactive<PlayerMusicInfo>({
  id: null,
  pic: null,
  lrc: null,
  tlrc: null,
  rlrc: null,
  lxlrc: null,
  rawlrc: null,
  // url: null,
  name: '',
  singer: '',
  album: '',
})

export const isPlay = ref(false)

export const status = window.lxData.status = ref('')

export const statusText = ref('')

export const isShowPlayerDetail = ref(false)

export const isShowPlayComment = ref(false)

export const isShowLrcSelectContent = ref(false)

export const isShowPlayQueue = ref(false)

export const playMusicInfo = shallowReactive<{
  /**
   * 当前播放歌曲的列表 id
   */
  musicInfo: LX.Player.PlayMusicInfo['musicInfo'] | null
  /**
   * 当前播放歌曲的列表 id
   */
  listId: LX.Player.PlayMusicInfo['listId'] | null
  /**
   * 是否属于 “稍后播放”
   */
  isTempPlay: boolean
}>({
  listId: null,
  musicInfo: null,
  isTempPlay: false,
})
export const playInfo = shallowReactive<LX.Player.PlayInfo>({
  playIndex: -1,
  playerListId: null,
  playerPlayIndex: -1,
})


export const playedList = window.lxData.playedList = shallowReactive<LX.Player.PlayMusicInfo[]>([])

export const tempPlayList = shallowReactive<LX.Player.PlayMusicInfo[]>([])

window.lxData.playInfo = playInfo
window.lxData.playMusicInfo = playMusicInfo

/**
 * 自然播放状态追踪
 * 用于判断当前歌曲是否为"自然完整播放"（未向前拖动进度条）
 * 注意：向后拖动（回拨）仍然算自然播放，只有向前拖动才破坏自然播放
 */
export const naturalPlayState = reactive<{
  /** 当前追踪的歌曲ID */
  currentMusicId: string | null
  /** 是否为自然播放（未向前拖动进度条） */
  isNaturalPlay: boolean
  /** 上一次的播放时间，用于检测向前跳转 */
  lastTime: number
  /** 是否正在跳转中（用于避免竞态条件导致的误判） */
  isSeeking: boolean
}>({
  currentMusicId: null,
  isNaturalPlay: true,
  lastTime: 0,
  isSeeking: false,
})

/**
 * 重置自然播放状态
 * 在切换歌曲时调用
 */
export const resetNaturalPlayState = (musicId?: string) => {
  naturalPlayState.currentMusicId = musicId ?? null
  naturalPlayState.isNaturalPlay = true
  naturalPlayState.lastTime = 0
  naturalPlayState.isSeeking = false
}

/**
 * 标记当前歌曲为非自然播放（向前拖动/跳转）
 */
export const markForwardSeek = () => {
  naturalPlayState.isNaturalPlay = false
}

/**
 * 更新自然播放状态的时间追踪
 * 检测是否有向前跳转（时间差 > 2秒 且 当前时间 > 上次时间）
 */
export const updateNaturalPlayTime = (currentTime: number) => {
  // 如果正在跳转中，只更新 lastTime，不做检测（避免竞态条件）
  if (naturalPlayState.isSeeking) {
    naturalPlayState.lastTime = currentTime
    naturalPlayState.isSeeking = false
    return
  }

  if (!naturalPlayState.isNaturalPlay) {
    naturalPlayState.lastTime = currentTime
    return
  }

  const timeDiff = currentTime - naturalPlayState.lastTime
  // 只有向前跳转超过2秒才算破坏自然播放
  if (timeDiff > 2 && naturalPlayState.lastTime > 0) {
    naturalPlayState.isNaturalPlay = false
  }

  naturalPlayState.lastTime = currentTime
}
