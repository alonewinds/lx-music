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
    scrollSpring.updateParams({ mass: 1, damping: 22, stiffness: 90 }) // 调整为更有"重量感"的参数

    let isUnmounted = false
    let animationFrameId = null

    // Store current scale/blur for smooth interpolation
    let currentScales = []
    let currentBlurs = []

    const applyEffects = () => {
        if (isUnmounted || !dom_lyric.value || !dom_lines?.length) return

        if (currentScales.length !== dom_lines.length) {
            currentScales = new Array(dom_lines.length).fill(1.0)
            currentBlurs = new Array(dom_lines.length).fill(0)
        }

        const currentScrollY = scrollSpring.getCurrentPosition()
        if (dom_lyric.value) dom_lyric.value.scrollTop = currentScrollY

        const containerHeight = dom_lyric.value?.clientHeight ?? 0
        if (containerHeight <= 0) return
        const centerLineY = currentScrollY + containerHeight * 0.38

        let closestLine = null
        let minDist = Infinity

        dom_lines.forEach((dom, index) => {
            const lineOffsetTop = dom.offsetTop
            const distance = Math.abs(lineOffsetTop - centerLineY)
            const maxDistance = containerHeight * 0.5

            if (distance < minDist) {
                minDist = distance
                closestLine = dom
            }

            // --- 电影级视觉计算 (Cinematic Visual Calculation) ---
            let isActive = index === lyric.line
            // Special handling for last line shrinking
            if (isActive && index === dom_lines.length - 1) {
                if (playProgress.maxPlayTime && (playProgress.nowPlayTime > playProgress.maxPlayTime - 1)) {
                    isActive = false
                }
            }
            const isZoomActiveLrc = appSetting['playDetail.isZoomActiveLrc']

            // 1. Scale Target
            // 激活行放大到 1.35 (更显著)，非激活行稍微缩小到 0.95 以制造景深差
            let targetScale = isActive && isZoomActiveLrc ? 1.35 : 0.95
            if (!isZoomActiveLrc) targetScale = 1.0

            // 2. Blur Target
            // 激活行无模糊，非激活行根据距离增加模糊 (最大 3px)
            let targetBlur = isActive ? 0 : Math.min(4, Math.pow(distance / (maxDistance * 0.6), 1.2) * 2.5)

            // linear interpolation for smoothness
            const lerpFactor = 0.1
            currentScales[index] = currentScales[index] + (targetScale - currentScales[index]) * lerpFactor
            currentBlurs[index] = currentBlurs[index] + (targetBlur - currentBlurs[index]) * lerpFactor

            const scale = currentScales[index]
            const blur = currentBlurs[index]

            // 3. Opacity
            // 激活行不透明(1)，非激活行快速变暗 (0.6 -> 0.2)
            let opacity = 1
            if (!isActive) {
                const distRatio = Math.min(1, distance / maxDistance)
                opacity = Math.max(0.15, 0.65 - distRatio * 0.5)
            }

            // 4. CSS Application
            dom.style.transform = `scale(${scale.toFixed(3)})`
            // 动态间距调整防止重叠 (Dynamic Spacing)
            if (isZoomActiveLrc && scale > 1) {
                const extraSpace = (scale - 1) * dom.clientHeight * 0.8
                dom.style.marginBottom = `${extraSpace + 10}px`
                dom.style.marginTop = `${extraSpace * 0.5}px`
            } else {
                dom.style.marginBottom = ''
                dom.style.marginTop = ''
            }

            dom.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none'
            dom.style.opacity = opacity.toFixed(2)

            // 激活行加重字重和发光
            dom.style.fontWeight = isActive ? '800' : '500' // 更粗的字体
            // dom.style.textShadow = isActive ? '0 0 16px rgba(255, 255, 255, 0.4)' : 'none' // 环境光晕

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
