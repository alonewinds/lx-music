import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { sendPlayerStatus, onPlayerAction } from '@renderer/utils/ipc'
// import store from '@renderer/store'

import { loveList } from '@renderer/store/list/state'
import { addListMusics, removeListMusics, checkListExistMusic } from '@renderer/store/list/action'
import { playMusicInfo, musicInfo } from '@renderer/store/player/state'
import { throttle } from '@common/utils'
import { pause, play, playNext, playPrev } from '@renderer/core/player'
import { playProgress } from '@renderer/store/player/playProgress'
import { appSetting } from '@renderer/store/setting'
import { lyric } from '@renderer/store/player/lyric'

export default () => {
  // const setVisibleDesktopLyric = useCommit('setVisibleDesktopLyric')
  // const setLockDesktopLyric = useCommit('setLockDesktopLyric')
  let collect = false
  // 记录最近一次触发的歌词行号与其行的开始时刻（墙钟）。
  // 暂停后恢复播放时 line-player 会重新触发当前行的 onPlay（lyricLinePlay），
  // 若此时重新生成 lyricLineStartMs，会导致任务栏歌词窗口因 startMs 变化而重挂载，
  // 触发上滚过渡并重刷逐字动画；同一行重复触发时保持 startMs 不变即可从原进度继续。
  let lastLyricLineNum: number | null = null
  let lastLyricLineStartMs = 0

  const updateCollectStatus = async() => {
    let status = !!playMusicInfo.musicInfo && await checkListExistMusic(loveList.id, playMusicInfo.musicInfo.id)
    if (collect == status) return false
    collect = status
    return true
  }

  const handlePlay = () => {
    sendPlayerStatus({ status: 'playing' })
  }
  const handlePause = () => {
    sendPlayerStatus({ status: 'paused' })
  }
  const handleStop = () => {
    if (playMusicInfo.musicInfo != null) return
    sendPlayerStatus({ status: 'stoped' })
  }
  const handleError = () => {
    sendPlayerStatus({ status: 'error' })
  }
  const handleSetPlayInfo = async() => {
    await updateCollectStatus()
    lastLyricLineNum = null
    sendPlayerStatus({
      collect,
      name: musicInfo.name,
      singer: musicInfo.singer,
      albumName: musicInfo.album,
      picUrl: musicInfo.pic ?? '',
      lyric: musicInfo.lrc ?? '',
      lyricLineText: '',
      lyricLineAllText: '',
    })
  }
  const handleSetLyric = () => {
    lastLyricLineNum = null
    sendPlayerStatus({
      lyric: musicInfo.lrc ?? '',
      tlyric: musicInfo.tlrc ?? '',
      rlyric: musicInfo.rlrc ?? '',
      lxlyric: musicInfo.lxlrc ?? '',
      lyricLineText: '',
      lyricLineAllText: '',
    })
  }
  const handleSetPic = () => {
    sendPlayerStatus({
      picUrl: musicInfo.pic ?? '',
    })
  }
  const fontTimeExp = /<(\d+),(\d+)>/g
  const handleSetLyricLine = (text: string, line: number) => {
    let curLine = lyric.lines[line]?.extendedLyrics.join('\n') ?? ''
    
    let lyricLineChars = null
    const rawText = lyric.lines[line]?.rawText ?? ''
    if (rawText.match(fontTimeExp)) {
      lyricLineChars = []
      const parts = rawText.split(fontTimeExp)
      let i = 1
      while (i < parts.length - 1) {
        const startMs = parseInt(parts[i], 10)
        const durationMs = parseInt(parts[i + 1], 10)
        const char = parts[i + 2] || ''
        if (char) {
          lyricLineChars.push({ char, startMs, durationMs })
        }
        i += 3
      }
    }

    // 同一行被重复触发（如暂停后恢复播放会重新定位到当前行）时不刷新行的开始时刻，
    // 避免任务栏歌词窗口因 startMs 变化而重挂载，触发上滚过渡并重刷逐字动画
    const isSameLine = line === lastLyricLineNum
    lastLyricLineNum = line
    if (!isSameLine) lastLyricLineStartMs = Date.now()

    sendPlayerStatus({
      lyricLineText: text,
      lyricLineAllText: curLine ? text + '\n' + curLine : text,
      lyricLineChars,
      lyricLineStartMs: lastLyricLineStartMs,
    })
  }
  // const handleSetTaskbarThumbnailClip = (clip) => {
  //   setTaskbarThumbnailClip(clip)
  // }
  const throttleListChange = throttle(async listIds => {
    if (!listIds.includes(loveList.id)) return
    if (await updateCollectStatus()) sendPlayerStatus({ collect })
  })
  // const updateSetting = () => {
  //   const setting = store.getters.setting
  //   buttons.lrc = setting.desktopLyric.enable
  //   buttons.lockLrc = setting.desktopLyric.isLock
  //   setButtons()
  // }
  const rTaskbarThumbarClick = onPlayerAction(async({ params: { action, data } }) => {
    switch (action) {
      case 'play':
        play()
        break
      case 'pause':
        pause()
        break
      case 'prev':
        void playPrev()
        break
      case 'next':
        void playNext()
        break
      case 'collect':
        if (!playMusicInfo.musicInfo) return
        void addListMusics(loveList.id, ['progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo])
        if (await updateCollectStatus()) sendPlayerStatus({ collect })
        break
      case 'unCollect':
        if (!playMusicInfo.musicInfo) return
        void removeListMusics({ listId: loveList.id, ids: ['progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo.id : playMusicInfo.musicInfo.id] })
        if (await updateCollectStatus()) sendPlayerStatus({ collect })
        break
      case 'seek': {
        let progress = data as number
        if (progress < 0) progress = 0
        else if (progress > playProgress.maxPlayTime) progress = playProgress.maxPlayTime
        window.app_event.setProgress(progress)
        break
      }
      case 'mute':
        window.app_event.setVolumeIsMute(data as boolean)
        break
      case 'volume':
        window.app_event.setVolume(data as number)
        break
      // case 'lrc':
      //   setVisibleDesktopLyric(true)
      //   updateSetting()
      //   break
      // case 'unLrc':
      //   setVisibleDesktopLyric(false)
      //   updateSetting()
      //   break
      // case 'lockLrc':
      //   setLockDesktopLyric(true)
      //   updateSetting()
      //   break
      // case 'unlockLrc':
      //   setLockDesktopLyric(false)
      //   updateSetting()
      //   break
    }
  })
  watch(() => playProgress.nowPlayTime, (newValue, oldValue) => {
    // console.log(playProgress.nowPlayTime, newValue, oldValue)
    // if (newValue.toFixed(2) === oldValue.toFixed(2)) return
    // console.log(playProgress.nowPlayTime)
    sendPlayerStatus({ progress: newValue })
  })
  watch(() => playProgress.maxPlayTime, (newValue) => {
    sendPlayerStatus({ duration: newValue })
  })
  watch(() => appSetting['player.playbackRate'], rate => {
    sendPlayerStatus({ playbackRate: rate })
  })

  window.app_event.on('play', handlePlay)
  window.app_event.on('pause', handlePause)
  window.app_event.on('stop', handleStop)
  window.app_event.on('error', handleError)
  window.app_event.on('musicToggled', handleSetPlayInfo)
  window.app_event.on('lyricUpdated', handleSetLyric)
  window.app_event.on('picUpdated', handleSetPic)
  window.app_event.on('lyricLinePlay', handleSetLyricLine)
  // window.app_event.on(eventTaskbarNames.setTaskbarThumbnailClip, handleSetTaskbarThumbnailClip)
  window.app_event.on('myListUpdate', throttleListChange)

  onBeforeUnmount(() => {
    rTaskbarThumbarClick()
    window.app_event.off('play', handlePlay)
    window.app_event.off('pause', handlePause)
    window.app_event.off('stop', handleStop)
    window.app_event.off('error', handleError)
    window.app_event.off('musicToggled', handleSetPlayInfo)
    window.app_event.off('lyricUpdated', handleSetLyric)
    window.app_event.off('picUpdated', handleSetPic)
    window.app_event.off('lyricLinePlay', handleSetLyricLine)
    // window.app_event.off(eventTaskbarNames.setTaskbarThumbnailClip, handleSetTaskbarThumbnailClip)
    window.app_event.off('myListUpdate', throttleListChange)
  })

  return async() => {
    // const setting = store.getters.setting
    // buttons.lrc = setting.desktopLyric.enable
    // buttons.lockLrc = setting.desktopLyric.isLock
    await updateCollectStatus()
    if (playMusicInfo.musicInfo == null) return
    sendPlayerStatus({
      collect,
      name: musicInfo.name,
      singer: musicInfo.singer,
      albumName: musicInfo.album,
      playbackRate: appSetting['player.playbackRate'],
      picUrl: musicInfo.pic ?? '',
      lyric: musicInfo.lrc ?? '',
      tlyric: musicInfo.tlrc ?? '',
      rlyric: musicInfo.rlrc ?? '',
      lxlyric: musicInfo.lxlrc ?? '',
    })
  }
}
