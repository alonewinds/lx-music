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
      floatEnabled: setting['desktopLyric.effect.enable'],
      floatAmount: setting['desktopLyric.effect.floatAmount'],
      scaleEnabled: setting['desktopLyric.effect.enable'],
      scaleAmount: setting['desktopLyric.effect.scaleAmount'],
      scaleLongSyllableDuration: setting['desktopLyric.effect.scaleLongSyllableDuration'],
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
  ], () => {
    setEffectSettings({
      enable: setting['desktopLyric.effect.enable'],
      floatEnabled: setting['desktopLyric.effect.floatEnabled'],
      floatAmount: setting['desktopLyric.effect.floatAmount'],
      scaleEnabled: setting['desktopLyric.effect.scaleEnabled'],
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

export const setLyric = () => {
  if (!musicInfo.id) return
  const extendedLyrics = []
  if (setting['player.isShowLyricRoma'] && lyrics.rlyric) extendedLyrics.push(lyrics.rlyric)
  if (setting['player.isShowLyricTranslation'] && lyrics.tlyric) extendedLyrics.push(lyrics.tlyric)
  if (setting['player.isSwapLyricTranslationAndRoma']) extendedLyrics.reverse()
  lrc.setLyric(
    setting['player.isPlayLxlrc'] && lyrics.lxlyric ? lyrics.lxlyric : lyrics.lyric,
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
  const { enable, floatAmount, scaleAmount, scaleLongSyllableDuration } = settings
  // When main enable toggle is on, enable all effects automatically
  lrc.setEffectSettings({
    floatEnabled: enable,
    floatAmount,
    scaleEnabled: enable,
    scaleAmount,
    scaleLongSyllableDuration,
  })
}
