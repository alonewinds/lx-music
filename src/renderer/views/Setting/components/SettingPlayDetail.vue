<template lang="pug">
dt#play_detail {{ $t('setting__play_detail') }}
dd
  .gap-top
    base-checkbox(id="setting_play_detail_font_zoom_enable" :model-value="appSetting['playDetail.isZoomActiveLrc']" :label="$t('setting__play_detail_font_zoom')" @update:model-value="updateSetting({'playDetail.isZoomActiveLrc': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_delayScroll" :model-value="appSetting['playDetail.isDelayScroll']" :label="$t('setting__play_detail_lyric_delay_scroll')" @update:model-value="updateSetting({ 'playDetail.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_progress_enable" :model-value="appSetting['playDetail.isShowLyricProgressSetting']" :label="$t('setting__play_detail_lyric_progress')" @update:model-value="updateSetting({'playDetail.isShowLyricProgressSetting': $event})")

dd
  h3#play_detail_align {{ $t('setting__play_detail_align') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_align_left" :model-value="appSetting['playDetail.style.align']" need value="left" :label="$t('setting__play_detail_align_left')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_center" :model-value="appSetting['playDetail.style.align']" need value="center" :label="$t('setting__play_detail_align_center')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_right" :model-value="appSetting['playDetail.style.align']" need value="right" :label="$t('setting__play_detail_align_right')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")

dd
  h3#play_detail_glow {{ $t('lyric_menu__glow_effect') }}
  div
    .gap-top
      base-checkbox.gap-left(v-for="item in glowModeList" :key="item.id" :id="'setting_play_detail_glow_mode_' + item.id" :model-value="appSetting['playDetail.style.lyricGlowMode']" :value="item.id" :label="item.name" @update:model-value="setLyricGlowMode($event || 'none')")
    .p.gap-top
      div(:class="$style.groupContent")
        div(:class="$style.item")
          div(ref="glow_color1_ref" :class="$style.color")
          div(:class="$style.label") {{ $t('lyric_menu__glow_color1') }}
        div(:class="$style.item")
          div(ref="glow_color2_ref" :class="$style.color")
          div(:class="$style.label") {{ $t('lyric_menu__glow_color2') }}
    .gap-top
      span.label {{ $t('lyric_menu__glow_intensity') }}: 
      base-slider-bar.gap-left(:min="0.1" :max="2" :value="appSetting['playDetail.style.lyricGlowIntensity']" @change="setLyricGlowIntensity")

</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import {
  appSetting,
  updateSetting,
  setLyricGlowMode,
  setLyricGlowColor1,
  setLyricGlowColor2,
  setLyricGlowIntensity,
} from '@renderer/store/setting'
import { useI18n } from '@renderer/plugins/i18n'
import { pickrTools } from '@renderer/utils/pickrTools'

const defaultGlowColors = [
  'rgba(255, 255, 255, 1)',
  'rgba(255, 236, 144, 1)',
  'rgba(144, 255, 206, 1)',
  'rgba(32, 255, 132, 1)',
  'rgba(255, 226, 32, 1)',
  'rgba(7, 197, 86, 1)',
  'rgba(25, 181, 254, 1)',
  'rgba(217, 57, 255, 1)',
  'rgba(255, 57, 71, 1)',
]

const useGlowColor = () => {
  const glow_color1_ref = ref(null)
  const glow_color2_ref = ref(null)
  let tools1
  let tools2

  const initGlowColor1 = (color, changed, reset) => {
    if (!glow_color1_ref.value) return
    tools1 = pickrTools.create(glow_color1_ref.value, color, defaultGlowColors, changed, reset)
  }
  const destroyGlowColor1 = () => {
    if (!tools1) return
    tools1.destroy()
    tools1 = null
  }

  const initGlowColor2 = (color, changed, reset) => {
    if (!glow_color2_ref.value) return
    tools2 = pickrTools.create(glow_color2_ref.value, color, defaultGlowColors, changed, reset)
  }
  const destroyGlowColor2 = () => {
    if (!tools2) return
    tools2.destroy()
    tools2 = null
  }

  const initColors = () => {
    initGlowColor1(appSetting['playDetail.style.lyricGlowColor1'], (color) => {
      setLyricGlowColor1(color)
    })
    initGlowColor2(appSetting['playDetail.style.lyricGlowColor2'], (color) => {
      setLyricGlowColor2(color)
    })
  }

  const destroyColors = () => {
    destroyGlowColor1()
    destroyGlowColor2()
  }

  onMounted(() => {
    initColors()
  })
  onBeforeUnmount(() => {
    destroyColors()
  })

  return {
    glow_color1_ref,
    glow_color2_ref,
  }
}

export default {
  name: 'SettingPlayDetail',
  setup() {
    const t = useI18n()
    const {
      glow_color1_ref,
      glow_color2_ref,
    } = useGlowColor()

    const glowModeList = computed(() => {
      return [
        { id: 'soft', name: t('lyric_menu__glow_soft') },
        { id: 'gradient', name: t('lyric_menu__glow_gradient') },
      ]
    })

    return {
      appSetting,
      updateSetting,
      glowModeList,
      setLyricGlowMode,
      setLyricGlowIntensity,
      glow_color1_ref,
      glow_color2_ref,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.groupContent {
  display: flex;
  flex-flow: row wrap;
}
.item {
  padding-right: 40px;
  width: 70px;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
}
.color {
  width: 80%;
  aspect-ratio: 1 / 1;
  background-color: var(--pcr-color);
  border-radius: @radius-border;
  cursor: pointer;
  transition: @transition-fast !important;
  transition-property: background-color, opacity !important;
  box-shadow: 0 0 3px var(--color-primary-light-100-alpha-300);
  &:hover {
    opacity: .7;
  }
}
.label {
  .mixin-ellipsis-2();
  padding-top: 10px;
  text-align: center;
  line-height: 1.1;
}
</style>
