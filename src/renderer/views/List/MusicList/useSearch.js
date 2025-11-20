import { ref, onBeforeUnmount } from '@common/utils/vueTools'

// 深度清理对象,移除所有响应式属性
const deepToRaw = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj

  const { toRaw } = require('@common/utils/vueTools')
  const raw = toRaw(obj)

  if (Array.isArray(raw)) {
    return raw.map(item => deepToRaw(item))
  }

  const result = {}
  for (const key in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      result[key] = deepToRaw(raw[key])
    }
  }
  return result
}

export default ({ setSelectedIndex, handlePlayMusic, listRef, handleShowDownloadModal }) => {
  const isShowSearchBar = ref(false)
  const searchList = ref([])

  // 在这里初始化 router,这样在所有函数中都可以使用
  const { useRouter } = require('@common/utils/vueRouter')
  const router = useRouter()

  const handleShowSearchBar = () => {
    isShowSearchBar.value = true
  }

  const handleMusicSearchAction = ({ action, data }) => {
    isShowSearchBar.value = false
    switch (action) {
      case 'listClick':
        if (data.index < 0) return
        listRef.value.scrollToIndex(data.index, -150, true, () => {
          setSelectedIndex(data.index)
          setTimeout(() => {
            setSelectedIndex(-1)
            if (data.isPlay) handlePlayMusic(data.index)
          }, 600)
        })
        break
      case 'action':
        // 处理按钮操作(播放、下载)
        handleSearchAction(data)
        break
      case 'menuAction':
        // 处理右键菜单操作
        handleSearchMenuAction(data)
        break
    }
  }

  const handleSearchAction = ({ action, item }) => {
    switch (action) {
      case 'play':
        // 在全局搜索模式下,item 包含 listId
        if (item.listId) {
          // 全局搜索结果:直接播放该歌曲
          const { playList } = require('@renderer/core/player')
          // 需要先找到歌曲在目标歌单中的索引
          const { getListMusics } = require('@renderer/store/list/action')
          void getListMusics(item.listId).then(list => {
            const index = list.findIndex(m => m.id === item.id)
            if (index >= 0) {
              playList(item.listId, index)
            }
          })
        } else {
          // 当前歌单搜索结果:使用索引播放
          const index = listRef.value.$props.list.findIndex(m => m.id === item.id)
          if (index >= 0) {
            handlePlayMusic(index, true)
          }
        }
        break
      case 'download':
        // 使用 deepToRaw 深度清理对象,确保可以被序列化
        handleShowDownloadModal(-1, true, deepToRaw(item))
        break
    }
  }

  const handleSearchMenuAction = ({ action, item }) => {
    const { clipboardWriteText } = require('@common/utils/electron')
    const { addTempPlayList } = require('@renderer/store/player/action')
    const { addDislikeInfo } = require('@renderer/core/dislikeList')
    const { playMusicInfo } = require('@renderer/store/player/state')
    const { playNext, playList } = require('@renderer/core/player')
    const { hasDislike } = require('@renderer/core/dislikeList')
    const { openUrl } = require('@common/utils/electron')
    const { getListMusics } = require('@renderer/store/list/action')
    const { appSetting } = require('@renderer/store/setting')
    const musicSdk = require('@renderer/utils/musicSdk').default
    const { dialog } = require('@renderer/plugins/Dialog')

    switch (action) {
      case 'play':
        // 播放歌曲
        if (item.listId) {
          // 全局搜索结果:直接播放
          void getListMusics(item.listId).then(list => {
            const index = list.findIndex(m => m.id === item.id)
            if (index >= 0) {
              playList(item.listId, index)
            }
          })
        } else {
          // 当前歌单搜索结果
          const index = listRef.value.$props.list.findIndex(m => m.id === item.id)
          if (index >= 0) handlePlayMusic(index)
        }
        break
      case 'playLater':
        // 稍后播放 - 使用 deepToRaw 清理对象
        addTempPlayList([{ listId: item.listId || 'default', musicInfo: deepToRaw(item) }])
        break
      case 'download':
        // 下载 - 使用 deepToRaw 清理对象
        handleShowDownloadModal(-1, true, deepToRaw(item))
        break
      case 'search':
        // 搜索 - 跳转到搜索页面
        router.push({
          path: '/search',
          query: {
            text: `${item.name} ${item.singer}`,
          },
        })
        break
      case 'copyName':
        // 复制歌曲名
        const fileName = appSetting['download.fileName'].replace('歌名', item.name).replace('歌手', item.singer)
        clipboardWriteText(fileName)
        break
      case 'sourceDetail':
        // 打开音源详情页
        if (musicSdk[item.source]?.getMusicDetailPageUrl) {
          const url = musicSdk[item.source].getMusicDetailPageUrl(item)
          if (url) openUrl(url)
        }
        break
      case 'dislike':
        // 不喜欢
        void dialog.confirm({
          message: item.singer
            ? window.i18n.t('lists__dislike_music_singer_tip', { name: item.name, singer: item.singer })
            : window.i18n.t('lists__dislike_music_tip', { name: item.name }),
          cancelButtonText: window.i18n.t('cancel_button_text_2'),
          confirmButtonText: window.i18n.t('confirm_button_text'),
        }).then(confirm => {
          if (!confirm) return
          void addDislikeInfo([{ name: item.name, singer: item.singer }])
          if (hasDislike(playMusicInfo.musicInfo)) {
            playNext(true)
          }
        })
        break
    }
  }

  window.key_event.on('key_mod+f_down', handleShowSearchBar)

  onBeforeUnmount(() => {
    window.key_event.off('key_mod+f_down', handleShowSearchBar)
  })

  return {
    isShowSearchBar,
    searchList,
    handleMusicSearchAction,
  }
}
