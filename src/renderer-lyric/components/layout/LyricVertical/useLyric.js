import { ref, onMounted, onBeforeUnmount, watch, nextTick } from '@common/utils/vueTools'
import { Spring } from '@common/utils/spring'
import { lyric } from '@lyric/store/lyric'
import { isPlay, setting } from '@lyric/store/state'
import { setWindowBounds, setWindowResizeable } from '@lyric/utils/ipc'
import { isWin } from '@common/utils'

const getOffsetTop = (contentWidth, lineWidth) => {
  switch (setting['desktopLyric.scrollAlign']) {
    case 'top': return contentWidth - lineWidth - 2
    default: return contentWidth * 0.5 - lineWidth / 2
  }
}

export default (isComputeWidth) => {
  const dom_lyric = ref(null)
  const dom_lyric_text = ref(null)
  const isMsDown = ref(false)
  let isStopScroll = false

  const winEvent = {
    isMsDown: false,
    msDownX: 0,
    msDownY: 0,
    windowW: 0,
    windowH: 0,
  }

  let msDownX = 0
  let msDownScrollX = 0
  let timeout = null
  let dom_lines
  let line_widths
  let isSetedLines = false
  let prevActiveLine = 0

  // AMLL Spring 物理滚动引擎（与播放详情页一致）：无锁、无排队、rAF 驱动
  const scrollSpring = new Spring(0)
  scrollSpring.updateParams({ mass: 1, damping: 22, stiffness: 90 })
  let animationFrameId = null
  let lastFrameTime = 0

  const applyScroll = () => {
    if (!dom_lyric.value) return
    dom_lyric.value.scrollLeft = scrollSpring.getCurrentPosition()
  }
  const onTick = (now) => {
    const delta = lastFrameTime ? (now - lastFrameTime) / 1000 : 16.7 / 1000
    lastFrameTime = now
    scrollSpring.update(delta)
    applyScroll()
    if (scrollSpring.arrived()) {
      animationFrameId = null
      lastFrameTime = 0
      return
    }
    animationFrameId = requestAnimationFrame(onTick)
  }
  const ensureRaf = () => {
    if (animationFrameId != null) return
    lastFrameTime = 0
    animationFrameId = requestAnimationFrame(onTick)
  }
  const cancelRaf = () => {
    if (animationFrameId != null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    lastFrameTime = 0
  }

  const getScrollTarget = () => {
    let dom_p = dom_lines?.[lyric.line]
    if (!dom_p) return 0
    let offset = 0
    if (isComputeWidth.value) {
      let prevLineWidth = line_widths[prevActiveLine] ?? 0
      offset = prevActiveLine < lyric.line ? ((dom_lines[prevActiveLine]?.clientWidth ?? 0) - prevLineWidth) : 0
    }
    return dom_p.offsetLeft + offset - getOffsetTop(dom_lyric.value.clientWidth, dom_p.clientWidth)
  }

  const handleScrollLrc = () => {
    if (!dom_lines?.length || !dom_lyric.value) return
    if (isStopScroll) return
    scrollSpring.setTargetPosition(getScrollTarget())
    ensureRaf()
  }
  const clearLyricScrollTimeout = () => {
    if (!timeout) return
    clearTimeout(timeout)
    timeout = null
  }
  const startLyricScrollTimeout = () => {
    clearLyricScrollTimeout()
    timeout = setTimeout(() => {
      timeout = null
      isStopScroll = false
      if (!isPlay.value) return
      handleScrollLrc()
    }, 3000)
  }

  const handleLyricDown = (target, x, y) => {
    if (target.classList.contains('font-lrc') ||
      target.parentNode.classList.contains('font-lrc') ||
      target.classList.contains('extended') ||
      target.parentNode.classList.contains('extended')
    ) {
      if (delayScrollTimeout) {
        clearTimeout(delayScrollTimeout)
        delayScrollTimeout = null
      }
      isMsDown.value = true
      msDownX = x
      msDownScrollX = scrollSpring.getCurrentPosition()
    } else {
      winEvent.isMsDown = true
      winEvent.msDownX = x
      winEvent.msDownY = y
      winEvent.windowW = window.innerWidth
      winEvent.windowH = window.innerHeight
      // https://github.com/lyswhut/lx-music-desktop/issues/2244
      if (isWin) setWindowResizeable(false)
    }
  }
  const handleLyricMouseDown = event => {
    handleLyricDown(event.target, event.clientX, event.clientY)
  }
  const handleLyricTouchStart = event => {
    if (event.changedTouches.length) {
      const touch = event.changedTouches[0]
      handleLyricDown(event.target, touch.clientX, touch.clientY)
    }
  }
  const handleMouseMsUp = () => {
    isMsDown.value = false
    winEvent.isMsDown = false
    if (isWin) setWindowResizeable(true)
  }

  const handleMove = (x, y) => {
    if (isMsDown.value) {
      isStopScroll ||= true
      scrollSpring.setPosition(msDownScrollX + msDownX - x)
      applyScroll()
      ensureRaf()
      startLyricScrollTimeout()
    } else if (winEvent.isMsDown) {
      // https://github.com/lyswhut/lx-music-desktop/issues/2244
      if (isWin) {
        setWindowBounds({
          x: x - winEvent.msDownX,
          y: y - winEvent.msDownY,
          w: winEvent.windowW,
          h: winEvent.windowH,
        })
      } else {
        setWindowBounds({
          x: x - winEvent.msDownX,
          y: y - winEvent.msDownY,
          w: window.innerWidth,
          h: window.innerHeight,
        })
      }
    }
  }
  const handleMouseMsMove = event => {
    handleMove(event.clientX, event.clientY)
  }
  const handleTouchMove = (e) => {
    if (e.changedTouches.length) {
      const touch = e.changedTouches[0]
      handleMove(touch.clientX, touch.clientY)
    }
  }

  const handleWheel = (event) => {
    isStopScroll = true
    scrollSpring.setPosition(scrollSpring.getCurrentPosition() - event.deltaY)
    applyScroll()
    ensureRaf()
    startLyricScrollTimeout()
  }

  const handleResize = () => {
    if (!dom_lyric.value || !dom_lines?.length) return

    window.requestAnimationFrame(() => {
      if (!dom_lyric.value) return
      // 动态字体缩放：当歌词行过长时自动缩小字体 (垂直模式测量高度)
      const ellipsis = setting['desktopLyric.style.ellipsis']
      const isZoomActiveLrc = setting['desktopLyric.style.isZoomActiveLrc']

      if (!ellipsis) {
        dom_lines.forEach(lineEl => {
          const lineDiv = lineEl.querySelector('.line')
          if (lineDiv) lineDiv.style.fontSize = ''
        })
      } else {
        const containerHeight = dom_lyric.value.clientHeight - 40 // 留出边距
        if (containerHeight > 0) {
          dom_lines.forEach(lineEl => {
            const lineDiv = lineEl.querySelector('.line')
            const fontLrc = lineEl.querySelector('.font-lrc')
            if (!lineDiv || !fontLrc) return

            // 重置字体大小以获取原始高度
            lineDiv.style.fontSize = ''

            // 临时设置 nowrap 以获取真实的文本高度
            const originalWhiteSpace = fontLrc.style.whiteSpace
            fontLrc.style.whiteSpace = 'nowrap'

            let textHeight = fontLrc.scrollHeight

            // 考虑放大效果 (垂直模式放大系数同样为 1.45)
            if (isZoomActiveLrc) textHeight *= 1.45

            // 恢复原始样式
            fontLrc.style.whiteSpace = originalWhiteSpace

            if (textHeight > containerHeight) {
              // 计算缩放比例，最小缩放到 60%
              const scale = Math.max(0.6, containerHeight / textHeight)
              lineDiv.style.fontSize = `${scale}em`
            }
          })
        }
      }
    })
  }

  const setLyric = (lines) => {
    const dom_line_content = document.createDocumentFragment()
    for (const line of lines) {
      dom_line_content.appendChild(line.dom_line)
    }
    dom_lyric_text.value.textContent = ''
    dom_lyric_text.value.appendChild(dom_line_content)
    nextTick(() => {
      dom_lines = dom_lyric.value.querySelectorAll('.line-content')
      line_widths = Array.from(dom_lines).map(l => l.clientWidth)

      handleResize()
      handleScrollLrc()
    })
  }

  const initLrc = (lines, oLines) => {
    prevActiveLine = 0
    isSetedLines = true
    if (oLines) {
      if (lines.length) {
        setLyric(lines)
      } else {
        // 先滚动回起点，再替换歌词内容
        scrollSpring.setTargetPosition(0)
        ensureRaf()
        setTimeout(() => {
          if (lyric.lines !== lines) return
          setLyric(lines)
        }, 350)
      }
    } else {
      setLyric(lines)
    }
  }

  let delayScrollTimeout
  const scrollLine = (line, oldLine) => {
    prevActiveLine = line
    if (line < 0) return
    if (line == 0 && isSetedLines) return isSetedLines = false
    isSetedLines &&= false

    // 判断是否为非连续跳转（通常是跳进度或第一行加载）
    const isJump = oldLine == null || Math.abs(line - oldLine) !== 1

    if (isJump) {
      // 跳切：直接更新弹簧目标，物理动画立即平滑跟随，无锁无排队
      return handleScrollLrc()
    }

    // 正常连续播放逻辑
    if (setting['desktopLyric.isDelayScroll']) {
      delayScrollTimeout = setTimeout(() => {
        delayScrollTimeout = null
        handleScrollLrc()
      }, 600)
    } else {
      handleScrollLrc()
    }
  }

  watch(() => lyric.lines, initLrc)
  watch(() => lyric.line, scrollLine)

  let resizeObserver = null
  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMsMove)
    document.addEventListener('mouseup', handleMouseMsUp)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleMouseMsUp)

    initLrc(lyric.lines, null)

    if (window.ResizeObserver && dom_lyric.value) {
      resizeObserver = new ResizeObserver(() => {
        handleResize()
      })
      resizeObserver.observe(dom_lyric.value)
    }
  })

  onBeforeUnmount(() => {
    cancelRaf()
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    document.removeEventListener('mousemove', handleMouseMsMove)
    document.removeEventListener('mouseup', handleMouseMsUp)
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleMouseMsUp)
  })

  return {
    dom_lyric,
    dom_lyric_text,
    isMsDown,
    handleLyricMouseDown,
    handleLyricTouchStart,
    handleWheel,
  }
}
