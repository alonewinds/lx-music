import Lyric from '@common/utils/lyric-font-player'
import { getAnalyser, getCurrentTime as getPlayerCurrentTime } from '@renderer/plugins/player'
import { lyric, setLines, setOffset, setTempOffset, setText } from '@renderer/store/player/lyric'
import { isPlay, musicInfo } from '@renderer/store/player/state'
import { setStatusText } from '@renderer/store/player/action'
import { markRawList } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { onNewDesktopLyricProcess } from '@renderer/utils/ipc'

const getCurrentTime = () => {
  return getPlayerCurrentTime() * 1000
}

let lrc: Lyric
let desktopLyricPort: Electron.IpcRendererEvent['ports'][0] | null = null
const analyserTools: {
  dataArray: Uint8Array
  bufferLength: number
  analyser: AnalyserNode | null
  sendDataArray: () => void
} = {
  dataArray: new Uint8Array(),
  bufferLength: 0,
  analyser: null,
  sendDataArray() {
    if (this.analyser == null) {
      this.analyser = getAnalyser()
      // console.log(this.analyser)
      if (!this.analyser) return
      this.bufferLength = this.analyser.frequencyBinCount
    }
    const dataArray = new Uint8Array(this.bufferLength)
    this.analyser.getByteFrequencyData(dataArray)
    sendDesktopLyricInfo({
      action: 'send_analyser_data_array',
      data: dataArray,
    }, [dataArray.buffer])
  },
}

export const sendDesktopLyricInfo = (info: LX.DesktopLyric.LyricActions, transferList?: Transferable[]) => {
  if (desktopLyricPort == null) return
  if (transferList) desktopLyricPort.postMessage(info, transferList)
  else desktopLyricPort.postMessage(info)
}
const handleDesktopLyricMessage = (action: LX.DesktopLyric.WinMainActions) => {
  switch (action) {
    case 'get_info':
      sendDesktopLyricInfo({
        action: 'set_info',
        data: {
          id: musicInfo.id,
          singer: musicInfo.singer,
          name: musicInfo.name,
          album: musicInfo.album,
          lrc: filterEmptyLines(musicInfo.lrc || ''),
          tlrc: filterEmptyLines(musicInfo.tlrc || ''),
          rlrc: filterEmptyLines(musicInfo.rlrc || ''),
          lxlrc: filterEmptyLines(musicInfo.lxlrc || ''),
          // pic: musicInfo.pic,
          isPlay: isPlay.value,
          line: lyric.line,
          played_time: getCurrentTime(),
          effectSettings: {
            enable: appSetting['desktopLyric.effect.enable'],
            floatEnabled: appSetting['desktopLyric.effect.floatEnabled'],
            floatAmount: appSetting['desktopLyric.effect.floatAmount'],
            scaleEnabled: appSetting['desktopLyric.effect.scaleEnabled'],
            scaleAmount: appSetting['desktopLyric.effect.scaleAmount'],
            scaleLongSyllableDuration: appSetting['desktopLyric.effect.scaleLongSyllableDuration'],
          },
        },
      })
      break
    case 'get_status':
      sendDesktopLyricInfo({
        action: 'set_status',
        data: {
          isPlay: isPlay.value,
          line: lyric.line,
          played_time: getCurrentTime(),
        },
      })
      break
    case 'get_analyser_data_array':
      analyserTools.sendDataArray()
      break
    default:
      break
  }
}
export const init = () => {
  lrc = new Lyric({
    shadowContent: false,
    onPlay(line, text) {
      setText(text, Math.max(line, 0))
      setStatusText(text)
      window.app_event.lyricLinePlay(text, line)
      // console.log(line, text)
    },
    onSetLyric(lines, offset) { // listening lyrics seting event
      // console.log(lines) // lines is array of all lyric text
      setLines(markRawList([...lines]))
      setText(lines[0] ?? '', 0)
      setOffset(offset) // 歌词延迟
      setTempOffset(0) // 重置临时延迟
    },
    onUpdateLyric(lines) {
      setLines(markRawList([...lines]))
      setText(lines[0] ?? '', 0)
    },
    rate: appSetting['player.playbackRate'],
    effectSettings: {
      enable: appSetting['playDetail.effect.enable'],
      floatEnabled: false,
      floatAmount: appSetting['playDetail.effect.floatAmount'],
      scaleEnabled: appSetting['playDetail.effect.enable'],
      scaleAmount: appSetting['playDetail.effect.scaleAmount'] > 1 ? appSetting['playDetail.effect.scaleAmount'] : 1.2,
      scaleLongSyllableDuration: 0,
    } as any,
    // offset: 80,
  })

  onNewDesktopLyricProcess(({ event }) => {
    console.log('onNewDesktopLyricProcess')
    const [port] = event.ports
    desktopLyricPort = port

    port.onmessage = ({ data }) => {
      handleDesktopLyricMessage(data.action)
      // The event data can be any serializable object (and the event could even
      // carry other MessagePorts with it!)
      // const result = doWork(event.data)
      // port.postMessage(result)
    }

    port.onmessageerror = (event) => {
      console.log('onmessageerror', event)
    }
  })
}

export const setLyricOffset = (offset: number) => {
  const tempOffset = offset - lyric.offset
  setTempOffset(tempOffset)
  lrc.setOffset(tempOffset)
  sendDesktopLyricInfo({
    action: 'set_offset',
    data: tempOffset,
  })

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime()
      sendDesktopLyricInfo({
        action: 'set_play',
        data: time,
      })
      lrc.play(time)
    })
  }
}

export const setPlaybackRate = (rate: number) => {
  lrc.setPlaybackRate(rate)

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime()
      lrc.play(time)
    })
  }
}

const filterEmptyLines = (lrc: string) => {
  if (!lrc) return ''
  return lrc.split(/\r\n|\r|\n/).filter(line => {
    const text = line.replace(/\[[\d:.]+\]/g, '').replace(/<\d+,\d+>/g, '').trim()
    return text.length > 0 && text !== '//'
  }).join('\n')
}

export const setLyric = () => {
  if (!musicInfo.id) return

  // 处理歌词（包括空歌词的情况）
  const extendedLyrics = []
  if (musicInfo.lrc) {
    if (appSetting['player.isShowLyricRoma'] && musicInfo.rlrc) {
      extendedLyrics.push(filterEmptyLines(musicInfo.rlrc))
    }
    if (appSetting['player.isShowLyricTranslation'] && musicInfo.tlrc) {
      extendedLyrics.push(filterEmptyLines(musicInfo.tlrc))
    }
    if (appSetting['player.isSwapLyricTranslationAndRoma']) extendedLyrics.reverse()
  }

  // 设置歌词（空字符串会清空歌词显示）
  const mainLrc = musicInfo.lrc
    ? (appSetting['player.isPlayLxlrc'] && musicInfo.lxlrc ? musicInfo.lxlrc : musicInfo.lrc)
    : ''

  lrc.setLyric(
    filterEmptyLines(mainLrc),
    extendedLyrics,
  )

  // 同步到桌面歌词
  sendDesktopLyricInfo({
    action: 'set_lyric',
    data: {
      lrc: filterEmptyLines(musicInfo.lrc || ''),
      tlrc: filterEmptyLines(musicInfo.tlrc || ''),
      rlrc: filterEmptyLines(musicInfo.rlrc || ''),
      lxlrc: filterEmptyLines(musicInfo.lxlrc || ''),
    },
  })

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime()
      sendDesktopLyricInfo({ action: 'set_play', data: time })
      lrc.play(time)
    })
  }
}

export const setDisabledAutoPause = (disabledAutoPause: boolean) => {
  lrc.setDisabledAutoPause(disabledAutoPause)
}

export const setEffectSettings = () => {
  const enable = appSetting['playDetail.effect.enable']
  // When main enable toggle is on, enable all effects automatically
  const effectSettings = {
    floatEnabled: false, // Disable float for Impact Scale effect
    floatAmount: appSetting['playDetail.effect.floatAmount'],
    scaleEnabled: enable,
    scaleAmount: appSetting['playDetail.effect.scaleAmount'] > 1 ? appSetting['playDetail.effect.scaleAmount'] : 1.2, // Ensure scale > 1
    scaleLongSyllableDuration: 0, // Apply to all syllables
  }
  lrc.setEffectSettings(effectSettings)
}

export const syncDesktopEffectSettings = () => {
  const enable = appSetting['desktopLyric.effect.enable']
  // When main enable toggle is on, enable all effects automatically
  sendDesktopLyricInfo({
    action: 'set_effect_settings',
    data: {
      enable,
      floatEnabled: enable,
      floatAmount: appSetting['desktopLyric.effect.floatAmount'],
      scaleEnabled: enable,
      scaleAmount: appSetting['desktopLyric.effect.scaleAmount'],
      scaleLongSyllableDuration: appSetting['desktopLyric.effect.scaleLongSyllableDuration'],
    },
  })
}

let sources = new Map<string, boolean>()
let prevDisabled = false
export const setDisableAutoPauseBySource = (disabled: boolean, source: string) => {
  sources.set(source, disabled)
  const currentDisabled = Array.from(sources.values()).some(e => e)
  if (prevDisabled == currentDisabled) return
  prevDisabled = currentDisabled
  setDisabledAutoPause(currentDisabled)
}


export const play = (time?: number) => {
  // if (!musicInfo.lrc) return
  const currentTime = time ?? getCurrentTime()
  lrc.play(currentTime)

  // 如果是系统触发的续播（time 为空），或者当前正在播放，则发送播放指令
  if (time === undefined || isPlay.value) {
    sendDesktopLyricInfo({ action: 'set_play', data: currentTime })
  } else {
    // 只有在暂停状态下的跳转（time 不为空），才执行跳转后立即暂停
    lrc.pause()
    sendDesktopLyricInfo({
      action: 'set_status',
      data: {
        isPlay: false,
        line: lyric.line,
        played_time: currentTime,
      },
    })
  }
}

export const pause = () => {
  lrc.pause()
  sendDesktopLyricInfo({ action: 'set_pause' })
}

export const stop = () => {
  lrc.setLyric('')
  sendDesktopLyricInfo({ action: 'set_stop' })
  // setLines([])
  setText('', 0)
}

export const sendInfo = () => {
  sendDesktopLyricInfo({
    action: 'set_info',
    data: {
      id: musicInfo.id,
      singer: musicInfo.singer,
      name: musicInfo.name,
      album: musicInfo.album,
      lrc: filterEmptyLines(musicInfo.lrc || ''),
      tlrc: filterEmptyLines(musicInfo.tlrc || ''),
      rlrc: filterEmptyLines(musicInfo.rlrc || ''),
      lxlrc: filterEmptyLines(musicInfo.lxlrc || ''),
      // pic: musicInfo.pic,
      isPlay: isPlay.value,
      line: lyric.line,
      played_time: getCurrentTime(),
      effectSettings: {
        enable: appSetting['desktopLyric.effect.enable'],
        floatEnabled: appSetting['desktopLyric.effect.floatEnabled'],
        floatAmount: appSetting['desktopLyric.effect.floatAmount'],
        scaleEnabled: appSetting['desktopLyric.effect.scaleEnabled'],
        scaleAmount: appSetting['desktopLyric.effect.scaleAmount'],
        scaleLongSyllableDuration: appSetting['desktopLyric.effect.scaleLongSyllableDuration'],
      },
    },
  })
}
