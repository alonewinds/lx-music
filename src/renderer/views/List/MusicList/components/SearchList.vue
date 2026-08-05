<template>
  <teleport to="#view">
    <!-- 透明遮罩层，用于捕获点击外部事件 -->
    <div v-show="isShow" :class="$style.overlay" @mousedown="handleHide" />
    <!-- 搜索框容器 -->
    <div v-show="isShow" ref="dom_container" :class="$style.container">
      <transition enter-active-class="animated-fast zoomIn" leave-active-class="animated zoomOut" @after-leave="handleAnimated">
        <div v-show="visible" :class="$style.search">
          <div :class="$style.form">
            <input
              ref="dom_input" v-model.trim="text" class="ignore-esc" :placeholder="placeholder" @input="handleDelaySearch"
              @keydown.arrow-down.arrow-up.prevent @keyup.arrow-down.prevent.exact="handleKeyDown" @keyup.arrow-up.prevent.exact="handleKeyUp"
              @keyup.enter="handleTemplistClick(selectIndex)"
              @keyup.escape.prevent.exact="handleKeyEsc" @keydown.control.prevent="handle_key_mod_down" @keydown.meta.prevent="handle_key_mod_down"
              @keyup.control.prevent="handle_key_mod_up" @keyup.meta.prevent="handle_key_mod_up" @contextmenu="handleContextMenu"
            >
            <button type="button" :title="isGlobal ? '搜索所有歌单' : '搜索当前歌单'" @click="toggleSearchScope">
              <svg v-if="isGlobal" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="70%" viewBox="0 0 24 24" space="preserve">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="70%" viewBox="0 0 24 24" space="preserve">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.22-7.52-4.28z"/>
              </svg>
            </button>
            <button type="button" @click="handleHide">
              <slot>
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="70%" viewBox="0 0 212.982 212.982" space="preserve">
                  <use xlink:href="#icon-delete" />
                </svg>
              </slot>
            </button>
          </div>
          <div v-if="resultList" ref="dom_scrollContainer" class="scroll" :class="$style.list" :style="listStyle">
            <ul ref="dom_list">
              <li v-for="(item, index) in resultList" :key="item.songmid" :class="selectIndex === index ? $style.select : null" @mouseenter="selectIndex = index" @click="handleTemplistClick(index)" @contextmenu.prevent="handleRightClick($event, index)">
                <div :class="$style.img" />
                <div :class="$style.text">
                  <h3 :class="$style.text">{{ item.name }} - {{ item.singer }}</h3>
                  <h3 v-if="item.meta.albumName" :class="[$style.text, $style.albumName]">{{ item.meta.albumName }}</h3>
                </div>
                
                <!-- 操作按钮 -->
                <div :class="$style.actions">
                  <button 
                    type="button" 
                    :class="$style.actionBtn"
                    :aria-label="$t('list__play')"
                    @click.stop="handleAction('play', index)"
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 287.386 287.386" space="preserve">
                      <use xlink:href="#icon-testPlay" />
                    </svg>
                  </button>
                  <button 
                    v-if="assertApiSupport(item.source) && item.source != 'local'"
                    type="button"
                    :class="$style.actionBtn"
                    :aria-label="$t('list__download')"
                    @click.stop="handleAction('download', index)"
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 475.078 475.077" space="preserve">
                      <use xlink:href="#icon-download" />
                    </svg>
                  </button>
                </div>
                
                <div v-if="isGlobal && item.listName" :class="$style.listName">{{ item.listName }}</div>
                <div :class="$style.source">{{ item.source }}</div>
              </li>
            </ul>
          </div>
          <div v-if="text.length > 0" :class="$style.emptyHint">
            按↑↓键选择歌曲，直接按 Enter 则跳转到歌曲市场中搜索「{{ text }}」
          </div>
          <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
        </div>
      </transition>
    </div>
  </teleport>
</template>

<script>
import { debounce } from '@common/utils'
import { clipboardReadText } from '@common/utils/electron'
import { toRaw, computed, reactive, ref } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { assertApiSupport } from '@renderer/store/utils'
import { useI18n } from '@renderer/plugins/i18n'
import musicSdk from '@renderer/utils/musicSdk'
import { hasDislike } from '@renderer/core/dislikeList'

export default {
  props: {
    placeholder: {
      type: String,
      default: 'Search for something...',
    },
    list: {
      type: Array,
      default() {
        return []
      },
    },
    visible: {
      type: Boolean,
      default: false,
    },
    loadAllLists: {
      type: Function,
      default: null,
    },
  },
  emits: ['action'],
  setup() {
    const t = useI18n()
    const router = useRouter()
    const isShowItemMenu = ref(false)
    const menuLocation = reactive({ x: 0, y: 0 })
    const rightClickIndex = ref(-1)
    const itemMenuControl = reactive({
      play: true,
      playLater: true,
      copyName: true,
      download: true,
      search: true,
      dislike: true,
      sourceDetail: true,
    })

    const menus = computed(() => {
      return [
        {
          name: t('list__play'),
          action: 'play',
          disabled: !itemMenuControl.play,
        },
        {
          name: t('list__download'),
          action: 'download',
          disabled: !itemMenuControl.download,
        },
        {
          name: t('list__play_later'),
          action: 'playLater',
          disabled: !itemMenuControl.playLater,
        },
        {
          name: t('list__copy_name'),
          action: 'copyName',
          disabled: !itemMenuControl.copyName,
        },
        {
          name: t('list__source_detail'),
          action: 'sourceDetail',
          disabled: !itemMenuControl.sourceDetail,
        },
        {
          name: t('list__search'),
          action: 'search',
          disabled: !itemMenuControl.search,
        },
        {
          name: t('list__dislike'),
          action: 'dislike',
          disabled: !itemMenuControl.dislike,
        },
      ]
    })

    return {
      assertApiSupport,
      router,
      isShowItemMenu,
      menuLocation,
      rightClickIndex,
      itemMenuControl,
      menus,
      musicSdk,
      hasDislike,
    }
  },
  data() {
    return {
      text: '',
      selectIndex: -1,
      listStyle: {
        height: 0,
        maxHeight: 0,
        overflow: 'hidden',
      },
      maxHeight: 0,
      resultList: [],
      isModDown: false,
      isShow: false,
      isGlobal: false,
    }
  },
  watch: {
    resultList(n) {
      if (this.selectIndex > -1) this.selectIndex = -1
      this.$nextTick(() => {
        const height = this.$refs.dom_list.scrollHeight
        if (height > this.maxHeight) {
          this.listStyle.height = this.maxHeight + 'px'
          this.listStyle.overflow = 'auto'
        } else {
          this.listStyle.height = height + 'px'
          this.listStyle.overflow = 'hidden'
        }
      })
    },
    list(n) {
      if (!this.visible) return
      this.handleDelaySearch()
    },
    visible(n) {
      if (!n) {
        this.text = ''
        this.resultList = []
        return
      }
      this.isShow = true
      this.init()
    },
  },
  created() {
    this.handleDelaySearch = debounce(() => {
      this.handleSearch()
    })
    if (this.visible) this.isShow = true
  },
  mounted() {
    this.init()
    // window.key_event.on('key_mod_down', this.handle_key_mod_down)
    // window.key_event.on('key_mod_up', this.handle_key_mod_up)
    window.key_event.on('key_mod+f_down', this.handle_key_mod_f_down)
  },
  beforeUnmount() {
    // window.key_event.off('key_mod_down', this.handle_key_mod_down)
    // window.key_event.off('key_mod_up', this.handle_key_mod_up)
    window.key_event.off('key_mod+f_down', this.handle_key_mod_f_down)
  },
  methods: {
    init() {
      if (!this.visible) return
      this.handleSearch()
      this.$nextTick(() => {
        if (!this.listStyle.maxHeight) {
          this.maxHeight = this.$refs.dom_container.offsetParent.clientHeight - this.$refs.dom_list.offsetTop - 70
          this.listStyle.maxHeight = this.maxHeight + 'px'
        }
        this.$refs.dom_input.focus()
      })
    },
    handleKeyEsc() {
      if (this.text.length > 0) {
        this.text = ''
        this.resultList = []
      } else {
        this.handleHide()
      }
    },
    handle_key_mod_down() {
      console.log('handle_key_mod_down')
      this.isModDown ||= true
    },
    handle_key_mod_up() {
      this.isModDown &&= false
    },
    handle_key_mod_f_down() {
      if (this.visible) this.$refs.dom_input.focus()
    },
    handleAnimated() {
      if (this.visible) return
      this.isShow = false
    },
    handleTemplistClick(index) {
      if (index < 0) {
        // 有搜索词且未通过方向键选中任何结果时，按 Enter 跳转到歌曲市场搜索
        // 无论结果列表有无内容，只要没有手动选中就直接去市场搜索
        if (this.text.length > 0) {
          this.sendEvent('searchInMarket', { text: this.text })
        }
        return
      }
      const item = this.resultList[index]
      
      if (this.isGlobal && item.listId) {
        // 全局搜索模式: 跳转到目标歌单
        this.router.replace({
          path: '/list',
          query: { 
            id: item.listId, 
            musicId: item.id 
          },
        }).catch(_ => _)
        
        // 关闭搜索框
        this.sendEvent('hide')
      } else {
        // 当前歌单搜索模式: 保持原有逻辑
        const id = item.id
        this.sendEvent('listClick', {
          index: this.list.findIndex(m => m.id == id),
          isPlay: this.isModDown,
        })
      }
    },
    handleHide() {
      this.sendEvent('hide')
    },
    sendEvent(action, data) {
      this.$emit('action', {
        action,
        data,
      })
    },
    handleKeyDown() {
      if (this.resultList.length) {
        this.selectIndex = this.selectIndex + 1 < this.resultList.length ? this.selectIndex + 1 : 0
        this.handleScrollList()
      } else if (this.selectIndex > -1) {
        this.selectIndex = -1
      }
    },
    handleKeyUp() {
      if (this.resultList.length) {
        this.selectIndex = this.selectIndex - 1 < -1 ? this.resultList.length - 1 : this.selectIndex - 1
        this.handleScrollList()
      } else if (this.selectIndex > -1) {
        this.selectIndex = -1
      }
    },
    handleScrollList() {
      if (this.selectIndex < 0) return
      let dom = this.$refs.dom_list.children[this.selectIndex]
      let offsetTop = dom.offsetTop
      let scrollTop = this.$refs.dom_scrollContainer.scrollTop
      let top
      if (offsetTop < scrollTop) {
        top = offsetTop
      } else if (offsetTop + dom.clientHeight > this.$refs.dom_scrollContainer.clientHeight + scrollTop) {
        top = offsetTop + dom.clientHeight - this.$refs.dom_scrollContainer.clientHeight
      } else return
      this.$refs.dom_scrollContainer.scrollTo(0, top)
    },
    handleContextMenu() {
      let str = clipboardReadText()
      str = str.trim()
      str = str.replace(/\t|\r\n|\n|\r/g, ' ')
      str = str.replace(/\s+/g, ' ')
      let dom_input = this.$refs.dom_input
      const text = dom_input.value
      // if (dom_input.selectionStart == dom_input.selectionEnd) {
      const value = text.substring(0, dom_input.selectionStart) + str + text.substring(dom_input.selectionEnd, text.length)
      // event.target.value = value
      this.text = value
      // } else {
      //   clipboardWriteText(text.substring(dom_input.selectionStart, dom_input.selectionEnd))
      // }
    },
    async handleSearch() {
      if (!this.text.length) return this.resultList = []
      
      if (this.isGlobal && this.loadAllLists) {
        try {
          const lists = await this.loadAllLists()
          this.resultList = await window.lx.worker.main.searchAllListsMusic(toRaw(lists), this.text)
        } catch (err) {
          console.error(err)
          this.resultList = []
        }
      } else {
        this.resultList = await window.lx.worker.main.searchListMusic(toRaw(this.list), this.text)
      }
    },
    toggleSearchScope() {
      this.isGlobal = !this.isGlobal
      this.handleDelaySearch()
    },
    handleAction(action, index) {
      const item = this.resultList[index]
      this.sendEvent('action', { action, item, index })
    },
    handleRightClick(event, index) {
      const item = this.resultList[index]
      this.rightClickIndex = index
      
      // 更新菜单控制状态
      this.itemMenuControl.sourceDetail = !!this.musicSdk[item.source]?.getMusicDetailPageUrl
      this.itemMenuControl.download = this.assertApiSupport(item.source) && item.source != 'local'
      this.itemMenuControl.dislike = !this.hasDislike(item)
      
      // 设置菜单位置
      this.menuLocation.x = event.pageX
      this.menuLocation.y = event.pageY
      
      // 显示菜单
      this.isShowItemMenu = true
    },
    handleMenuClick(action) {
      const item = this.resultList[this.rightClickIndex]
      this.isShowItemMenu = false
      
      if (!action || this.rightClickIndex < 0) return
      
      // 发送菜单操作事件到父组件
      this.sendEvent('menuAction', { 
        action: action.action, 
        item, 
        index: this.rightClickIndex 
      })
      
      this.rightClickIndex = -1
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

// 透明遮罩层，覆盖整个视口用于捕获点击外部事件
.overlay {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 98;
}

.container {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 20px;
  width: 45%;
  height: @height-toolbar * 0.52;
  z-index: 99;
}

.search {
  position: absolute;
  width: 100%;
  border-radius: 4px;
  transition: box-shadow .4s ease, background-color @transition-normal;
  display: flex;
  flex-flow: column nowrap;
  background-color: var(--color-primary-light-600-alpha-100);
  box-shadow: 0 1px 2px rgba(0,0,0,0.07),
                0 2px 4px rgba(0,0,0,0.07),
                0 4px 8px rgba(0,0,0,0.07),
                0 8px 16px rgba(0,0,0,0.07),
                0 16px 32px rgba(0,0,0,0.07),
                0 32px 64px rgba(0,0,0,0.07);

  &.active {
    .form {
      input {
        border-bottom-left-radius: 0;

      }
      button {
        border-bottom-right-radius: 0;
      }
    }
  }
  .form {
    display: flex;
    height: @height-toolbar * 0.52;
    position: relative;
    input {
      flex: auto;
      // border: 1px solid;
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
      background-color: transparent;
      // border-bottom: 2px solid var(--color-primary);
      // border-color: var(--color-primary);
      border: none;

      outline: none;
      // height: @height-toolbar * .7;
      padding: 0 5px;
      overflow: hidden;
      font-size: 13.5px;
      line-height: @height-toolbar * 0.52 + 5px;
      &::placeholder {
        color: var(--color-button-font);
        font-size: .98em;
      }
    }
    button {
      flex: none;
      border: none;
      // background-color: @color-search-form-background;
      background-color: transparent;
      outline: none;
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
      cursor: pointer;
      height: 100%;
      padding: 6px 9px;
      color: var(--color-button-font);
      transition: background-color .2s ease;
      opacity: 0.8;

      &:hover {
        background-color: var(--color-button-background-hover);
      }
      &:active {
        background-color: var(--color-button-background-active);
      }
    }
  }
  .list {
    // background-color: @color-search-form-background;
    font-size: 13px;
    transition: .3s ease;
    height: 0;
    transition-property: height;
    position: relative;
    scroll-behavior: smooth;

    li {
      position: relative;
      cursor: pointer;
      padding: 8px 5px;
      transition: background-color .2s ease;
      line-height: 1.3;
      // overflow: hidden;
      display: flex;
      flex-flow: row nowrap;

      &.select {
        background-color: var(--color-primary-dark-100-alpha-700);
      }
      border-radius: 4px;
      // &:last-child {
      //   border-bottom-left-radius: 4px;
      //   border-bottom-right-radius: 4px;
      // }
    }
  }
}

.img {
  flex: none;
}
.text {
  flex: auto;
  .mixin-ellipsis-1();
}
.albumName {
  font-size: 12px;
  opacity: 0.6;
  .mixin-ellipsis-1();
}
.listName {
  flex: none;
  font-size: 11px;
  padding: 2px 8px;
  background-color: var(--color-primary-background-hover);
  border-radius: 10px;
  color: var(--color-font-label);
  white-space: nowrap;
  margin: 0 5px;
  display: flex;
  align-items: center;
}
.source {
  flex: none;
  font-size: 12px;
  opacity: 0.5;
  padding: 0 5px;
  display: flex;
  align-items: center;
  // transform: rotate(45deg);
  // background-color:
}

.actions {
  flex: none;
  display: flex;
  align-items: center;
  margin: 0 8px;
  gap: 4px;
}

.actionBtn {
  background-color: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 4px 6px;
  color: var(--color-button-font);
  outline: none;
  transition: background-color 0.2s ease;
  line-height: 0;
  opacity: 0.8;
  
  svg {
    height: 14px;
    width: 14px;
  }
  
  &:hover {
    background-color: var(--color-button-background-hover);
    opacity: 1;
  }
  
  &:active {
    background-color: var(--color-button-background-active);
  }
}

.emptyHint {
  font-size: 12px;
  color: var(--color-button-font);
  opacity: 0.65;
  padding: 8px 10px 6px;
  text-align: center;
  cursor: default;
  user-select: none;
}

</style>
