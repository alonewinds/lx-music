<template>
  <material-modal :show="visible" bg-close teleport="#view" width="70%" max-width="1000px" @close="$emit('update:visible', false)">
    <div :class="$style.header">
      <h2>全歌单重复歌曲检索</h2>
      <p v-if="duplicateList.length">共找到 {{ duplicateList.length }} 首重复歌曲</p>
    </div>
    <base-virtualized-list
      v-if="duplicateList.length" v-slot="{ item, index }" :list="duplicateList" key-name="id" :class="$style.list" style="contain: none;"
      :item-height="listItemHeight" container-class="scroll" content-class="list"
    >
      <div :class="$style.listItem">
        <div :class="$style.num">{{ index + 1 }}</div>
        <div :class="$style.textContent">
          <h3 :class="$style.text" :aria-label="`${item.musicInfo.name} - ${item.musicInfo.singer}`">{{ item.musicInfo.name }} - {{ item.musicInfo.singer }}</h3>
          <div :class="$style.locations">
            <span 
              v-for="loc in item.locations" 
              :key="`${loc.listId}-${loc.index}`" 
              :class="$style.locationTag"
            >
              <span 
                :class="$style.locationName"
                :title="`点击跳转到 ${loc.listName}`"
                @click="handleGotoList(loc, item.musicInfo)"
              >
                {{ loc.listName }}
              </span>
              <span 
                :class="$style.deleteIcon"
                :title="`从 ${loc.listName} 删除`"
                @click.stop="handleDeleteFromList(loc, item, index)"
              >
                ×
              </span>
            </span>
          </div>
        </div>
        <div :class="$style.label">{{ item.musicInfo.source }}</div>
        <div :class="$style.label">{{ item.musicInfo.interval }}</div>
        <div :class="$style.btns">
          <button type="button" :class="$style.btn" :title="$t('list__play')" @click="handlePlay(item)">
            <svg v-once version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 287.386 287.386" space="preserve">
              <use xlink:href="#icon-testPlay" />
            </svg>
          </button>
          <button 
            v-if="item.locations.length > 1"
            type="button" 
            :class="$style.btn" 
            :title="'从所有歌单删除'"
            @click="handleDeleteFromAll(item, index)"
          >
            <svg v-once version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 212.982 212.982" space="preserve">
              <use xlink:href="#icon-delete" />
            </svg>
          </button>
        </div>
      </div>
    </base-virtualized-list>
    <div v-else :class="$style.noItem">
      <p v-text="$t('no_item')" />
    </div>
  </material-modal>
</template>

<script>
import { ref, computed, watch, markRawList, nextTick } from '@common/utils/vueTools'
import { playList } from '@renderer/core/player'
import { removeListMusics, getListMusics } from '@renderer/store/list/action'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { getFontSizeWithScreen } from '@renderer/utils'
import { useI18n } from '@root/lang'
import { dialog } from '@renderer/plugins/Dialog'

export default {
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:visible', 'goto-list'],
  setup(props, { emit }) {
    const t = useI18n()
    const duplicateList = ref([])
    const listItemHeight = computed(() => {
      return Math.ceil((isFullscreen.value ? getFontSizeWithScreen() : appSetting['common.fontSize']) * 4.5)
    })

    const handleFilterList = async() => {
      try {
        // 收集所有歌单数据
        const listsData = []

        // 我的收藏
        const loveMusicList = await getListMusics(loveList.id)
        if (loveMusicList.length > 0) {
          listsData.push({
            listId: loveList.id,
            listName: t(loveList.name),
            musicList: loveMusicList,
          })
        }

        // 用户歌单
        for (const list of userLists) {
          const musicList = await getListMusics(list.id)
          if (musicList.length > 0) {
            listsData.push({
              listId: list.id,
              listName: list.name,
              musicList,
            })
          }
        }

        // 调用检测函数
        duplicateList.value = markRawList(await window.lx.worker.main.filterCrossListDuplicateMusic(listsData))
      } catch (error) {
        console.error('检测跨歌单重复歌曲失败:', error)
        duplicateList.value = []
      }
    }

    // 监听 visible 变化，在打开时加载数据
    watch(() => props.visible, (visible) => {
      if (visible) {
        if (duplicateList.value.length) duplicateList.value = []
        void handleFilterList()
      }
    })

    const handlePlay = (item) => {
      // 播放第一个位置的歌曲
      const firstLocation = item.locations[0]
      playList(firstLocation.listId, firstLocation.index)
    }

    const handleGotoList = (location, musicInfo) => {
      // 关闭模态框
      emit('update:visible', false)
      
      // 使用 setTimeout 确保模态框完全关闭后再触发跳转
      setTimeout(() => {
        emit('goto-list', { listId: location.listId, musicId: musicInfo.id })
      }, 100)
    }


    // 从单个歌单删除
    const handleDeleteFromList = async(loc, item, itemIndex) => {
      try {
        // 乐观更新 UI - 创建新的 locations 数组
        const newLocations = item.locations.filter(l => l.listId !== loc.listId)
        
        // 如果剩余位置≤1,说明不再是重复歌曲,从列表中移除整个项目
        if (newLocations.length <= 1) {
          // 创建新的列表数组,移除当前项目
          duplicateList.value = duplicateList.value.filter((_, idx) => idx !== itemIndex)
        } else {
          // 更新当前项目的 locations
          // 创建新的列表数组,更新当前项目
          duplicateList.value = duplicateList.value.map((listItem, idx) => {
            if (idx === itemIndex) {
              return {
                ...listItem,
                locations: newLocations,
              }
            }
            return listItem
          })
        }
        
        // 后台删除 - 使用 nextTick 确保 UI 更新完成后再执行
        await nextTick()
        await removeListMusics({ listId: loc.listId, ids: [item.musicInfo.id] })
      } catch (error) {
        console.error('删除失败:', error)
        // 如果失败,刷新列表恢复正确状态
        await handleFilterList()
      }
    }


    // 从所有歌单删除
    const handleDeleteFromAll = async(item, itemIndex) => {
      const confirmed = await dialog.confirm({
        message: `确定要从所有歌单中删除 "${item.musicInfo.name}" 吗？`,
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      })
      
      if (!confirmed) return
      
      try {
        // 乐观更新 - 创建新的列表数组,移除当前项目
        duplicateList.value = duplicateList.value.filter((_, idx) => idx !== itemIndex)
        
        // 后台删除所有位置 - 使用 nextTick 确保 UI 更新完成后再执行
        await nextTick()
        for (const loc of item.locations) {
          await removeListMusics({ listId: loc.listId, ids: [item.musicInfo.id] })
        }
      } catch (error) {
        console.error('删除失败:', error)
        // 如果失败,刷新列表恢复正确状态
        await handleFilterList()
      }
    }


    return {
      listItemHeight,
      duplicateList,
      handlePlay,
      handleGotoList,
      handleDeleteFromList,
      handleDeleteFromAll,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.header {
  flex: none;
  padding: 15px;
  text-align: center;
  h2 {
    word-break: break-all;
    margin-bottom: 8px;
  }
  p {
    font-size: 13px;
    color: var(--color-font-label);
  }
}

.list {
  min-height: 175px;
  min-width: 380px;
  font-size: 13px;
  transition-property: height;
  .listItem {
    position: relative;
    padding: 0 5px;
    transition: background-color .2s ease;
    line-height: 1.4;
    height: 100%;
    display: flex;
    flex-flow: row nowrap;
    align-items: center;

    &:hover {
      background-color: var(--color-primary-background-hover);
    }
  }
}

.num {
  flex: none;
  font-size: 12px;
  width: 30px;
  text-align: center;
  color: var(--color-font-label);
}

.textContent {
  flex: auto;
  padding-left: 5px;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  align-items: flex-start;
  overflow: hidden;
}

.text {
  max-width: 100%;
  .mixin-ellipsis-1();
  margin-bottom: 4px;
}

.locations {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 100%;
}

.locationTag {
  font-size: 11px;
  padding: 2px 8px;
  background-color: var(--color-primary-background-hover);
  border-radius: 10px;
  color: var(--color-font-label);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--color-primary-font-active);
  }
}

.locationName {
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
}

.deleteIcon {
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;
  padding: 0 2px;
  opacity: 0;
  transition: all 0.2s ease;
  color: #ff4444;
  
  &:hover {
    opacity: 1 !important;
    transform: scale(1.3);
    color: #ff0000;
  }
}

.locationTag:hover .deleteIcon {
  opacity: 0.6;
}

.label {
  flex: none;
  font-size: 12px;
  opacity: 0.5;
  padding: 0 5px;
  display: flex;
  align-items: center;
}

.btns {
  flex: none;
  font-size: 12px;
  padding: 0 5px;
  display: flex;
  align-items: center;
}

.btn {
  background-color: transparent;
  border: none;
  border-radius: @form-radius;
  margin-right: 5px;
  cursor: pointer;
  padding: 4px 7px;
  color: var(--color-button-font);
  outline: none;
  transition: background-color 0.2s ease;
  line-height: 0;
  &:last-child {
    margin-right: 0;
  }

  svg {
    height: 16px;
  }

  &:hover {
    background-color: var(--color-primary-background-hover);
  }
  &:active {
    background-color: var(--color-primary-font-active);
  }
}

.noItem {
  position: relative;
  height: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 16px;
    color: var(--color-font-label);
  }
}

</style>
