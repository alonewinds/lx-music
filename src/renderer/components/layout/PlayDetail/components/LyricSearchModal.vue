<template lang="pug">
teleport(to="#root")
  div(
    v-if="visible"
    :class="$style.overlay"
  )
    div(:class="$style.modal")
      //- 标题栏
      div(:class="$style.header")
        h3(:class="$style.title") {{ $t('lyric_search__title') }}
        button(:class="$style.closeBtn" @click="handleClose")
          svg(version="1.1" xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 24 24")
            use(xlink:href="#icon-close")

      //- 搜索区域
      div(:class="$style.searchArea")
        input(
          ref="searchInputRef"
          v-model="keyword"
          :class="$style.searchInput"
          :placeholder="$t('lyric_search__placeholder')"
          @keyup.enter="handleSearch"
        )
        base-btn(
          :class="$style.searchBtn"
          :disabled="!keyword.trim() || isSearching"
          @click="handleSearch"
        ) {{ isSearching ? $t('lyric_search__searching') : $t('lyric_search__search') }}

      //- 主内容区
      div(:class="$style.body")
        //- 左侧：搜索结果列表
        div(:class="$style.resultSection")
          div(:class="$style.sectionHeader")
            span {{ $t('lyric_search__results') }}
            span(v-if="filteredResults.length" :class="$style.count") ({{ filteredResults.length }})
            //- 歌词源筛选下拉菜单
            select(
              v-model="selectedSource"
              :class="$style.sourceFilter"
            )
              option(value="all") {{ $t('lyric_search__source_all') }}
              option(v-for="(name, key) in sourceNames" :key="key" :value="key") {{ name }}
          
          div(v-if="isSearching" :class="$style.loading")
            span {{ $t('lyric_search__loading') }}
          
          div(v-else-if="searchError" :class="$style.error")
            span {{ searchError }}
          
          div(v-else-if="!searchResults.length && hasSearched" :class="$style.empty")
            span {{ $t('lyric_search__no_results') }}
          
          div(v-else :class="$style.resultList")
            div(
              v-for="(item, index) in filteredResults"
              :key="`${item.source}-${item.id}`"
              :class="[$style.resultItem, { [$style.selected]: selectedItem === item }]"
              @click="handleSelectItem(item)"
            )
              span(:class="$style.sourceTag") {{ sourceNames[item.source] }}
              div(:class="$style.itemInfo")
                div(:class="$style.itemName") {{ item.name }}
                div(:class="$style.itemMeta") {{ item.singer }} - {{ item.album }}
              span(:class="$style.itemDuration") {{ formatDuration(item.duration) }}

        //- 右侧：歌词预览
        div(:class="$style.previewSection")
          div(:class="$style.sectionHeader")
            span {{ $t('lyric_search__preview') }}
            span(v-if="isLoadingLyric" :class="$style.loadingText") {{ $t('lyric_search__loading_lyric') }}
          
          div(:class="$style.lyricPreview")
            pre(v-if="previewLyric") {{ previewLyric }}
            div(v-else-if="selectedIndex >= 0" :class="$style.previewHint")
              span {{ $t('lyric_search__click_to_preview') }}
            div(v-else :class="$style.previewHint")
              span {{ $t('lyric_search__select_hint') }}

      //- 底部操作栏
      div(:class="$style.footer")
        base-btn(:class="$style.footerBtn" @click="handleClose") {{ $t('btn_cancel') }}
        base-btn(
          :class="[$style.footerBtn, $style.primaryBtn]"
          :disabled="!previewLyric"
          @click="handleApply"
        ) {{ $t('lyric_search__apply') }}
</template>

<script>
import { ref, watch, nextTick, computed } from '@common/utils/vueTools'
import { searchAllSources, getLyricByInfo, sourceNames } from '@renderer/utils/lyricSearch'
import { formatDuration } from '@renderer/utils/lyricSearch/utils'

export default {
  name: 'LyricSearchModal',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: Object,
      default: null,
    },
  },
  emits: ['close', 'apply'],
  setup(props, { emit }) {
    const searchInputRef = ref(null)
    const keyword = ref('')
    const isSearching = ref(false)
    const searchError = ref('')
    const searchResults = ref([])
    const hasSearched = ref(false)
    const selectedSource = ref('all')  // 当前选中的歌词源筛选
    const selectedItem = ref(null)     // 当前选中的结果项
    const isLoadingLyric = ref(false)
    const previewLyric = ref('')
    const currentLyricContent = ref(null)

    // 根据选中的歌词源筛选结果
    const filteredResults = computed(() => {
      if (selectedSource.value === 'all') {
        return searchResults.value
      }
      return searchResults.value.filter(item => item.source === selectedSource.value)
    })

    // 初始化关键词
    watch(() => props.visible, async (val) => {
      if (val) {
        // 自动填入当前歌曲的「歌曲名 - 歌手名」
        if (props.musicInfo) {
          const name = props.musicInfo.name || ''
          const singer = props.musicInfo.singer || ''
          keyword.value = singer ? `${name} ${singer}` : name
        }
        // 重置状态
        searchResults.value = []
        selectedSource.value = 'all'
        selectedItem.value = null
        previewLyric.value = ''
        currentLyricContent.value = null
        hasSearched.value = false
        searchError.value = ''
        
        // 聚焦输入框
        await nextTick()
        searchInputRef.value?.focus()
        searchInputRef.value?.select()
        
        // 自动搜索
        if (keyword.value.trim()) {
          handleSearch()
        }
      }
    })

    // 搜索
    const handleSearch = async () => {
      const kw = keyword.value.trim()
      if (!kw || isSearching.value) return

      isSearching.value = true
      searchError.value = ''
      searchResults.value = []
      selectedSource.value = 'all'
      selectedItem.value = null
      previewLyric.value = ''
      hasSearched.value = true

      try {
        const result = await searchAllSources(kw)
        searchResults.value = result.list
        if (!result.list.length && result.errors.length) {
          searchError.value = '搜索失败，请稍后重试'
        }
      } catch (err) {
        console.error('[LyricSearch] search error:', err)
        searchError.value = err.message || '搜索失败'
      } finally {
        isSearching.value = false
      }
    }

    // 选择搜索结果项
    const handleSelectItem = async (item) => {
      if (selectedItem.value === item) return
      selectedItem.value = item
      previewLyric.value = ''
      currentLyricContent.value = null

      if (!item) return

      isLoadingLyric.value = true
      try {
        const lyricContent = await getLyricByInfo(item)
        currentLyricContent.value = lyricContent
        previewLyric.value = lyricContent.lyric || '（无歌词）'
      } catch (err) {
        console.error('[LyricSearch] get lyric error:', err)
        previewLyric.value = '获取歌词失败: ' + (err.message || '未知错误')
      } finally {
        isLoadingLyric.value = false
      }
    }

    // 应用歌词
    const handleApply = () => {
      if (!currentLyricContent.value) return
      emit('apply', currentLyricContent.value)
    }

    // 关闭
    const handleClose = () => {
      emit('close')
    }

    return {
      searchInputRef,
      keyword,
      isSearching,
      searchError,
      searchResults,
      filteredResults,
      hasSearched,
      selectedSource,
      selectedItem,
      isLoadingLyric,
      previewLyric,
      sourceNames,
      formatDuration,
      handleSearch,
      handleSelectItem,
      handleApply,
      handleClose,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 900px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--color-content-background);
  border-radius: @radius-border;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px;
  border-bottom: 1px solid var(--color-primary-background-hover);
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-font);
}

.closeBtn {
  background: none;
  border: none;
  padding: 5px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.searchArea {
  display: flex;
  gap: 10px;
  padding: 15px 20px;
  border-bottom: 1px solid var(--color-primary-background-hover);
}

.searchInput {
  flex: 1;
  padding: 10px 15px;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
  color: var(--color-font);
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: var(--color-primary);
  }

  &::placeholder {
    color: var(--color-font-label);
    opacity: 0.5;
  }
}

.searchBtn {
  min-width: 80px;
  height: 40px;
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 15px;
  padding: 15px 20px;
  overflow: hidden;
}

.resultSection, .previewSection {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sectionHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--color-font-label);
}

.count {
  font-size: 12px;
  opacity: 0.7;
}

.sourceFilter {
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
  color: var(--color-font);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;

  &:hover, &:focus {
    border-color: var(--color-primary);
  }

  option {
    background: var(--color-content-background);
    color: var(--color-font);
  }
}

.loadingText {
  font-size: 12px;
  color: var(--color-primary);
}

.loading, .error, .empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-font-label);
  font-size: 14px;
}

.error {
  color: var(--color-error, #f56c6c);
}

.resultList {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
}

.resultItem {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--color-primary-background-hover);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-primary-background-hover);
  }

  &.selected {
    background: var(--color-primary-background-active);
  }
}

.sourceTag {
  flex-shrink: 0;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  background: var(--color-primary);
  color: #fff;
}

.itemInfo {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.itemName {
  font-size: 14px;
  color: var(--color-font);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.itemMeta {
  font-size: 12px;
  color: var(--color-font-label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.itemDuration {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-font-label);
  font-family: monospace;
}

.lyricPreview {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
  padding: 15px;

  pre {
    margin: 0;
    font-size: 13px;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--color-font);
    font-family: inherit;
  }
}

.previewHint {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-font-label);
  font-size: 14px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid var(--color-primary-background-hover);
}

.footerBtn {
  min-width: 80px;
}

.primaryBtn {
  background: var(--color-primary) !important;
  color: #fff !important;

  &:hover:not([disabled]) {
    opacity: 0.9;
    background: var(--color-primary) !important;
  }
}
</style>
