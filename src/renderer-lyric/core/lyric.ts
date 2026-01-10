import Lyric from '@common/utils/lyric-font-player'
import { markRawList, watch } from '@common/utils/vueTools'
import { setLines, setOffset, setTempOffset, setText, lyrics } from '@lyric/store/lyric'
import { musicInfo, setting } from '@lyric/store/state'

let lrc: Lyric

export const init = () => {
  lrc = new Lyric({
    shadowContent: true,
    activeLineClassName: 'active',
    rate: setting['player.playbackRate'],
    isVertical: setting['desktopLyric.direction'] == 'vertical',
    effectSettings: {
      enable: setting['desktopLyric.effect.enable'],
      floatEnabled: false, // Sync logic: Always disable float for AMLL feel
      floatAmount: setting['desktopLyric.effect.floatAmount'],
      scaleEnabled: setting['desktopLyric.style.isZoomActiveLrc'], // Local control
      scaleAmount: setting['desktopLyric.effect.scaleAmount'] > 1 ? setting['desktopLyric.effect.scaleAmount'] : 1.2,
      scaleLongSyllableDuration: 0,
    } as any,
    onPlay(line, text) {
      setText(text, Math.max(line, 0))
    },
    onSetLyric(lines, offset) {
      setLines(markRawList([...lines]))
      setText(lines[0] ?? '', 0)
      setOffset(offset)
      setTempOffset(0)
    },
    onUpdateLyric(lines) {
      setLines(markRawList([...lines]))
      setText(lines[0] ?? '', 0)
    },
  })

  // Watch for setting changes and update effects
  watch([
    () => setting['desktopLyric.effect.enable'],
    () => setting['desktopLyric.effect.floatEnabled'],
    () => setting['desktopLyric.effect.floatAmount'],
    () => setting['desktopLyric.effect.scaleEnabled'],
    () => setting['desktopLyric.effect.scaleAmount'],
    () => setting['desktopLyric.effect.scaleLongSyllableDuration'],
    () => setting['desktopLyric.style.isZoomActiveLrc'],
  ], () => {
    setEffectSettings({
      enable: setting['desktopLyric.effect.enable'],
      floatEnabled: setting['desktopLyric.effect.floatEnabled'],
      floatAmount: setting['desktopLyric.effect.floatAmount'],
      scaleEnabled: setting['desktopLyric.style.isZoomActiveLrc'],
      scaleAmount: setting['desktopLyric.effect.scaleAmount'],
      scaleLongSyllableDuration: setting['desktopLyric.effect.scaleLongSyllableDuration'],
    })
  })
}

export const setLyricOffset = (offset: number) => {
  setTempOffset(offset)
  lrc.setOffset(offset)
}

export const setPlaybackRate = (rate: number) => {
  lrc.setPlaybackRate(rate)
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
  const extendedLyrics = []
  if (setting['player.isShowLyricRoma'] && lyrics.rlyric) {
    extendedLyrics.push(filterEmptyLines(lyrics.rlyric))
  }
  if (setting['player.isShowLyricTranslation'] && lyrics.tlyric) {
    extendedLyrics.push(filterEmptyLines(lyrics.tlyric))
  }
  if (setting['player.isSwapLyricTranslationAndRoma']) extendedLyrics.reverse()

  const mainLrc = setting['player.isPlayLxlrc'] && lyrics.lxlyric ? lyrics.lxlyric : lyrics.lyric

  lrc.setLyric(
    filterEmptyLines(mainLrc),
    extendedLyrics,
  )
}

export const play = (time: number) => {
  if (!lyrics.lyric) return
  lrc.play(time)
}

export const pause = () => {
  lrc.pause()
}

export const stop = () => {
  lrc.setLyric('')
  setText('', 0)
}

export const setVertical = (isVertical: boolean) => {
  lrc.setVertical(isVertical)
}

export const setEffectSettings = (settings: LX.DesktopLyric.EffectSettings) => {
  const { floatAmount, scaleAmount, scaleEnabled } = settings
  // Sync logic with play detail: Disable float, scale controlled by local zoom toggle
  lrc.setEffectSettings({
    floatEnabled: false,
    floatAmount,
    scaleEnabled: !!scaleEnabled,
    scaleAmount: scaleAmount > 1 ? scaleAmount : 1.2,
    scaleLongSyllableDuration: 0,
  })
}
