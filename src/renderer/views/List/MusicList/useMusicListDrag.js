import { ref, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { clearDownKeys } from '@renderer/event'

/**
 * 自定义拖拽排序实现
 * 不依赖 sortablejs，完全控制拖拽逻辑，兼容虚拟列表
 */
export default ({ listRef, list, onUpdate, onStart, onEnd }) => {
    const isDragging = ref(false)

    let dragState = null
    let dragIndicator = null
    let dropIndicator = null
    let scrollInterval = null

    // 创建拖拽指示器 (跟随鼠标的元素)
    const createDragIndicator = (text) => {
        const indicator = document.createElement('div')
        indicator.className = 'custom-drag-indicator'
        indicator.innerHTML = `
            <div class="drag-icon">≡</div>
            <div class="drag-text">${text}</div>
        `
        indicator.style.cssText = `
            position: fixed;
            z-index: 99999;
            pointer-events: none;
            padding: 8px 16px;
            background: var(--color-primary-background);
            border: 1px solid var(--color-primary);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: var(--color-font);
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            opacity: 0;
            transition: opacity 0.15s;
        `
        document.body.appendChild(indicator)
        // 触发重绘后显示
        requestAnimationFrame(() => {
            indicator.style.opacity = '0.95'
        })
        return indicator
    }

    // 创建放置位置指示器 (水平线)
    const createDropIndicator = () => {
        const indicator = document.createElement('div')
        indicator.className = 'custom-drop-indicator'
        indicator.style.cssText = `
            position: fixed;
            height: 3px;
            background: var(--color-primary);
            z-index: 99999;
            pointer-events: none;
            border-radius: 2px;
            box-shadow: 0 0 8px var(--color-primary);
            display: none;
        `
        return indicator
    }

    // 更新拖拽指示器位置
    const updateDragIndicator = (e) => {
        if (dragIndicator) {
            dragIndicator.style.left = (e.clientX + 15) + 'px'
            dragIndicator.style.top = (e.clientY + 15) + 'px'
        }
    }

    // 获取鼠标位置对应的列表索引
    const getDropIndex = (e, scrollContainer, itemHeight) => {
        const rect = scrollContainer.getBoundingClientRect()
        const scrollTop = scrollContainer.scrollTop
        const relativeY = e.clientY - rect.top + scrollTop
        return Math.floor(relativeY / itemHeight)
    }

    // 更新放置指示器位置
    const updateDropIndicator = (e) => {
        if (!dropIndicator || !listRef.value) return

        const scrollContainer = listRef.value.dom_scrollContainer
        if (!scrollContainer) return

        const rect = scrollContainer.getBoundingClientRect()
        const views = listRef.value?.views || []
        const itemHeight = views[0]?.style?.height ? parseInt(views[0].style.height) : 36

        // 计算放置位置索引
        const scrollTop = scrollContainer.scrollTop
        const relativeY = e.clientY - rect.top + scrollTop
        const dropIndex = Math.max(0, Math.min(list.value.length, Math.round(relativeY / itemHeight)))

        // 计算指示器在视口中的位置
        // dropIndex * itemHeight 是在完整列表中的位置
        // 减去 scrollTop 得到相对于可见区域的位置
        // 加上 rect.top 得到相对于视口的位置
        const indicatorTop = dropIndex * itemHeight - scrollTop + rect.top

        // 只在指示器在容器可见区域内时显示
        if (indicatorTop >= rect.top && indicatorTop <= rect.bottom) {
            dropIndicator.style.display = 'block'
            dropIndicator.style.top = indicatorTop + 'px'
            dropIndicator.style.left = rect.left + 'px'
            dropIndicator.style.width = rect.width + 'px'
        } else {
            dropIndicator.style.display = 'none'
        }

        dragState.dropIndex = dropIndex
    }

    // 自动滚动
    const autoScroll = (e) => {
        if (!listRef.value) return

        const scrollContainer = listRef.value.dom_scrollContainer
        if (!scrollContainer) return

        const rect = scrollContainer.getBoundingClientRect()
        const SCROLL_ZONE = 80 // 边缘滚动触发区域
        const SCROLL_SPEED = 8 // 最大滚动速度

        const mouseY = e.clientY

        // 鼠标在容器上方（包括超出容器边界）
        if (mouseY < rect.top + SCROLL_ZONE) {
            // 鼠标越靠上，滚动越快
            const distance = rect.top + SCROLL_ZONE - mouseY
            const speed = Math.min(SCROLL_SPEED, Math.max(2, Math.round(distance / 10)))
            scrollContainer.scrollTop -= speed
        }
        // 鼠标在容器下方（包括超出容器边界）
        else if (mouseY > rect.bottom - SCROLL_ZONE) {
            // 鼠标越靠下，滚动越快
            const distance = mouseY - (rect.bottom - SCROLL_ZONE)
            const speed = Math.min(SCROLL_SPEED, Math.max(2, Math.round(distance / 10)))
            scrollContainer.scrollTop += speed
        }
    }

    // 鼠标按下处理
    const handleMouseDown = (e, index, item) => {
        // 只响应左键
        if (e.button !== 0) return

        // 检查是否点击在可拖拽区域 (行的左侧或整行)
        const target = e.target
        if (target.tagName === 'BUTTON' || target.closest('button') ||
            target.tagName === 'A' || target.closest('a') ||
            target.tagName === 'INPUT' || target.closest('input')) {
            return
        }

        e.preventDefault()

        // 初始化拖拽状态
        dragState = {
            startX: e.clientX,
            startY: e.clientY,
            fromIndex: index,
            item: item,
            dropIndex: index,
            hasMoved: false
        }

        // 添加事件监听
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    // 鼠标移动处理
    const handleMouseMove = (e) => {
        if (!dragState) return

        // 检查是否达到拖拽阈值
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (!dragState.hasMoved && distance < 5) {
            return
        }

        if (!dragState.hasMoved) {
            // 首次开始拖拽
            dragState.hasMoved = true
            isDragging.value = true

            // 创建指示器
            const songName = dragState.item?.name || '歌曲'
            dragIndicator = createDragIndicator(songName)

            // 创建放置指示器 (添加到 body 使用 fixed 定位)
            dropIndicator = createDropIndicator()
            document.body.appendChild(dropIndicator)

            // 启动自动滚动
            scrollInterval = setInterval(() => {
                if (dragState?.lastEvent) {
                    autoScroll(dragState.lastEvent)
                    updateDropIndicator(dragState.lastEvent)
                }
            }, 50)

            if (onStart) onStart()
            window.app_event.dragStart()
        }

        dragState.lastEvent = e
        updateDragIndicator(e)
        updateDropIndicator(e)
    }

    // 鼠标释放处理
    const handleMouseUp = (e) => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        if (scrollInterval) {
            clearInterval(scrollInterval)
            scrollInterval = null
        }

        if (dragState?.hasMoved) {
            const fromIndex = dragState.fromIndex
            let toIndex = dragState.dropIndex

            // 调整目标索引
            if (toIndex > fromIndex) {
                toIndex = toIndex - 1
            }

            // 触发更新
            if (fromIndex !== toIndex && onUpdate) {
                onUpdate(fromIndex, toIndex)
            }

            if (onEnd) onEnd()
            window.app_event.dragEnd()
            clearDownKeys()
        }

        // 清理
        if (dragIndicator) {
            dragIndicator.remove()
            dragIndicator = null
        }
        if (dropIndicator) {
            dropIndicator.remove()
            dropIndicator = null
        }

        isDragging.value = false
        dragState = null
    }

    // 暴露给模板使用的方法
    const startDrag = (e, index) => {
        if (!list.value || index >= list.value.length) return
        handleMouseDown(e, index, list.value[index])
    }

    onBeforeUnmount(() => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        if (scrollInterval) {
            clearInterval(scrollInterval)
        }
        if (dragIndicator) {
            dragIndicator.remove()
        }
        if (dropIndicator) {
            dropIndicator.remove()
        }
    })

    return {
        isDragging,
        startDrag,
    }
}
