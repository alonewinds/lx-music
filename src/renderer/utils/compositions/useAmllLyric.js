import { ref, onMounted, onBeforeUnmount, watch, nextTick } from '@common/utils/vueTools'
import { formatPlayTime2 } from '@common/utils/common'
import { play } from '@renderer/core/player/action'
import { appSetting } from '@renderer/store/setting'
import { Spring } from '@renderer/utils/amll/spring'

export default ({ isPlay, lyric, playProgress, isShowLyricProgressSetting }) => {
    const dom_lyric = ref(null)
    const dom_lyric_text = ref(null)
    const dom_skip_line = ref(null)
    const isMsDown = ref(false)
    const isStopScroll = ref(false)
    const timeStr = ref('--/--')

    let msDownY = 0
    let msDownScrollY = 0
    let timeout = null
    let dom_lines = []
    let isSkipMouseEnter = false
    let time = -1
    let dom_pre_line = null

    // AMLL Spring Animation
    const scrollSpring = new Spring(0)
    scrollSpring.updateParams({ mass: 1, damping: 20, stiffness: 100 })

    let isUnmounted = false
    let animationFrameId = null

    // Store current scale for each line for smooth interpolation
    let currentScales = []

    const applyEffects = () => {
        if (isUnmounted || !dom_lyric.value || !dom_lines?.length) return

        // Initialize scales array if size mismatch
        if (currentScales.length !== dom_lines.length) {
            currentScales = new Array(dom_lines.length).fill(1.0)
        }

        const currentScrollY = scrollSpring.getCurrentPosition()
        if (dom_lyric.value) dom_lyric.value.scrollTop = currentScrollY

        const containerHeight = dom_lyric.value?.clientHeight ?? 0
        if (containerHeight <= 0) return
        const centerLineY = currentScrollY + containerHeight * 0.38

        let minDistance = Infinity
        let closestLine = null

        dom_lines.forEach((dom, index) => {
            const lineOffsetTop = dom.offsetTop
            const distance = Math.abs(lineOffsetTop - centerLineY)
            const maxDistance = containerHeight * 0.5

            if (distance < minDistance) {
                minDistance = distance
                closestLine = dom
            }

            // Target Scale Calculation
            let isActive = index === lyric.line
            // Special handling for last line: shrink when song is nearly done (last 1s)
            if (isActive && index === dom_lines.length - 1) {
                if (playProgress.maxPlayTime && (playProgress.nowPlayTime > playProgress.maxPlayTime - 1)) {
                    isActive = false
                }
            }

            const isZoomActiveLrc = appSetting['playDetail.isZoomActiveLrc']
            const targetScale = (isActive && isZoomActiveLrc) ? 1.3 : 1.0

            // Smooth Interpolation (Lerp)
            // Use a factor like 0.1 for smooth transition
            const currentScale = currentScales[index]
            const newScale = currentScale + (targetScale - currentScale) * 0.1
            currentScales[index] = newScale

            // Blur and Opacity effects
            let blur = 0
            let opacity = 1

            if (!isActive) {
                const factor = Math.min(1.2, Math.pow(distance / maxDistance, 1.5))
                blur = factor * 8
                opacity = Math.max(0.15, 1 - factor * 0.8)
            }

            dom.style.transform = `scale(${newScale.toFixed(3)})`

            // 动态调整间距：弥补 scale 带来的视觉重叠
            // 默认 transform-origin 是中心(50% 50%)，放大 newScale 倍意味着上下各多出 (newScale-1)/2 的高度
            if (isZoomActiveLrc && newScale > 1) {
                const extraSpace = (newScale - 1) * dom.clientHeight * 0.6 // 恢复基础系数到 1.0，推得更明显
                dom.style.marginBottom = `${extraSpace + 7}px` // 额外增加 12px 的纯空隙，显著推开下一行
                dom.style.marginTop = `${extraSpace * 0.4}px`   // 上边距减小补偿比例(0.4)，重心偏下，防止顶到上一行
            } else {
                dom.style.marginBottom = ''
                dom.style.marginTop = ''
            }
            dom.style.filter = blur > 0.1 ? `blur(${blur}px)` : 'none'
            // dom.style.opacity = opacity.toString() // Conflict with font-player? font-player controls opacity inside line?
            // Wait, in previous code we set opacity on dom (line-content).
            dom.style.opacity = opacity.toString()

            dom.style.fontWeight = isActive ? '700' : '500'
            dom.style.willChange = 'transform, filter, opacity'
        })

        if (isStopScroll.value && closestLine) {
            time = closestLine.time + lyric.offset + lyric.tempOffset
            timeStr.value = formatPlayTime2(time / 1000)
        }
    }


    const onTick = (now) => {
        const delta = 16.7 / 1000 // Fixed delta for simplicity, or calculate from 'now'
        scrollSpring.update(delta)
        applyEffects()
        animationFrameId = requestAnimationFrame(onTick)
    }

    const handleScrollLrc = () => {
        if (!dom_lines?.length || !dom_lyric.value) return
        if (isSkipMouseEnter) return
        if (isStopScroll.value) return

        const dom_p = dom_lines[lyric.line]
        const targetY = dom_p ? (dom_p.offsetTop - dom_lyric.value.clientHeight * 0.38) : 0
        scrollSpring.setTargetPosition(targetY)
    }

    const handleSkipPlay = () => {
        if (time == -1) return
        isStopScroll.value = false
        window.app_event.setProgress(time / 1000)
        if (!isPlay.value) play()
    }

    const handleSkipMouseEnter = () => {
        isSkipMouseEnter = true
        if (timeout) {
            clearTimeout(timeout)
            timeout = null
        }
    }

    const handleSkipMouseLeave = () => {
        isSkipMouseEnter = false
        startLyricScrollTimeout()
    }

    const startLyricScrollTimeout = () => {
        if (timeout) clearTimeout(timeout)
        if (isSkipMouseEnter) return
        timeout = setTimeout(() => {
            timeout = null
            isStopScroll.value = false
            if (!isPlay.value) return
            handleScrollLrc()
        }, 3000)
    }

    const handleLyricDown = (y) => {
        isMsDown.value = true
        msDownY = y
        msDownScrollY = scrollSpring.getCurrentPosition()
    }

    const handleLyricMouseDown = event => handleLyricDown(event.clientY)
    const handleLyricTouchStart = event => {
        if (event.changedTouches.length) handleLyricDown(event.changedTouches[0].clientY)
    }

    const handleMouseMsUp = () => {
        isMsDown.value = false
    }

    const handleMove = (y) => {
        if (isMsDown.value) {
            isStopScroll.value = true
            const deltaY = msDownY - y
            scrollSpring.setPosition(msDownScrollY + deltaY)
            startLyricScrollTimeout()
        }
    }

    const handleWheel = (event) => {
        isStopScroll.value = true
        const currentPos = scrollSpring.getCurrentPosition()
        scrollSpring.setPosition(currentPos + event.deltaY)
        startLyricScrollTimeout()
    }

    const handleResize = () => {
        if (isUnmounted || !dom_lyric.value || !dom_lines?.length) return

        window.requestAnimationFrame(() => {
            if (isUnmounted || !dom_lyric.value) return
            const ellipsis = appSetting['desktopLyric.style.ellipsis']
            const isZoomActiveLrc = appSetting['playDetail.isZoomActiveLrc']

            if (!ellipsis) {
                dom_lines.forEach(lineEl => {
                    const lineDiv = lineEl.querySelector('.line')
                    if (lineDiv) lineDiv.style.fontSize = ''
                })
            } else {
                const containerWidth = dom_lyric.value.clientWidth - 40
                if (containerWidth > 0) {
                    dom_lines.forEach(lineEl => {
                        const lineDiv = lineEl.querySelector('.line')
                        const fontLrc = lineEl.querySelector('.font-lrc')
                        if (!lineDiv || !fontLrc) return
                        lineDiv.style.fontSize = ''
                        const originalWhiteSpace = fontLrc.style.whiteSpace
                        fontLrc.style.whiteSpace = 'nowrap'
                        let textWidth = fontLrc.scrollWidth
                        if (isZoomActiveLrc) textWidth *= 1.3
                        fontLrc.style.whiteSpace = originalWhiteSpace
                        if (textWidth > containerWidth) {
                            const scale = Math.max(0.6, containerWidth / textWidth)
                            lineDiv.style.fontSize = `${scale}em`
                        }
                    })
                }
            }
        })
    }

    const setLyric = (lines) => {
        if (isUnmounted || !dom_lyric_text.value) return
        const dom_line_content = document.createDocumentFragment()
        lines.forEach(line => {
            if (line.dom_line) dom_line_content.appendChild(line.dom_line)
        })
        dom_lyric_text.value.textContent = ''
        dom_lyric_text.value.appendChild(dom_line_content)
        nextTick(() => {
            if (isUnmounted || !dom_lyric.value) return
            dom_lines = dom_lyric.value.querySelectorAll('.line-content')
            handleResize()
            handleScrollLrc()
        })
    }

    watch(() => lyric.lines, (lines) => {
        if (isUnmounted) return
        setLyric(lines)
    })

    watch(() => lyric.line, () => {
        if (isUnmounted) return
        handleScrollLrc()
    })

    const handleMouseMove = (e) => handleMove(e.clientY)
    const handleTouchMoveBound = (e) => {
        if (e.changedTouches.length) handleMove(e.changedTouches[0].clientY)
    }

    let resizeObserver = null

    onMounted(() => {
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseMsUp)
        document.addEventListener('touchmove', handleTouchMoveBound)
        document.addEventListener('touchend', handleMouseMsUp)

        if (lyric.lines.length) setLyric(lyric.lines)
        animationFrameId = requestAnimationFrame(onTick)

        if (window.ResizeObserver && dom_lyric.value) {
            resizeObserver = new ResizeObserver(() => {
                handleResize()
            })
            resizeObserver.observe(dom_lyric.value)
        }
    })

    onBeforeUnmount(() => {
        isUnmounted = true
        if (resizeObserver) {
            resizeObserver.disconnect()
            resizeObserver = null
        }
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseMsUp)
        document.removeEventListener('touchmove', handleTouchMoveBound)
        document.removeEventListener('touchend', handleMouseMsUp)

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId)
            animationFrameId = null
        }
        if (timeout) {
            clearTimeout(timeout)
            timeout = null
        }
    })


    return {
        dom_lyric,
        dom_lyric_text,
        dom_skip_line,
        isStopScroll,
        isMsDown,
        timeStr,
        handleLyricMouseDown,
        handleLyricTouchStart,
        handleWheel,
        handleSkipPlay,
        handleSkipMouseEnter,
        handleSkipMouseLeave,
        handleScrollLrc,
    }
}
