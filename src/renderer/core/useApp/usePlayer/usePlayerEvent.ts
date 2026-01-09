import { onBeforeUnmount } from '@common/utils/vueTools'
import {
  onPlaying,
  onPause,
  onEnded,
  onError,
  onLoadeddata,
  onLoadstart,
  onCanplay,
  onEmptied,
  onWaiting,
  getErrorCode,
} from '@renderer/plugins/player'
import { playMusicInfo, naturalPlayState } from '@renderer/store/player/state'
import { defaultList } from '@renderer/store/list/state'
import { addListMusics, checkListExistMusic } from '@renderer/store/list/action'
import { LIST_IDS } from '@common/constants'


export default () => {
  /**
   * 处理歌曲自然播放完成后的自动添加到试听列表
   * 适用于：
   * 1. TEMP 列表（歌曲市场的剩余歌曲）
   * 2. 临时播放的歌曲（isTempPlay = true，从歌曲市场直接播放）
   */
  const handleAutoAddToDefaultList = async () => {
    // 检查是否需要处理自动添加：TEMP 列表 或 临时播放
    const shouldAutoAdd = playMusicInfo.listId === LIST_IDS.TEMP || playMusicInfo.isTempPlay
    if (!shouldAutoAdd) return
    if (!playMusicInfo.musicInfo) return

    // 检查是否为自然播放（未向前拖动进度条）
    if (!naturalPlayState.isNaturalPlay) return

    // 获取歌曲信息
    const mInfo = 'progress' in playMusicInfo.musicInfo
      ? playMusicInfo.musicInfo.metadata.musicInfo
      : playMusicInfo.musicInfo

    // 检查歌曲是否已存在于试听列表，存在则静默跳过
    const isExist = await checkListExistMusic(defaultList.id, mInfo.id)
    if (isExist) return

    // 添加到试听列表
    await addListMusics(defaultList.id, [mInfo])
  }

  const rOnPlaying = onPlaying(() => {
    console.log('onPlaying')
    window.app_event.playerPlaying()
    window.app_event.play()
  })
  const rOnPause = onPause(() => {
    console.log('onPause')
    window.app_event.playerPause()
    window.app_event.pause()
  })
  const rOnEnded = onEnded(() => {
    console.log('onEnded')
    // 处理自然播放完成后的自动添加到试听列表
    void handleAutoAddToDefaultList()
    window.app_event.playerEnded()
    // window.app_event.pause()
  })
  const rOnError = onError(() => {
    console.log('onError')
    const errorCode = getErrorCode()
    window.app_event.error(errorCode)
    window.app_event.playerError(errorCode)
  })
  const rOnLoadeddata = onLoadeddata(() => {
    console.log('onLoadeddata')
    window.app_event.playerLoadeddata()
  })
  const rOnLoadstart = onLoadstart(() => {
    console.log('onLoadstart')
    window.app_event.playerLoadstart()
  })
  const rOnCanplay = onCanplay(() => {
    console.log('onCanplay')
    window.app_event.playerCanplay()
  })
  const rOnEmptied = onEmptied(() => {
    console.log('onEmptied')
    window.app_event.playerEmptied()
    // window.app_event.stop()
  })
  const rOnWaiting = onWaiting(() => {
    console.log('onWaiting')
    window.app_event.pause()
    window.app_event.playerWaiting()
  })


  onBeforeUnmount(() => {
    rOnPlaying()
    rOnPause()
    rOnEnded()
    rOnError()
    rOnLoadeddata()
    rOnLoadstart()
    rOnCanplay()
    rOnEmptied()
    rOnWaiting()
  })
}
