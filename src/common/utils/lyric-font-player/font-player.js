import { getNow, TimeoutTools } from './utils'

// const fontFormateRxp = /(?=<\d+,\d+>).*?/g
const fontSplitRxp = /(?=<\d+,\d+>).*?/g
const timeRxpAll = /<(\d+),(\d+)>/g
const timeRxp = /<(\d+),(\d+)>/


// Create fill animation with all effects combined
const createAnimation = (dom, duration, isVertical, effectSettings) => {
  const floatEnabled = effectSettings?.floatEnabled ?? false
  const floatAmount = effectSettings?.floatAmount ?? 8
  const scaleEnabled = effectSettings?.scaleEnabled ?? false
  const scaleAmount = effectSettings?.scaleAmount ?? 1.15
  const scaleLongSyllableDuration = effectSettings?.scaleLongSyllableDuration ?? 700
  const glowEnabled = effectSettings?.glowAnimateEnabled ?? false
  const glowMode = effectSettings?.glowMode ?? 'soft'
  const glowColor1 = effectSettings?.glowColor1
  const glowColor2 = effectSettings?.glowColor2

  // Check if this is a long syllable that should have scale effect
  const isLongSyllable = scaleEnabled && duration >= scaleLongSyllableDuration

  // Build transform values
  const getTransform = (floatOffset, scaleValue) => {
    const parts = []
    if (floatEnabled && floatOffset !== 0) {
      parts.push(`translateY(${floatOffset}px)`)
    }
    if (isLongSyllable && scaleValue !== 1) {
      parts.push(`scale(${scaleValue})`)
    }
    return parts.length > 0 ? parts.join(' ') : undefined
  }

  // Build filter value for glow (brightness + drop-shadow)
  const getFilter = (brightness, glowIntensity = 0) => {
    if (!glowEnabled) return undefined
    const parts = []
    if (brightness !== 1) {
      parts.push(`brightness(${brightness})`)
    }
    if (glowIntensity > 0) {
      // Use user-defined colors if available, otherwise fallback to played color
      const color1 = glowColor1 || 'var(--lyric-played-color, white)'
      const color2 = glowColor2 || color1

      if (glowMode === 'gradient') {
        parts.push(`drop-shadow(0 0 ${glowIntensity}px ${color1})`)
        parts.push(`drop-shadow(0 0 ${glowIntensity * 2}px ${color2})`)
      } else {
        parts.push(`drop-shadow(0 0 ${glowIntensity}px ${color1})`)
      }
    }
    return parts.length > 0 ? parts.join(' ') : undefined
  }

  let keyframes
  if (isVertical) {
    keyframes = [
      { backgroundSize: '100% 0' },
      { backgroundSize: '100% 100%' },
    ]
  } else {
    // Horizontal mode with combined effects
    const startTransform = getTransform(-floatAmount, 1)
    const midTransform = getTransform(-floatAmount / 2, scaleAmount)
    const endTransform = getTransform(0, 1)

    const startFilter = getFilter(1, 0)
    const midFilter = getFilter(1.3, 8)  // Glow: brightness boost + 8px drop-shadow at midpoint
    const endFilter = getFilter(1, 0)

    // Create keyframes with all effects
    if (floatEnabled || isLongSyllable || glowEnabled) {
      keyframes = [
        {
          backgroundSize: '0 100%',
          ...(startTransform && { transform: startTransform }),
          ...(startFilter && { filter: startFilter }),
        },
        ...(isLongSyllable || glowEnabled ? [{
          backgroundSize: '50% 100%',
          offset: 0.5,
          ...(midTransform && { transform: midTransform }),
          ...(midFilter && { filter: midFilter }),
        }] : []),
        {
          backgroundSize: '100% 100%',
          ...(endTransform && { transform: endTransform }),
          ...(endFilter && { filter: endFilter }),
        },
      ]
    } else {
      keyframes = [
        { backgroundSize: '0 100%' },
        { backgroundSize: '100% 100%' },
      ]
    }
  }

  const hasEffects = floatEnabled || isLongSyllable || glowEnabled

  return new window.Animation(
    new window.KeyframeEffect(dom, keyframes, {
      duration,
      easing: hasEffects ? 'ease-out' : 'linear',
    }),
    document.timeline
  )
}


// https://jsfiddle.net/ceqpnbky/
// https://jsfiddle.net/ceqpnbky/1/

export default class FontPlayer {
  constructor({
    time = 0,
    rate = 1,
    lyric = '',
    lineContentClassName = 'line-content',
    lineClassName = 'line',
    shadowClassName = 'shadow',
    fontModeClassName = 'font-mode',
    lineModeClassName = 'line-mode',
    fontLrcClassName = 'font-lrc',
    extendedLrcClassName = 'extended',
    shadowContent = false,
    extendedLyrics = [],
    isVertical = false,
    effectSettings = null, // { floatEnabled, floatAmount, scaleEnabled, scaleAmount, scaleLongSyllableDuration, glowAnimateEnabled }
  }) {
    this.time = time
    this.lyric = lyric

    this._rate = rate

    this.isVertical = isVertical
    this.effectSettings = effectSettings

    this.lineContentClassName = lineContentClassName
    this.lineClassName = lineClassName

    this.shadowContent = shadowContent
    this.shadowClassName = shadowClassName

    this.extendedLyrics = extendedLyrics
    this.fontModeClassName = fontModeClassName
    this.fontLrcClassName = fontLrcClassName
    this.extendedLrcClassName = extendedLrcClassName
    this.lineModeClassName = lineModeClassName


    this.isPlay = false
    this.curFontNum = 0
    this.maxFontNum = 0
    this._performanceTime = 0
    this._startTime = 0

    this.lineContent = null

    this.timeoutTools = new TimeoutTools(50)
    this.waitPlayTimeout = new TimeoutTools(50)

    this._init()
  }

  _init() {
    if (this.lyric == null) this.lyric = ''

    this.isLineMode = false

    this.lineContent = document.createElement('div')
    this.lineContent.time = this.time
    this.lineContent.className = this.lineContentClassName

    this.line = document.createElement('div')
    this.line.style = 'position:relative;display:inline-block;'
    this.line.className = this.lineClassName
    this.lineContent.appendChild(this.line)

    this.lrcContent = document.createElement('div')
    this.lrcContent.className = this.fontLrcClassName
    // if (this.shadowContent) {
    //   this.lrcShadowContent = document.createElement('div')
    //   this.lrcShadowContent.style = 'position:absolute;top:0;left:0;width:100%;z-index:-1;'
    //   this.lrcShadowContent.className = this.shadowClassName
    //   this.line.appendChild(this.lrcShadowContent)
    // }
    this.line.appendChild(this.lrcContent)

    for (const lrc of this.extendedLyrics) {
      const extendedLrcContent = document.createElement('div')
      extendedLrcContent.style = 'position:relative;display:inline-block;'
      extendedLrcContent.className = this.extendedLrcClassName
      this.lineContent.appendChild(document.createElement('br'))
      this.lineContent.appendChild(extendedLrcContent)


      // if (this.shadowContent) {
      //   const extendedLrcShadowContent = document.createElement('div')
      //   extendedLrcShadowContent.style = 'position:absolute;top:0;left:0;width:100%;z-index:-1;'
      //   extendedLrcShadowContent.className = this.shadowClassName
      //   extendedLrcShadowContent.textContent = lrc
      //   extendedLrcContent.appendChild(extendedLrcShadowContent)
      // }

      const lineContent = document.createElement('div')
      lineContent.className = this.fontLrcClassName
      lineContent.textContent = lrc.replace(timeRxpAll, '')
      extendedLrcContent.appendChild(lineContent)
    }
    this._parseLyric()
  }

  _parseLyric() {
    const fonts = this.lyric.split(fontSplitRxp)
    // console.log(fonts)

    this.maxFontNum = fonts.length - 1
    this.fonts = []
    let text
    // let lineText = ''
    let lrcShadowContent
    for (const font of fonts) {
      if (!timeRxp.test(font)) return this._handleLineParse()
      text = font.replace(timeRxp, '')
      const time = parseInt(RegExp.$2)
      const animDuration = time / this._rate

      const dom = document.createElement('span')
      dom.textContent = text
      // Make span inline-block so transform works (transform doesn't work on inline elements)
      dom.style.display = 'inline-block'

      // Create animation with all effects combined (fill + float + scale + glow)
      const animation = createAnimation(dom, animDuration, this.isVertical, this.effectSettings)

      this.lrcContent.appendChild(dom)
      // lineText += text

      if (this.shadowContent) {
        lrcShadowContent ??= document.createElement('div')
        const shadowDom = document.createElement('span')
        shadowDom.textContent = text
        lrcShadowContent.appendChild(shadowDom)
      }
      // dom.style = shadowDom.style = this.fontStyle
      // dom.className = shadowDom.className = this.fontClassName

      this.fonts.push({
        text,
        startTime: parseInt(RegExp.$1),
        time,
        dom,
        animation,
      })
    }

    if (this.shadowContent && lrcShadowContent) {
      lrcShadowContent.style = 'position:absolute;top:0;left:0;right:0;z-index:-1;'
      lrcShadowContent.className = this.shadowClassName
      this.line.appendChild(lrcShadowContent)
    }

    this.line.appendChild(this.lrcContent)
    this.fonts.at(-1)?.animation.addEventListener('finish', () => {
      this.lineContent.classList.add('played')
      this.isPlay = false
    })
    this.lineContent.classList.add(this.fontModeClassName)
    // if (this.shadowContent) this.lrcShadowContent.textContent = lineText
    // console.log(this.fonts)
  }

  _handleLineParse() {
    this.isLineMode = true
    this.lineContent.classList.add(this.lineModeClassName)
    this.lrcContent.textContent = this.lyric

    // if (this.shadowContent) this.lrcShadowContent.textContent = this.lyric
    this.fonts.push({
      text: this.lyric,
    })
  }

  _currentTime() {
    return (getNow() - this._performanceTime) * this._rate + this._startTime
  }

  _findcurFontNum(curTime, startIndex = 0) {
    const length = this.fonts.length
    for (let index = startIndex; index < length; index++) if (curTime < this.fonts[index].startTime) return index == 0 ? 0 : index - 1
    return length - 1
  }

  _handlePlayMaxFontNum() {
    let curFont = this.fonts[this.curFontNum]
    // console.log(curFont.text)
    const currentTime = this._currentTime()
    const driftTime = currentTime - curFont.startTime
    if (currentTime > curFont.startTime + curFont.time) {
      this._handlePlayFont(curFont, driftTime / this._rate, true)
      this.lineContent.classList.add('played')
      this.isPlay = false
      this.pause()
    } else {
      this._handlePlayFont(curFont, driftTime)
    }
  }

  _handlePlayFont(font, currentTime, toFinishe) {
    switch (font.animation.playState) {
      case 'finished':
        break
      case 'idle':
        font.dom.style.backgroundSize = '100% 100%'
        if (!toFinishe) {
          font.animation.play()
        }
        break
      default:
        if (toFinishe) {
          font.animation.cancel()
        } else {
          font.animation.currentTime = currentTime
          font.animation.play()
        }
        break
    }
  }

  _handlePlayLine(isPlayed) {
    this.isPlay = false
    if (isPlayed) {
      this.lineContent.classList.add('played')
    } else {
      this.lineContent.classList.remove('played')
    }
    // this.fonts[0].dom.style.backgroundSize = isPlayed ? '100% 100%' : '100% 0'
  }

  _handlePauseFont(font) {
    if (font.animation.playState == 'running') font.animation.pause()
  }

  _refresh() {
    this.curFontNum++
    // console.log('curFontNum time', this.fonts[this.curFontNum].time)
    if (this.curFontNum >= this.maxFontNum) return this._handlePlayMaxFontNum()
    let curFont = this.fonts[this.curFontNum]
    // console.log(curFont, nextFont, this.curFontNum, this.maxFontNum)
    const currentTime = this._currentTime()
    // console.log(curFont.text)
    const driftTime = currentTime - curFont.startTime

    // console.log(currentTime, driftTime)

    if (driftTime >= 0 || this.curFontNum == 0) {
      let nextFont = this.fonts[this.curFontNum + 1]
      const delay = (nextFont.startTime - curFont.startTime - driftTime) / this._rate
      if (delay > 0) {
        if (this.isPlay) {
          this.timeoutTools.start(() => {
            if (!this.isPlay) return
            this._refresh()
          }, delay)
        }
        this._handlePlayFont(curFont, driftTime)
        return
      } else {
        let newCurLineNum = this._findcurFontNum(currentTime, this.curFontNum + 1)
        if (newCurLineNum > this.curFontNum) this.curFontNum = newCurLineNum - 1
        for (let i = 0; i <= this.curFontNum; i++) this._handlePlayFont(this.fonts[i], 0, true)
        this._refresh()
        return
      }
    } else if (this.curFontNum == 0) {
      this.curFontNum--
      if (this.isPlay) {
        this.waitPlayTimeout.start(() => {
          if (!this.isPlay) return
          this._refresh()
        }, -driftTime)
      }
      return
    }

    this.curFontNum = this._findcurFontNum(currentTime, this.curFontNum) - 1
    for (let i = 0; i <= this.curFontNum; i++) this._handlePlayFont(this.fonts[i], 0, true)
    // this.curFontNum--
    this._refresh()
  }

  play(curTime = 0) {
    // console.log('play', curTime)
    if (!this.fonts.length) return
    this.pause()

    if (this.isLineMode) return this._handlePlayLine(true)
    this.lineContent.classList.remove('played')
    this.isPlay = true
    this._performanceTime = getNow()
    this._startTime = curTime

    this.curFontNum = this._findcurFontNum(curTime)

    for (let i = this.curFontNum; i > -1; i--) {
      this._handlePlayFont(this.fonts[i], 0, true)
    }
    for (let i = this.curFontNum, len = this.fonts.length; i < len; i++) {
      let font = this.fonts[i]
      font.animation.cancel()
      font.dom.style.backgroundSize = '0 100%'
    }

    this.curFontNum--

    this._refresh()
  }

  pause() {
    if (!this.isPlay) return
    this.isPlay = false
    this.timeoutTools.clear()
    this.waitPlayTimeout.clear()
    this._handlePauseFont(this.fonts[this.curFontNum])
    if (this.curFontNum === this.maxLine) return
    const curFontNum = this._findcurFontNum(this._currentTime())
    if (this.curFontNum === curFontNum) return
    for (let i = 0; i < this.curFontNum; i++) this._handlePlayFont(this.fonts[i], 0, true)
  }

  finish() {
    this.pause()
    if (this.isLineMode) return this._handlePlayLine(true)
    this.lineContent.classList.add('played')

    for (const font of this.fonts) {
      font.animation.cancel()
      font.dom.style.backgroundSize = '100% 100%'
    }
    this.curFontNum = this.maxFontNum
  }

  setPlaybackRate(rate) {
    this._rate = rate
    if (!this.lines.length) return
    if (!this.isPlay) return
    this.play(this._currentTime())
  }

  reset() {
    this.pause()
    if (this.isLineMode) return this._handlePlayLine(false)
    this.lineContent.classList.remove('played')
    for (const font of this.fonts) {
      font.animation.cancel()
      font.dom.style.backgroundSize = '0 100%'
    }
    this.curFontNum = 0
  }
}

