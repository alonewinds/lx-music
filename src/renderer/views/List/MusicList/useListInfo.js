import { ref, watch, computed, onBeforeUnmount } from '@common/utils/vueTools'
import { playMusicInfo, playInfo } from '@renderer/store/player/state'
import { getListMusics } from '@renderer/store/list/action'
import { appSetting } from '@renderer/store/setting'


export default ({ props, onLoadedList }) => {
  const rightClickSelectedIndex = ref(-1)
  const selectedIndex = ref(-1)
  const dom_listContent = ref(null)
  const listRef = ref(null)

  const excludeListIds = computed(() => ([props.listId]))


  const list = ref([])
  watch(() => props.listId, id => {
    getListMusics(id).then(l => {
      list.value = [...l]
      if (id != props.listId) return
      onLoadedList()
    })
  }, {
    immediate: true,
  })

  const playerInfo = computed(() => ({
    isPlayList: playMusicInfo.listId == props.listId,
    playIndex: playInfo.playIndex,
  }))

  const setSelectedIndex = index => {
    selectedIndex.value = index
  }

  const isShowSource = computed(() => appSetting['list.isShowSource'])

  const handleMyListUpdate = (ids) => {
    if (!ids.includes(props.listId)) return
    getListMusics(props.listId).then(l => {
      list.value = [...l]
    })
  }

  // 监听 musicId 变化，用于高亮显示指定歌曲
  watch(() => props.musicId, (musicId) => {
    if (!musicId || !list.value.length) return

    // 查找歌曲在列表中的索引
    const index = list.value.findIndex(item => item.id === musicId)
    if (index !== -1) {
      // 设置选中索引以高亮显示
      selectedIndex.value = index

      // 通知父组件滚动到该位置
      onLoadedList(index)
    }
  }, {
    immediate: true,
  })

  // 监听列表变化，确保在列表加载完成后能重新检查 musicId
  watch(() => list.value.length, () => {
    if (!props.musicId || !list.value.length) return

    // 查找歌曲在列表中的索引
    const index = list.value.findIndex(item => item.id === props.musicId)
    if (index !== -1) {
      // 设置选中索引以高亮显示
      selectedIndex.value = index

      // 通知父组件滚动到该位置
      onLoadedList(index)
    }
  })

  window.app_event.on('myListUpdate', handleMyListUpdate)

  onBeforeUnmount(() => {
    window.app_event.off('myListUpdate', handleMyListUpdate)
  })

  return {
    rightClickSelectedIndex,
    selectedIndex,
    dom_listContent,
    listRef,
    list,
    playerInfo,
    setSelectedIndex,
    isShowSource,
    excludeListIds,
  }
}
