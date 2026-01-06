import { watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { setEffectSettings, syncDesktopEffectSettings } from '@renderer/core/lyric'

export default () => {
    // Watch play detail effect settings
    watch([
        () => appSetting['playDetail.effect.enable'],
        () => appSetting['playDetail.effect.floatEnabled'],
        () => appSetting['playDetail.effect.scaleEnabled'],
        () => appSetting['playDetail.effect.glowAnimateEnabled'],
        () => appSetting['playDetail.style.lyricGlowMode'],
        () => appSetting['playDetail.style.lyricGlowColor1'],
    ], () => {
        setEffectSettings()
    })

    // Watch desktop lyric effect settings
    watch([
        () => appSetting['desktopLyric.effect.enable'],
        () => appSetting['desktopLyric.effect.floatEnabled'],
        () => appSetting['desktopLyric.effect.scaleEnabled'],
        () => appSetting['desktopLyric.effect.glowAnimateEnabled'],
        () => appSetting['desktopLyric.style.lyricGlowMode'],
        () => appSetting['desktopLyric.style.lyricGlowColor1'],
    ], () => {
        syncDesktopEffectSettings()
    })
}
