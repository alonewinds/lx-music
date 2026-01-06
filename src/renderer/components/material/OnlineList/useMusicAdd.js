import { ref, nextTick } from '@common/utils/vueTools'
import { getMusicExistListIds, getListMusics } from '@renderer/store/list/action'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { LIST_IDS } from '@common/constants'
import { useI18n } from '@renderer/plugins/i18n'

export default ({ selectedList, props }) => {
  const t = useI18n()
  const isShowListAdd = ref(false)
  const isShowListAddMultiple = ref(false)
  const selectedAddMusicInfo = ref(null)

  // 重复歌曲提示模态框相关状态
  const isShowDuplicateModal = ref(false)
  const duplicateExistingLists = ref([])
  const pendingMusicInfo = ref(null)

  const handleShowMusicAddModal = async (index, single) => {
    if (selectedList.value.length && !single) {
      isShowListAddMultiple.value = true
    } else {
      const musicInfo = props.list[index]
      const existListIds = await getMusicExistListIds(musicInfo)
      // 排除临时列表和播放列表（默认列表）
      const targetListIds = existListIds.filter(id => id !== LIST_IDS.TEMP && id !== LIST_IDS.DEFAULT)

      if (targetListIds.length) {
        // 构建存在歌曲的歌单信息列表
        const existingLists = []

        if (targetListIds.includes(LIST_IDS.LOVE)) {
          // 在收藏列表中查找歌曲的 ID
          const loveMusics = await getListMusics(LIST_IDS.LOVE)
          const foundMusic = loveMusics.find(m => m.id === musicInfo.id)
          existingLists.push({
            id: LIST_IDS.LOVE,
            name: t(loveList.name),
            musicId: foundMusic?.id || musicInfo.id,
          })
        }

        for (const list of userLists) {
          if (targetListIds.includes(list.id)) {
            // 在用户歌单中查找歌曲的 ID
            const listMusics = await getListMusics(list.id)
            const foundMusic = listMusics.find(m => m.id === musicInfo.id)
            existingLists.push({
              id: list.id,
              name: list.name,
              musicId: foundMusic?.id || musicInfo.id,
            })
          }
        }

        if (existingLists.length) {
          // 显示重复歌曲提示模态框
          duplicateExistingLists.value = existingLists
          pendingMusicInfo.value = musicInfo
          isShowDuplicateModal.value = true
          return
        }
      }

      // 没有重复，直接显示添加模态框
      selectedAddMusicInfo.value = musicInfo
      nextTick(() => {
        isShowListAdd.value = true
      })
    }
  }

  // 用户在重复提示模态框中点击"继续添加"
  const handleDuplicateConfirm = () => {
    if (pendingMusicInfo.value) {
      selectedAddMusicInfo.value = pendingMusicInfo.value
      pendingMusicInfo.value = null
      duplicateExistingLists.value = []
      nextTick(() => {
        isShowListAdd.value = true
      })
    }
  }

  // 用户在重复提示模态框中点击"取消"
  const handleDuplicateCancel = () => {
    pendingMusicInfo.value = null
    duplicateExistingLists.value = []
  }

  return {
    isShowListAdd,
    isShowListAddMultiple,
    selectedAddMusicInfo,
    handleShowMusicAddModal,
    // 重复歌曲模态框相关
    isShowDuplicateModal,
    duplicateExistingLists,
    pendingMusicInfo,
    handleDuplicateConfirm,
    handleDuplicateCancel,
  }
}
