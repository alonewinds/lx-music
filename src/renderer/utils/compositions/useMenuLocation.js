import { onMounted, onBeforeUnmount, watch, reactive, ref, nextTick } from '@common/utils/vueTools'


export default ({ visible, location, onHide }) => {
  const transition1 = 'transform, opacity'
  const transition2 = 'transform, opacity, top, left'
  let show = false
  let isUnmounted = false // 添加卸载状态跟踪
  const dom_menu = ref(null)
  const menuStyles = reactive({
    left: 0,
    top: 0,
    opacity: 0,
    transitionProperty: 'transform, opacity',
    transform: 'scale(.8, .7) translate(0,0)',
    pointerEvents: 'none',
  })

  const handleShow = () => {
    // 确保组件未卸载且 DOM 已经准备好
    if (isUnmounted || !dom_menu.value || !dom_menu.value.offsetParent) {
      return
    }

    show = true
    menuStyles.opacity = 1
    menuStyles.transform = `scale(1) translate(${handleGetOffsetXY(location.value.x, location.value.y)})`
    menuStyles.pointerEvents = 'auto'
  }
  const handleHide = () => {
    if (isUnmounted) return

    menuStyles.opacity = 0
    menuStyles.transform = 'scale(.8, .7) translate(0, 0)'
    menuStyles.pointerEvents = 'none'
    show = false
  }
  const handleGetOffsetXY = (left, top) => {
    // 添加空值检查和卸载状态检查
    if (isUnmounted || !dom_menu.value || !dom_menu.value.offsetParent) {
      return '0px, 0px'
    }

    const listWidth = dom_menu.value.clientWidth
    const listHeight = dom_menu.value.clientHeight
    const dom_container_parant = dom_menu.value.offsetParent
    const containerWidth = dom_container_parant.clientWidth
    const containerHeight = dom_container_parant.clientHeight
    const offsetWidth = containerWidth - left - listWidth
    const offsetHeight = containerHeight - top - listHeight
    let x = 0
    let y = 0
    if (containerWidth > listWidth && offsetWidth < 12) {
      x = offsetWidth - 12
    }
    if (containerHeight > listHeight && offsetHeight < 5) {
      y = offsetHeight - 5
    }
    return `${x}px, ${y}px`
  }
  const handleDocumentClick = (event) => {
    if (isUnmounted || !show) return

    // 添加空值检查
    if (!dom_menu.value) return

    if (event.target == dom_menu.value || dom_menu.value.contains(event.target)) return

    if (show && menuStyles.transitionProperty != transition1) menuStyles.transitionProperty = transition1

    onHide()
  }

  watch(visible, visible => {
    if (isUnmounted) return

    if (visible) {
      // 使用 nextTick 确保 DOM 已经更新
      nextTick(() => {
        if (!isUnmounted) {
          handleShow()
        }
      })
    } else {
      handleHide()
    }
  })

  watch(location, location => {
    if (isUnmounted) return

    menuStyles.left = location.x - window.lx.rootOffset + 2 + 'px'
    menuStyles.top = location.y - window.lx.rootOffset + 'px'
    // nextTick(() => {
    if (show && dom_menu.value && dom_menu.value.offsetParent) {
      if (menuStyles.transitionProperty != transition2) menuStyles.transitionProperty = transition2
      menuStyles.transform = `scale(1) translate(${handleGetOffsetXY(location.x, location.y)})`
    }
    // })
  }, { deep: true })

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
  })

  onBeforeUnmount(() => {
    isUnmounted = true // 标记为已卸载
    document.removeEventListener('click', handleDocumentClick)
  })

  return {
    dom_menu,
    menuStyles,
  }
}
