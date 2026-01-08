import { ref, onMounted, onBeforeUnmount, watch, nextTick } from '@common/utils/vueTools'
import { throttle, formatPlayTime2 } from '@common/utils/common'
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

    let animationFrameId = null

    const applyEffects = () => {
        if (!dom_lyric.value || !dom_lines.length) return

        const currentScrollY = scrollSpring.getCurrentPosition()
        dom_lyric.value.scrollTop = currentScrollY

        const containerHeight = dom_lyric.value.clientHeight
        const centerLineY = currentScrollY + containerHeight * 0.38

        dom_lines.forEach((dom, index) => {
            const lineOffsetTop = dom.offsetTop
            const distance = Math.abs(lineOffsetTop - centerLineY)
            const maxDistance = containerHeight * 0.5 // 使用容器高度的一半作为参考

            // Scale effect (current line is slightly larger for emphasis)
            const isActive = index === lyric.line
            const scale = isActive ? 1.05 : 1.0

            // Blur and Opacity effects based on distance
            let blur = 0
            let opacity = 1

            if (!isActive) {
                // 非线性模糊算法：距离中心越远模糊程度增长越快
                // 使用 (distance / maxDistance)^1.5 来增强衰减感
                const factor = Math.min(1.2, Math.pow(distance / maxDistance, 1.5))
                blur = factor * 8 // 最大模糊增强到 8px
                opacity = Math.max(0.15, 1 - factor * 0.8)
            }

            dom.style.transform = `scale(${scale})`
            dom.style.filter = blur > 0.1 ? `blur(${blur}px)` : 'none'
            dom.style.opacity = opacity.toString()
            dom.style.fontWeight = isActive ? '700' : '500' // JS 强制加粗状态
            dom.style.willChange = 'transform, filter, opacity'
            // 移除 style.transition，因为我们每帧通过 Spring 动画更新，transition 会造成冲突延迟
        })
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
        window.app_event.setProgress(time)
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

    const setLyric = (lines) => {
        const dom_line_content = document.createDocumentFragment()
        lines.forEach(line => {
            dom_line_content.appendChild(line.dom_line)
        })
        dom_lyric_text.value.textContent = ''
        dom_lyric_text.value.appendChild(dom_line_content)
        nextTick(() => {
            dom_lines = dom_lyric.value.querySelectorAll('.line-content')
            handleScrollLrc()
        })
    }

    watch(() => lyric.lines, (lines) => {
        setLyric(lines)
    })

    watch(() => lyric.line, () => {
        handleScrollLrc()
    })

    const handleMouseMove = (e) => handleMove(e.clientY)
    const handleTouchMoveBound = (e) => {
        if (e.changedTouches.length) handleMove(e.changedTouches[0].clientY)
    }

    onMounted(() => {
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseMsUp)
        document.addEventListener('touchmove', handleTouchMoveBound)
        document.addEventListener('touchend', handleMouseMsUp)

        if (lyric.lines.length) setLyric(lyric.lines)
        animationFrameId = requestAnimationFrame(onTick)
    })

    onBeforeUnmount(() => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseMsUp)
        document.removeEventListener('touchmove', handleTouchMoveBound)
        document.removeEventListener('touchend', handleMouseMsUp)

        if (animationFrameId) cancelAnimationFrame(animationFrameId)
        if (timeout) clearTimeout(timeout)
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
