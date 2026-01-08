<template lang="pug">
dt#play_detail {{ $t('setting__play_detail') }}
dd
  .gap-top
    base-checkbox(id="setting_play_detail_font_zoom_enable" :model-value="appSetting['playDetail.isZoomActiveLrc']" :label="$t('setting__play_detail_font_zoom')" @update:model-value="updateSetting({'playDetail.isZoomActiveLrc': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_delayScroll" :model-value="appSetting['playDetail.isDelayScroll']" :label="$t('setting__play_detail_lyric_delay_scroll')" @update:model-value="updateSetting({ 'playDetail.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_progress_enable" :model-value="appSetting['playDetail.isShowLyricProgressSetting']" :label="$t('setting__play_detail_lyric_progress')" @update:model-value="updateSetting({'playDetail.isShowLyricProgressSetting': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_effect_enable" :model-value="appSetting['playDetail.effect.enable']" :label="$t('setting__effect_enable')" @update:model-value="updateSetting({'playDetail.effect.enable': $event})")

dd
  h3#play_detail_align {{ $t('setting__play_detail_align') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_align_left" :model-value="appSetting['playDetail.style.align']" need value="left" :label="$t('setting__play_detail_align_left')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_center" :model-value="appSetting['playDetail.style.align']" need value="center" :label="$t('setting__play_detail_align_center')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_right" :model-value="appSetting['playDetail.style.align']" need value="right" :label="$t('setting__play_detail_align_right')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")

dd
  h3#play_detail_font {{ $t('setting__desktop_lyric_font') }}
  div
    base-selection.gap-left(:list="fontList" :model-value="appSetting['playDetail.style.font']" item-key="id" item-name="label" @update:model-value="updateSetting({ 'playDetail.style.font': $event })")

</template>

<script>
import { ref, computed } from '@common/utils/vueTools'
import { getSystemFonts } from '@renderer/utils/ipc'
import {
  appSetting,
  updateSetting,
} from '@renderer/store/setting'
import { useI18n } from '@renderer/plugins/i18n'

export default {
  name: 'SettingPlayDetail',
  setup() {
    const t = useI18n()
    const systemFontList = ref([])
    const fontList = computed(() => {
      return [{ id: '', label: t('setting__desktop_lyric_font_default') }, ...systemFontList.value]
    })
    void getSystemFonts().then(fonts => {
      if (fonts) systemFontList.value = fonts.map(f => ({ id: f, label: f.replace(/(^"|"$)/g, '') }))
    })

    return {
      appSetting,
      updateSetting,
      fontList,
    }
  },
}
</script>

