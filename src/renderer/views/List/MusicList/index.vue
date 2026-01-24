<template>
  <div :class="$style.list">
    <div class="thead">
      <table>
        <thead>
          <tr v-if="actionButtonsVisible">
            <th class="num" style="width: 5%;">#</th>
            <th class="nobreak">{{ $t('music_name') }}</th>
            <th class="nobreak" style="width: 22%;">{{ $t('music_singer') }}</th>
            <th class="nobreak" style="width: 22%;">{{ $t('music_album') }}</th>
            <th class="nobreak" style="width: 9%;">{{ $t('music_time') }}</th>
            <th class="nobreak" style="width: 16%;">{{ $t('action') }}</th>
          </tr>
          <tr v-else>
            <th class="num" style="width: 5%;">#</th>
            <th class="nobreak">{{ $t('music_name') }}</th>
            <th class="nobreak" style="width: 25%;">{{ $t('music_singer') }}</th>
            <th class="nobreak" style="width: 28%;">{{ $t('music_album') }}</th>
            <th class="nobreak" style="width: 10%;">{{ $t('music_time') }}</th>
          </tr>
        </thead>
      </table>
    </div>
    <div v-show="list.length" ref="dom_listContent" :class="$style.content">
      <base-virtualized-list
        ref="listRef" v-slot="{ item, index }" :list="list" key-name="id"
        :item-height="listItemHeight" container-class="scroll" content-class="list"
        @scroll="saveListPosition" @contextmenu.capture="handleListRightClick"
      >
        <div
          class="list-item" :class="[{ [$style.active]: playerInfo.isPlayList && playerInfo.playIndex === index }, { selected: selectedIndex == index || rightClickSelectedIndex == index }, { active: selectedList.includes(item) }, { disabled: !assertApiSupport(item.source) }]"
          @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
          @mousedown="startDrag($event, index)"
        >
          <div class="list-item-cell no-select" :class="$style.num" style="flex: 0 0 5%;">
            <transition name="play-active">
              <div v-if="playerInfo.isPlayList && playerInfo.playIndex === index" :class="$style.playIcon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 512 512" space="preserve">
                  <use xlink:href="#icon-play-outline" />
                </svg>
              </div>
              <div v-else class="num">{{ index + 1 }}</div>
            </transition>
          </div>
          <div class="list-item-cell auto name" :aria-label="item.name">
            <div class="name-container">
              <span class="select name">{{ item.name }}</span>
              <span v-if="isShowSource" class="no-select label-source">{{ item.source }}</span>
            </div>
            <span v-if="item.meta.alias" class="no-select" :class="$style.alias">{{ item.meta.alias }}</span>
          </div>
          <div class="list-item-cell" :style="{ flex: actionButtonsVisible ? '0 0 22%' : '0 0 25%' }">
            <template v-for="(part, i) in formatSinger(item.singer)" :key="i">
              <span v-if="part.isLink" class="select" :class="$style.singer" :aria-label="part.text" @click.stop="handleSearchSinger(part.text)">{{ part.text }}</span>
              <span v-else class="select" :class="$style.singerSplit">{{ part.text }}</span>
            </template>
          </div>
          <div class="list-item-cell" :style="{ flex: actionButtonsVisible ? '0 0 22%' : '0 0 28%' }"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
          <div class="list-item-cell" :style="{ flex: actionButtonsVisible ? '0 0 9%' : '0 0 10%' }"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
          <div v-if="actionButtonsVisible" class="list-item-cell" style="flex: 0 0 16%; padding-left: 0; padding-right: 0;">
            <material-list-buttons :index="index" :download-btn="assertApiSupport(item.source) && item.source != 'local'" @btn-click="handleListBtnClick" />
          </div>
        </div>
      </base-virtualized-list>
    </div>
    <div v-show="!list.length" :class="$style.noItem">
      <p v-text="$t('no_item')" />
    </div>
    <common-list-add-modal
      v-model:show="isShowListAdd" :is-move="isMove" :from-list-id="listId"
      :music-info="selectedAddMusicInfo" :exclude-list-id="excludeListIds" teleport="#view"
    />
    <common-list-add-multiple-modal
      v-model:show="isShowListAddMultiple" :from-list-id="listId"
      :is-move="isMoveMultiple" :music-list="selectedList" :exclude-list-id="excludeListIds" teleport="#view" @confirm="removeAllSelect"
    />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" :list-id="listId" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" :list-id="listId" @confirm="removeAllSelect" />
    <search-list :list="list" :load-all-lists="loadAllLists" :visible="isShowSearchBar" @action="handleMusicSearchAction" />
    <music-sort-modal v-model:show="isShowMusicSortModal" :music-info="selectedSortMusicInfo" :selected-num="selectedNum" @confirm="sortMusic" />
    <music-toggle-modal v-model:show="isShowMusicToggleModal" :music-info="selectedToggleMusicInfo" @toggle="toggleSource" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </div>
</template>

<script>
import SearchList from './components/SearchList.vue'
import MusicSortModal from './components/MusicSortModal.vue'
import MusicToggleModal from './components/MusicToggleModal.vue'
import useMusicListViewModel from './useMusicListViewModel'

export default {
  name: 'MusicList',
  components: {
    SearchList,
    MusicSortModal,
    MusicToggleModal,
  },
  props: {
    listId: {
      type: String,
      required: true,
    },
    musicId: {
      type: String,
      default: null,
    },
  },
  emits: ['show-menu'],
  setup(props, { emit }) {
    return useMusicListViewModel(props, emit)
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  overflow: hidden;
  height: 100%;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;

  :global(.list-item) {
    &.active {
      color: var(--color-button-font);
    }
  }
  :global {
    .label-source {
      color: var(--color-primary);
      padding: 5px;
      font-size: .8em;
      line-height: 1.2;
      opacity: .75;
      display: inline-block;
    }
  }
}
.num {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.playIcon {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  color: var(--color-button-font);
  opacity: .7;
}
.content {
  min-height: 0;
  font-size: 14px;
  display: flex;
  flex-flow: column nowrap;
  flex: auto;
}

.noItem {
  position: relative;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 24px;
    color: var(--color-font-label);
  }
}

:global(.music-list-dragging) {
  opacity: 0.4;
  background-color: var(--color-primary-background-hover);
}

/* 拖拽时的占位符样式 (ghost) */
:global(.music-list-ghost) {
  opacity: 0.3;
  background-color: var(--color-primary-background-hover) !important;
}

/* 被选中的元素样式 (chosen) */
:global(.music-list-chosen) {
  background-color: var(--color-primary-background-hover) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 拖拽中的元素样式 (drag) */
:global(.music-list-drag) {
  opacity: 1 !important;
  background-color: var(--color-primary-background) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  cursor: grabbing !important;
  z-index: 9999 !important;
  
  .list-item {
    background: transparent !important;
  }
}

/* Fallback 模式下拖拽的元素样式 */
:global(.music-list-fallback) {
  opacity: 1 !important;
  background-color: var(--color-primary-background) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
  cursor: grabbing !important;
  z-index: 99999 !important;
  pointer-events: none;
  
  .list-item {
    background: transparent !important;
    display: flex !important;
    align-items: center !important;
  }
}



  :global {
    .list-item-cell.name {
      flex-direction: column !important;
      justify-content: center;
      align-items: flex-start;
      line-height: 1.3; // 稍微增加行高
      padding-top: 4px;
      padding-bottom: 4px;

      .name-container {
        display: flex;
        align-items: center;
        width: 100%;
        .name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .label-source {
          margin-left: 4px;
          flex: 0 0 auto;
        }
      }
    }
  }

.alias {
  font-size: 11px;
  color: var(--color-primary-alpha-200);
  margin-top: 2px;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.singer {
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
}

.singerSplit {
  opacity: 0.6;
}

</style>
