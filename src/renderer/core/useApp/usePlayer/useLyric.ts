import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { debounce, throttle } from '@common/utils/common'
// import { setDesktopLyricInfo, onGetDesktopLyricInfo } from '@renderer/utils/ipc'
// import { musicInfo } from '@renderer/store/player/state'
import {
  pause,
  play,
  setLyric,
  stop,
  init,
  sendInfo,
  sendDesktopLyricInfo,
  setPlaybackRate,
} from '@renderer/core/lyric'
import { appSetting } from '@renderer/store/setting'
import { isPlay } from '@renderer/store/player/state'
import { lyric } from '@renderer/store/player/lyric'

const handleApplyPlaybackRate = debounce(setPlaybackRate, 300)

export default () => {
  init()

  const setPlayInfo = () => {
    stop()
    sendInfo()
  }

  // 进度跳转时同步歌词，增加节流防止拖动进度条时产生过多 IPC 消息
  const handleSetProgress = throttle((time: number) => {
    play(time * 1000)
  }, 100)

  // 拖动进度条时向桌面歌词发送预览进度（不真实跳转音频），
  // 让桌面歌词在松手前就平滑跟随，松手后由 setProgress 精确对齐
  const handleSetProgressPreview = throttle((time: number) => {
    sendDesktopLyricInfo({
      action: 'set_status',
      data: {
        isPlay: isPlay.value,
        line: lyric.line,
        played_time: time * 1000,
      },
    })
  }, 100)

  watch(() => appSetting['player.isShowLyricTranslation'], setLyric)
  watch(() => appSetting['player.isShowLyricRoma'], setLyric)
  watch(() => appSetting['player.isSwapLyricTranslationAndRoma'], setLyric)
  watch(() => appSetting['player.isPlayLxlrc'], setLyric)

  window.app_event.on('play', play)
  window.app_event.on('pause', pause)
  window.app_event.on('stop', stop)
  window.app_event.on('error', pause)
  window.app_event.on('musicToggled', setPlayInfo)
  window.app_event.on('lyricUpdated', setLyric)
  window.app_event.on('setPlaybackRate', handleApplyPlaybackRate)
  window.app_event.on('setProgress', handleSetProgress)
  window.app_event.on('setProgressPreview', handleSetProgressPreview)

  onBeforeUnmount(() => {
    window.app_event.off('play', play)
    window.app_event.off('pause', pause)
    window.app_event.off('stop', stop)
    window.app_event.off('error', pause)
    window.app_event.off('musicToggled', setPlayInfo)
    window.app_event.off('lyricUpdated', setLyric)
    window.app_event.off('setPlaybackRate', handleApplyPlaybackRate)
    window.app_event.off('setProgress', handleSetProgress)
    window.app_event.off('setProgressPreview', handleSetProgressPreview)
  })
}
