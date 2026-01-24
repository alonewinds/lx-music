<template lang="pug">
material-modal(
  :show="isShowPlayQueue"
  :bg-close="true"
  @close="handleClose"
)
  main(:class="$style.main")
    DynamicBackground(:class="$style.bg")
    div(:class="$style.mask")
    h2(:class="$style.title") {{ $t('play_queue__title') }}
    
    div(v-if="!hasContent" :class="$style.empty")
      span {{ $t('play_queue__empty') }}
    
    div(v-else :class="$style.content")
      //- 正在播放
      div(v-if="currentMusic" :class="$style.section")
        div(:class="$style.sectionHeader")
          span(:class="$style.sectionTitle") {{ $t('play_queue__now_playing') }}
        div(:class="[$style.musicItem, $style.currentItem]")
          div(:class="$style.musicInfo")
            span(:class="$style.musicName") {{ currentMusic.name }}
            span(v-if="currentMusic.alias" :class="$style.musicAlias") {{ currentMusic.alias }}
            span(:class="$style.musicSinger") {{ currentMusic.singer }}
          div(:class="$style.playingIndicator")
            svg(version="1.1" xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 0 24 24")
              use(xlink:href="#icon-play-outline")

      //- 稍后播放列表
      div(v-if="tempPlayList.length" :class="$style.section")
        div(:class="$style.sectionHeader")
          span(:class="$style.sectionTitle") {{ $t('play_queue__play_later') }} ({{ tempPlayList.length }})
          button(:class="$style.clearBtn" @click="handleClearTempList") {{ $t('play_queue__clear') }}
        div(:class="$style.musicList")
          div(
            v-for="(item, index) in tempPlayList"
            :key="`temp-${item.musicInfo.id}-${index}`"
            :class="$style.musicItem"
            @click="handlePlayTempItem(index)"
          )
            div(:class="$style.musicInfo")
              span(:class="$style.musicName") {{ item.musicInfo.name }}
              span(v-if="item.musicInfo.meta && item.musicInfo.meta.alias" :class="$style.musicAlias") {{ item.musicInfo.meta.alias }}
              span(:class="$style.musicSinger") {{ item.musicInfo.singer }}
            button(:class="$style.removeBtn" @click.stop="handleRemoveTempItem(index)")
              svg(version="1.1" xmlns="http://www.w3.org/2000/svg" height="12" viewBox="0 0 24 24")
                use(xlink:href="#icon-delete")

      //- 当前歌单剩余歌曲
      div(v-if="remainingList.length" :class="$style.section")
        div(:class="$style.sectionHeader")
          span(:class="$style.sectionTitle") {{ $t('play_queue__remaining') }} ({{ remainingList.length }})
        div(:class="$style.musicList")
          div(
            v-for="(item, index) in remainingList"
            :key="`remaining-${item.id}-${index}`"
            :class="$style.musicItem"
            @click="handlePlayRemainingItem(index)"
          )
            div(:class="$style.musicInfo")
              span(:class="$style.musicName") {{ item.name }}
              span(v-if="item.alias" :class="$style.musicAlias") {{ item.alias }}
              span(:class="$style.musicSinger") {{ item.singer }}
</template>

<script>
import { computed } from '@common/utils/vueTools'
import {
  isShowPlayQueue,
  playMusicInfo,
  playInfo,
  tempPlayList,
} from '@renderer/store/player/state'
import {
  setShowPlayQueue,
  getList,
  removeTempPlayList,
  clearTempPlayeList,
  setPlayMusicInfo,
} from '@renderer/store/player/action'
import DynamicBackground from '../PlayDetail/components/DynamicBackground.vue'

export default {
  name: 'PlayQueueModal',
  setup() {
    // 当前正在播放的歌曲
    const currentMusic = computed(() => {
      if (!playMusicInfo.musicInfo) return null
      const mInfo = 'progress' in playMusicInfo.musicInfo 
        ? playMusicInfo.musicInfo.metadata.musicInfo 
        : playMusicInfo.musicInfo
      return {
        id: mInfo.id,
        name: mInfo.name,
        singer: mInfo.singer,
        alias: mInfo.meta?.alias,
      }
    })

    // 当前歌单的剩余歌曲（当前歌曲之后的歌曲）
    const remainingList = computed(() => {
      if (!playInfo.playerListId || playInfo.playerPlayIndex < 0) return []
      const list = getList(playInfo.playerListId)
      if (!list.length) return []
      
      // 获取当前位置之后的歌曲
      const startIndex = playInfo.playerPlayIndex + 1
      if (startIndex >= list.length) return []
      
      return list.slice(startIndex).map(item => {
        const mInfo = 'progress' in item ? item.metadata.musicInfo : item
        return {
          id: mInfo.id,
          name: mInfo.name,
          singer: mInfo.singer,
          alias: mInfo.meta?.alias,
        }
      })
    })

    // 是否有内容显示
    const hasContent = computed(() => {
      return currentMusic.value || tempPlayList.length > 0 || remainingList.value.length > 0
    })

    const handleClose = () => {
      setShowPlayQueue(false)
    }

    const handleClearTempList = () => {
      clearTempPlayeList()
    }

    const handleRemoveTempItem = (index) => {
      removeTempPlayList(index)
    }

    const handlePlayTempItem = async(index) => {
      const item = tempPlayList[index]
      if (!item) return
      removeTempPlayList(index)
      setPlayMusicInfo(item.listId, item.musicInfo, true)
      // 使用动态导入避免循环引用
      const { setMusicUrl } = await import('@renderer/core/player')
      setMusicUrl(item.musicInfo)
    }

    const handlePlayRemainingItem = async(index) => {
      if (!playInfo.playerListId) return
      const actualIndex = playInfo.playerPlayIndex + 1 + index
      const { playList: playListFn } = await import('@renderer/core/player')
      playListFn(playInfo.playerListId, actualIndex)
    }

    return {
      isShowPlayQueue,
      currentMusic,
      tempPlayList,
      remainingList,
      hasContent,
      handleClose,
      handleClearTempList,
      handleRemoveTempItem,
      handlePlayTempItem,
      handlePlayRemainingItem,
    }
  },
  components: {
    DynamicBackground,
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

:global {
  .play-queue-modal {
    // 覆盖 material-modal 的默认背景
    background-color: transparent !important;
    // backdrop-filter: blur(12px); // 动态背景组件自带模糊或不需要额外叠加
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
    border: 1px solid rgba(255, 255, 255, 0.1);

    // 针对暗色主题的适配
    [data-theme='dark'] & {
      background-color: transparent !important;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
  }
}

.bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  border-radius: inherit; /* 继承父级圆角，如果有的话 */
  opacity: 1;
}

.mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  background-color: var(--color-content-background);
  opacity: 0.5;
  border-radius: inherit;
}

.main {
  position: relative; /* 确保 bg 绝对定位相对于 main */
  display: flex;
  flex-direction: column;
  width: 420px;
  height: 520px;
  max-width: 90vw;  /* 响应式适配 */
  max-height: 80vh;
  overflow: hidden;
  color: var(--color-font);
}

.title {
  margin: 0;
  padding: 16px 24px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-font);
  border-bottom: 1px solid var(--color-primary-alpha-100);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  
  &::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 18px;
    background-color: var(--color-primary);
    margin-right: 12px;
    border-radius: 2px;
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--color-font-label);
  font-size: 14px;
  opacity: 0.8;
  
  svg {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
    opacity: 0.5;
    fill: currentColor;
  }
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
  
  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--color-primary-alpha-200);
    border-radius: 3px;
    
    &:hover {
      background-color: var(--color-primary-alpha-400);
    }
  }
}

.section {
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px 8px;
  margin-bottom: 4px;
}

.sectionTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-font-label);
  opacity: 0.8;
  letter-spacing: 0.5px;
}

.clearBtn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--color-font-label);
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 12px;
  transition: all 0.2s;
  background-color: var(--color-primary-alpha-100);
  
  &:hover {
    color: var(--color-primary);
    background-color: var(--color-primary-alpha-200);
  }
}

.musicList {
  display: flex;
  flex-direction: column;
}

.musicItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
  
  &:hover {
    background-color: var(--color-primary-alpha-100);
    
    .removeBtn {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.currentItem {
  // 移除背景色，避免在某些主题下对比度过低看不清文字
  // background-color: var(--color-primary-alpha-100);
  background-color: transparent;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 70%;
    background-color: var(--color-primary);
    border-radius: 0 4px 4px 0;
    box-shadow: 2px 0 8px var(--color-primary-alpha-400);
  }
  
  .musicName {
    color: var(--color-primary);
    font-weight: 700;
    font-size: 15px; // 稍微加大字体
    text-shadow: 0 0 1px var(--color-primary-alpha-200);
  }
  
  .musicSinger {
    color: var(--color-primary); // 歌手也使用主题色，但透明度稍低
    opacity: 0.8;
    font-weight: 500;
  }
}

.musicInfo {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.musicName {
  font-size: 14px;
  color: var(--color-font);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.musicSinger {
  font-size: 12px;
  color: var(--color-font-label);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}

.musicAlias {
  font-size: 11px;
  color: var(--color-primary-alpha-200);
  margin-top: 1px;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playingIndicator {
  flex-shrink: 0;
  color: var(--color-primary);
  margin-left: 16px;
  display: flex;
  align-items: center;
  
  svg {
    fill: currentColor;
    filter: drop-shadow(0 2px 4px var(--color-primary-alpha-300));
  }
}

.removeBtn {
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--color-font-label);
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: var(--color-error, #ff4d4f); // 使用错误色或红色
    background-color: rgba(255, 77, 79, 0.1);
  }
  
  svg {
    fill: currentColor;
    display: block;
  }
}
</style>
