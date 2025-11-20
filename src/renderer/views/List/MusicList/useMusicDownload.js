import { ref, nextTick } from '@common/utils/vueTools'

export default ({ selectedList, list }) => {
  const isShowDownload = ref(false)
  const isShowDownloadMultiple = ref(false)
  const musicInfo = ref(null)

  const handleShowDownloadModal = (index, single, directMusicInfo) => {
    if (selectedList.value.length && !single) {
      isShowDownloadMultiple.value = true
    } else {
      // 如果直接传入了 musicInfo,使用它;否则从 list 中获取
      musicInfo.value = directMusicInfo || list.value[index]
      nextTick(() => {
        isShowDownload.value = true
      })
    }
  }

  return {
    isShowDownload,
    isShowDownloadMultiple,
    selectedDownloadMusicInfo: musicInfo,
    handleShowDownloadModal,
  }
}
