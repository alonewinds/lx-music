import { onMounted, onBeforeUnmount, nextTick } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { setListPosition, getListPosition } from '@renderer/utils/data'
import { appSetting } from '@renderer/store/setting'

export default ({ props, listRef, list, handleRestoreScroll, dom_listContent }) => {
  const route = useRoute()
  const router = useRouter()

  const saveListPosition = () => {
    setListPosition(props.listId, listRef.value?.getScrollTop() || 0)
  }

  const handleScrollList = (index, isAnimation, callback = () => { }) => {
    // 获取容器高度和表头高度,计算偏移量使目标项出现在窗口正中央
    const container = listRef.value?.$refs?.dom_scrollContainer
    let offset = -150 // 默认偏移量

    if (container && dom_listContent.value) {
      const containerHeight = container.clientHeight
      const itemHeight = listRef.value.$props.itemHeight

      // 计算使目标项居中的偏移量
      // 我们希望歌曲的中心对齐到容器的中心
      offset = -(containerHeight / 2 - itemHeight / 2)

      console.log('handleScrollList - index:', index, 'offset:', offset)
    }

    // 使用 nextTick 和 requestAnimationFrame 确保虚拟列表已经渲染完成
    void nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log('handleScrollList - 执行滚动')
          listRef.value.scrollToIndex(index, offset, isAnimation, callback)

          // 延迟检查实际滚动位置
          setTimeout(() => {
            const actualScrollTop = container?.scrollTop
            console.log('handleScrollList - 实际 scrollTop:', actualScrollTop)
          }, 500)
        })
      })
    })
  }

  const restoreScroll = async (index, isAnimation) => {
    // console.log(index, isAnimation)
    if (!list.value.length) return
    if (index == null) {
      let location = await getListPosition(props.listId) || 0
      if (appSetting['list.isSaveScrollLocation'] && location != null) {
        listRef.value?.scrollTo(location)
      }
      return
    }

    handleScrollList(index, isAnimation ?? true)
  }

  onMounted(() => {
    handleRestoreScroll(route.query.scrollIndex, false)
    if (route.query.scrollIndex != null) {
      router.replace({
        path: '/list',
        query: {
          id: props.listId,
          updated: true,
        },
      })
    }
  })
  onBeforeUnmount(() => {
    saveListPosition()
  })

  return {
    saveListPosition,
    restoreScroll,
  }
}
