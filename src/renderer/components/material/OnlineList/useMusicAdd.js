import { ref, nextTick } from '@common/utils/vueTools'
import { getMusicExistListIds } from '@renderer/store/list/action'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { LIST_IDS } from '@common/constants'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@renderer/plugins/i18n'

export default ({ selectedList, props }) => {
  const t = useI18n()
  const isShowListAdd = ref(false)
  const isShowListAddMultiple = ref(false)
  const selectedAddMusicInfo = ref(null)

  const handleShowMusicAddModal = async (index, single) => {
    if (selectedList.value.length && !single) {
      isShowListAddMultiple.value = true
    } else {
      const musicInfo = props.list[index]
      const existListIds = await getMusicExistListIds(musicInfo)
      const targetListIds = existListIds.filter(id => id !== LIST_IDS.TEMP)

      if (targetListIds.length) {
        const listNames = []
        if (targetListIds.includes(LIST_IDS.DEFAULT)) listNames.push(t(defaultList.name))
        if (targetListIds.includes(LIST_IDS.LOVE)) listNames.push(t(loveList.name))
        userLists.forEach(l => {
          if (targetListIds.includes(l.id)) listNames.push(l.name)
        })

        if (listNames.length) {
          const confirm = await dialog.confirm(`${t('list_add__duplicate_tip')}\n${listNames.join('\n')}\n${t('list_add__confirm')}`)
          if (!confirm) return
        }
      }

      selectedAddMusicInfo.value = musicInfo
      nextTick(() => {
        isShowListAdd.value = true
      })
    }
  }

  return {
    isShowListAdd,
    isShowListAddMultiple,
    selectedAddMusicInfo,
    handleShowMusicAddModal,
  }
}
