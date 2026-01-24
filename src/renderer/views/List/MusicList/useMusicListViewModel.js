import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import { appSetting } from '@renderer/store/setting'
import { loveList, userLists } from '@renderer/store/list/state'
import { getListMusics, updateListMusicsPosition } from '@renderer/store/list/action'
import { LIST_IDS } from '@common/constants'
import { ref } from '@common/utils/vueTools'

import useListInfo from './useListInfo'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useSort from './useSort'
import useMusicActions from './useMusicActions'
import useSearch from './useSearch'
import useListScroll from './useListScroll'
import useMusicToggle from './useMusicToggle'
import useMusicListDrag from './useMusicListDrag'

export default function useMusicListViewModel(props, emit) {
  // ========== 设置 ==========
  const actionButtonsVisible = appSetting['list.actionButtonsVisible']

  // ========== 滚动恢复状态 (使用 ref 避免闭包问题) ==========
  const scrollState = ref({
    index: null,
    isAnimation: false,
  })

  // 延迟初始化的 scroll 引用
  let scrollRef = null

  const handleRestoreScroll = (_scrollIndex, _isAnimation) => {
    scrollState.value.index = _scrollIndex
    scrollState.value.isAnimation = _isAnimation
    if (_isAnimation && scrollRef) {
      void scrollRef.restoreScroll(_scrollIndex, _isAnimation)
    }
  }

  const onLoadedList = (index) => {
    if (scrollRef) {
      void scrollRef.restoreScroll(index ?? scrollState.value.index, scrollState.value.isAnimation)
    }
  }

  // ========== 核心列表信息 ==========
  const listInfo = useListInfo({ props, onLoadedList })

  // ========== 选择逻辑 ==========
  const selection = useList({ listRef: listInfo.listRef, list: listInfo.list })

  // ========== 播放逻辑 ==========
  const playback = usePlay({
    props,
    selectedList: selection.selectedList,
    list: listInfo.list,
    removeAllSelect: selection.removeAllSelect,
  })

  // ========== 添加到歌单 ==========
  const musicAdd = useMusicAdd({ selectedList: selection.selectedList, list: listInfo.list })

  // ========== 下载 ==========
  const download = useMusicDownload({ selectedList: selection.selectedList, list: listInfo.list })

  // ========== 排序 ==========
  const sort = useSort({
    props,
    list: listInfo.list,
    selectedList: selection.selectedList,
    removeAllSelect: selection.removeAllSelect,
  })

  // ========== 切换音源 ==========
  const toggle = useMusicToggle(props, listInfo.list)

  // ========== 音乐操作 ==========
  const actions = useMusicActions({
    props,
    list: listInfo.list,
    removeAllSelect: selection.removeAllSelect,
    selectedList: selection.selectedList,
  })

  // ========== 右键菜单 ==========
  const menu = useMenu({
    assertApiSupport,
    emit,
    handleShowDownloadModal: download.handleShowDownloadModal,
    handlePlayMusic: playback.handlePlayMusic,
    handlePlayMusicLater: playback.handlePlayMusicLater,
    handleShowMusicToggleModal: toggle.handleShowMusicToggleModal,
    handleSearch: actions.handleSearch,
    handleShowMusicAddModal: musicAdd.handleShowMusicAddModal,
    handleShowMusicMoveModal: musicAdd.handleShowMusicMoveModal,
    handleShowSortModal: sort.handleShowSortModal,
    handleOpenMusicDetail: actions.handleOpenMusicDetail,
    handleCopyName: actions.handleCopyName,
    handleDislikeMusic: actions.handleDislikeMusic,
    handleRemoveMusic: actions.handleRemoveMusic,
    handleEditRemark: actions.handleEditRemark,
  })

  // ========== 搜索 ==========
  const search = useSearch({
    setSelectedIndex: listInfo.setSelectedIndex,
    handlePlayMusic: playback.handlePlayMusic,
    listRef: listInfo.listRef,
    handleShowDownloadModal: download.handleShowDownloadModal,
  })

  // ========== 滚动 (在所有依赖项之后初始化) ==========
  const scroll = useListScroll({
    props,
    listRef: listInfo.listRef,
    list: listInfo.list,
    handleRestoreScroll,
    dom_listContent: listInfo.dom_listContent,
  })
  // 设置延迟引用
  scrollRef = scroll

  // ========== 拖拽排序 ==========
  const drag = useMusicListDrag({
    listRef: listInfo.listRef,
    list: listInfo.list,
    onUpdate(fromIndex, toIndex) {
      const item = listInfo.list.value[fromIndex]
      if (!item) return
      updateListMusicsPosition({
        listId: props.listId,
        position: toIndex,
        ids: [item.id],
      })
    },
  })

  // ========== 加载所有歌单 ==========
  const loadAllLists = async () => {
    const lists = []
    if (loveList.id !== LIST_IDS.TEMP) {
      lists.push({
        id: loveList.id,
        name: window.i18n.t(loveList.name),
        musicList: await getListMusics(loveList.id),
      })
    }
    for (const list of userLists) {
      if (list.id === LIST_IDS.TEMP) continue
      lists.push({
        id: list.id,
        name: list.name,
        musicList: await getListMusics(list.id),
      })
    }
    return lists
  }

  // ========== 事件处理器 ==========
  const handleListItemClick = (event, index) => {
    if (listInfo.rightClickSelectedIndex.value > -1) return
    listInfo.setSelectedIndex(-1)
    selection.handleSelectData(index)
    playback.doubleClickPlay(index)
  }

  const handleListItemRightClick = (event, index) => {
    listInfo.rightClickSelectedIndex.value = index
    menu.showMenu(event, listInfo.list.value[index], index)
  }

  const handleMenuClick = (action) => {
    let index = listInfo.rightClickSelectedIndex.value
    listInfo.rightClickSelectedIndex.value = -1
    menu.menuClick(action, index)
  }

  const handleListRightClick = (event) => {
    if (!event.target.classList.contains('select')) return
    event.stopImmediatePropagation()
    let classList = listInfo.dom_listContent.value.classList
    classList.add('copying')
    window.requestAnimationFrame(() => {
      let str = window.getSelection().toString()
      classList.remove('copying')
      str = str.split(/\n\n/).map(s => s.replace(/\n/g, '  ')).join('\n').trim()
      if (!str.length) return
      clipboardWriteText(str)
    })
  }

  const handleListBtnClick = ({ action, index }) => {
    switch (action) {
      case 'download':
        download.handleShowDownloadModal(index, true)
        break
      case 'play':
        playback.handlePlayMusic(index, true)
        break
      case 'search':
        actions.handleSearch(index)
        break
      case 'listAdd':
        musicAdd.handleShowMusicAddModal(index, true)
        break
    }
  }

  const scrollToTop = () => {
    listInfo.listRef.value.scrollTo(0, true)
  }

  const formatSinger = (singer) => {
    if (!singer) return []
    return singer.split(/([,、/&;，])/).map(part => ({
      text: part,
      isLink: !/[,、/&;，]/.test(part) && part.trim().length > 0,
    }))
  }

  // ========== 返回扁平化接口 ==========
  return {
    // 设置
    actionButtonsVisible,

    // 列表核心
    list: listInfo.list,
    listRef: listInfo.listRef,
    dom_listContent: listInfo.dom_listContent,
    listItemHeight: selection.listItemHeight,
    playerInfo: listInfo.playerInfo,
    isShowSource: listInfo.isShowSource,
    excludeListIds: listInfo.excludeListIds,

    // 选择
    selectedList: selection.selectedList,
    selectedIndex: listInfo.selectedIndex,
    rightClickSelectedIndex: listInfo.rightClickSelectedIndex,
    removeAllSelect: selection.removeAllSelect,

    // 菜单
    menus: menu.menus,
    menuLocation: menu.menuLocation,
    isShowItemMenu: menu.isShowItemMenu,

    // 模态框状态
    isShowListAdd: musicAdd.isShowListAdd,
    isMove: musicAdd.isMove,
    isShowListAddMultiple: musicAdd.isShowListAddMultiple,
    isMoveMultiple: musicAdd.isMoveMultiple,
    selectedAddMusicInfo: musicAdd.selectedAddMusicInfo,

    isShowDownload: download.isShowDownload,
    isShowDownloadMultiple: download.isShowDownloadMultiple,
    selectedDownloadMusicInfo: download.selectedDownloadMusicInfo,

    isShowMusicSortModal: sort.isShowMusicSortModal,
    selectedNum: sort.selectedNum,
    selectedSortMusicInfo: sort.selectedSortMusicInfo,
    sortMusic: sort.sortMusic,

    isShowMusicToggleModal: toggle.isShowMusicToggleModal,
    selectedToggleMusicInfo: toggle.selectedToggleMusicInfo,
    toggleSource: toggle.toggleSource,

    isShowSearchBar: search.isShowSearchBar,
    searchList: search.searchList,

    // 事件处理器
    handleListItemClick,
    handleListItemRightClick,
    handleMenuClick,
    handleListRightClick,
    handleListBtnClick,
    handleMusicSearchAction: search.handleMusicSearchAction,
    handleSearchSinger: actions.handleSearchSinger,
    handleRestoreScroll,
    saveListPosition: scroll.saveListPosition,
    scrollToTop,
    startDrag: drag.startDrag,
    loadAllLists,
    formatSinger,

    // 工具
    assertApiSupport,
  }
}
