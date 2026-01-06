<template lang="pug">
material-modal(
  :show="show"
  :bg-close="false"
  max-width="420px"
  @close="handleCancel"
)
  main(:class="$style.main")
    h2(:class="$style.title") {{ $t('list_add__duplicate_tip') }}
    
    //- 歌单列表，每个可点击跳转
    ul(:class="$style.listContainer")
      li(
        v-for="item in existingLists"
        :key="item.id"
        :class="$style.listItem"
        @click="handleNavigateToList(item)"
      )
        svg(version="1.1" xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 0 24 24")
          use(xlink:href="#icon-musicFolder")
        span {{ item.name }}
        svg(:class="$style.arrowIcon" version="1.1" xmlns="http://www.w3.org/2000/svg" height="12" viewBox="0 0 24 24")
          use(xlink:href="#icon-right")
    
    p(:class="$style.hint") {{ $t('list_add__duplicate_hint') }}
    
    //- 操作按钮
    div(:class="$style.footer")
      base-btn(:class="$style.btn" @click="handleCancel") {{ $t('btn_cancel') }}
      base-btn(:class="[$style.btn, $style.primaryBtn]" @click="handleConfirm") {{ $t('list_add__confirm') }}
</template>

<script>
import { useRouter } from '@common/utils/vueRouter'

export default {
  name: 'DuplicateSongModal',
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: Object,
      default: null,
    },
    existingLists: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['update:show', 'confirm', 'cancel', 'navigate'],
  setup(props, { emit }) {
    const router = useRouter()

    const handleConfirm = () => {
      emit('update:show', false)
      emit('confirm')
    }

    const handleCancel = () => {
      emit('update:show', false)
      emit('cancel')
    }

    const handleNavigateToList = (listItem) => {
      emit('update:show', false)
      emit('navigate', listItem)
      
      // 导航到指定歌单并定位到歌曲
      if (props.musicInfo && listItem.musicId) {
        router.push({
          path: '/list',
          query: {
            id: listItem.id,
            musicId: listItem.musicId,
          },
        })
      }
    }

    return {
      handleConfirm,
      handleCancel,
      handleNavigateToList,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 20px;
  min-width: 320px;
}

.title {
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-font);
}

.listContainer {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
}

.listItem {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--color-primary-background-hover);
  color: var(--color-font);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-primary-background-hover);
    color: var(--color-primary);
  }

  svg {
    flex-shrink: 0;
    fill: currentColor;
    opacity: 0.7;
  }

  span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.arrowIcon {
  opacity: 0.4;
}

.hint {
  margin: 12px 0 0 0;
  font-size: 12px;
  color: var(--color-font-label);
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  min-width: 80px;
}

.primaryBtn {
  background: var(--color-primary) !important;
  color: #fff !important;

  &:hover {
    opacity: 0.9;
  }
}
</style>
