import Sortable from 'sortablejs/modular/sortable.core.esm'
import { ref, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { clearDownKeys } from '@renderer/event'

export default ({ listRef, onUpdate, onStart, onEnd }) => {
    let sortable = null
    const isDragging = ref(false)

    const initSortable = () => {
        if (!listRef.value || !listRef.value.dom_scrollContainer) return

        const scrollContainer = listRef.value.dom_scrollContainer
        const el = scrollContainer.children[0] // contentEl

        if (!el) return

        sortable = Sortable.create(el, {
            animation: 150,
            disabled: false,
            forceFallback: true,
            fallbackClass: 'sortable-fallback',
            fallbackTolerance: 3,
            fallbackOffset: { x: 0, y: 0 },
            draggable: '> div',
            ghostClass: 'music-list-dragging',

            onChoose(event) {
                isDragging.value = true
                if (onStart) onStart()
            },

            onUnchoose(event) {
                isDragging.value = false
                if (onEnd) onEnd()
                clearDownKeys()
            },

            onStart(event) {
                let offsetX = 0
                let offsetY = 0
                let initialized = false

                setTimeout(() => {
                    const fallback = document.querySelector('.sortable-fallback')
                    if (!fallback) return

                    // 设置样式
                    fallback.style.opacity = '1'
                    fallback.style.backgroundColor = 'var(--color-primary-background-hover)'
                    fallback.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)'
                    fallback.style.cursor = 'move'
                    fallback.style.zIndex = '9999'

                    // 鼠标移动处理
                    const handleMouseMove = (e) => {
                        if (!fallback) return

                        if (!initialized) {
                            // 第一次移动时，计算偏移
                            const rect = fallback.getBoundingClientRect()
                            offsetX = e.clientX - rect.left
                            offsetY = e.clientY - rect.top
                            initialized = true
                        }

                        // 保持偏移跟随鼠标
                        fallback.style.left = (e.clientX - offsetX) + 'px'
                        fallback.style.top = (e.clientY - offsetY) + 'px'
                    }

                    document.addEventListener('mousemove', handleMouseMove)

                    const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove)
                        document.removeEventListener('mouseup', handleMouseUp)
                    }
                    document.addEventListener('mouseup', handleMouseUp)
                }, 0)

                window.app_event.dragStart()
            },

            onEnd(event) {
                window.app_event.dragEnd()
            },

            onUpdate(event) {
                const fromIndex = event.oldIndex
                const toIndex = event.newIndex

                if (fromIndex !== toIndex && onUpdate) {
                    onUpdate(fromIndex, toIndex)
                }
            }
        })
    }

    onMounted(() => {
        setTimeout(() => {
            initSortable()
        }, 100)
    })

    onBeforeUnmount(() => {
        if (sortable) {
            try {
                sortable.destroy()
            } catch (e) {
                // ignore
            }
            sortable = null
        }
    })

    return {
        isDragging
    }
}
