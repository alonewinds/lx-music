// import { useCommit } from '@common/utils/vueTools'
import { defaultList } from '@renderer/store/list/state'
import { getListMusics, addListMusics } from '@renderer/store/list/action'
import { addTempPlayList } from '@renderer/store/player/action'
import { playInfo, playMusicInfo as currentPlayMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'
import { type Ref } from '@common/utils/vueTools'
import { playList, playMusic } from '@renderer/core/player'
import { LIST_IDS } from '@common/constants'

export default ({ selectedList, props, removeAllSelect, emit }: {
  selectedList: Ref<LX.Music.MusicInfoOnline[]>
  props: {
    list: LX.Music.MusicInfoOnline[]
  }
  removeAllSelect: () => void
  emit: (event: 'show-menu' | 'play-list' | 'togglePage', ...args: any[]) => void
}) => {
  let clickTime = 0
  let clickIndex = -1

  const handlePlayMusic = async (index: number, single: boolean) => {
    const targetSong = props.list[index]
    const songsToPlay = selectedList.value.length && !single ? [...selectedList.value] : [targetSong]

    // 检查是否有非 DEFAULT 列表正在播放
    const currentListId = playInfo.playerListId
    const hasActivePlaylist = currentListId &&
      currentListId !== LIST_IDS.DEFAULT &&
      currentPlayMusicInfo.musicInfo !== null

    if (hasActivePlaylist) {
      // 当前有播放列表在播放，使用临时播放
      // 第一首歌直接播放，剩余歌曲添加到稍后播放队列
      const [firstSong, ...restSongs] = songsToPlay

      // 如果有多首歌，剩余的添加到稍后播放列表
      if (restSongs.length > 0) {
        addTempPlayList(restSongs.map(s => ({
          listId: LIST_IDS.PLAY_LATER,
          musicInfo: s,
          isTop: true
        })))
      }

      // 直接播放第一首歌作为临时播放
      // 使用 playMusic 确保正确的播放状态切换
      playMusic(firstSong, LIST_IDS.PLAY_LATER, true)

      if (selectedList.value.length && !single) {
        removeAllSelect()
      }
    } else {
      // 没有播放列表或正在播放 DEFAULT 列表，使用原来的逻辑
      const defaultListMusics = await getListMusics(defaultList.id)
      await addListMusics(defaultList.id, songsToPlay)

      if (selectedList.value.length && !single) {
        removeAllSelect()
      }

      const targetIndex = defaultListMusics.findIndex(s => s.id === targetSong.id)
      if (targetIndex > -1) {
        playList(defaultList.id, targetIndex)
      }
    }
  }

  const handlePlayMusicLater = (index: number, single: boolean) => {
    if (selectedList.value.length && !single) {
      addTempPlayList(selectedList.value.map(s => ({ listId: LIST_IDS.PLAY_LATER, musicInfo: s })))
      removeAllSelect()
    } else {
      addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo: props.list[index] }])
    }
  }

  const doubleClickPlay = (index: number) => {
    if (
      window.performance.now() - clickTime > 400 ||
      clickIndex !== index
    ) {
      clickTime = window.performance.now()
      clickIndex = index
      return
    }
    if (appSetting['list.isClickPlayList']) {
      emit('play-list', index)
    } else {
      void handlePlayMusic(index, true)
    }
    clickTime = 0
    clickIndex = -1
  }

  return {
    handlePlayMusic,
    handlePlayMusicLater,
    doubleClickPlay,
  }
}

