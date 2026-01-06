<template lang="pug">
teleport(to="#root")
  div(
    v-if="visible"
    :class="$style.overlay"
  )
    div(:class="$style.modal")
      //- 标题栏
      div(:class="$style.header")
        h3(:class="$style.title") {{ $t('lyric_editor__title') }}
        //- 模式切换按钮
        div(:class="$style.modeSwitch")
          button(
            :class="[$style.modeBtn, { [$style.active]: editMode === 'line' }]"
            @click="switchMode('line')"
          ) {{ $t('lyric_editor__mode_line') }}
          button(
            :class="[$style.modeBtn, { [$style.active]: editMode === 'word' }]"
            @click="switchMode('word')"
            :disabled="linesData.length === 0"
          ) {{ $t('lyric_editor__mode_word') }}
        button(:class="$style.closeBtn" @click="handleCancel")
          svg(version="1.1" xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 24 24")
            use(xlink:href="#icon-close")

      //- 主内容区
      div(:class="$style.body")
        //- 左侧：歌词输入区
        div(:class="$style.inputSection")
          div(:class="$style.sectionHeader")
            span {{ $t('lyric_editor__input_label') }}
            span(:class="$style.lineCount") ({{ linesData.length }} {{ $t('lyric_editor__lines') }})
            button(
              :class="[$style.toggleViewBtn, { [$style.active]: showTimestampView }]"
              :title="showTimestampView ? $t('lyric_editor__show_plain') : $t('lyric_editor__show_timestamp')"
              @click="toggleTimestampView"
            ) {{ showTimestampView ? $t('lyric_editor__view_timestamp') : $t('lyric_editor__view_plain') }}
          //- 纯文本编辑模式
          textarea(
            v-if="!showTimestampView"
            ref="textareaRef"
            v-model="rawText"
            :class="$style.textarea"
            :placeholder="$t('lyric_editor__input_placeholder')"
            @input="handleTextInput"
          )
          //- 带时间轴显示模式（只读）
          textarea(
            v-else
            ref="textareaRef"
            :value="formattedLyricText"
            :class="[$style.textarea, $style.readonlyTextarea]"
            readonly
          )

        //- 右侧：打轴区
        div(:class="$style.stampSection")
          div(:class="$style.sectionHeader")
            span {{ $t('lyric_editor__stamp_label') }}
            span(:class="$style.progress" v-if="editMode === 'line'") {{ lineTimestampedCount }}/{{ linesData.length }}
            span(:class="$style.progress" v-else) {{ wordProgressText }}

          //- 当前播放时间和进度条
          div(:class="$style.timeDisplay")
            span(:class="$style.timeLabel") {{ $t('lyric_editor__current_time') }}:
            span(:class="$style.timeValue") {{ currentTimeDisplay }}
            span(:class="$style.timeDuration") / {{ durationDisplay }}
          
          //- 播放控制区（播放按钮 + 进度条）
          div(:class="$style.playbackSection")
            base-btn(
              :class="$style.playBtn"
              @click="togglePlay"
            )
              svg(version="1.1" xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 1024 1024")
                use(:xlink:href="isPlaying ? '#icon-pause' : '#icon-play'")

            input(
              type="range"
              :class="$style.progressBar"
              min="0"
              :max="duration"
              :value="currentTime"
              @input="handleSeek"
              @mousedown="handleSeekStart"
              @mouseup="handleSeekEnd"
            )

          //- 逐行模式：歌词行列表
          div(v-if="editMode === 'line'" ref="linesContainerRef" :class="$style.linesContainer")
            div(
              v-for="(line, index) in linesData"
              :key="index"
              :data-index="index"
              :class="[$style.lineItem, { [$style.active]: index === currentLineIndex, [$style.stamped]: line.lineTime >= 0, [$style.hasWordTime]: line.isWordMode }]"
              @click="handleLineClick(index)"
              @dblclick="handleLineDoubleClick(index)"
            )
              span(:class="$style.lineTime") {{ line.lineTime >= 0 ? formatTimeDisplay(line.lineTime) : '--:--.--' }}
              span(:class="$style.lineText") {{ line.text }}
              span(v-if="line.isWordMode" :class="$style.wordBadge") {{ $t('lyric_editor__word_mode_badge') }}

          //- 逐字模式：字符列表
          div(v-else :class="$style.wordModeContainer")
            //- 当前行信息
            div(:class="$style.wordLineInfo")
              span(:class="$style.wordLineLabel") {{ $t('lyric_editor__current_line') }}:
              span(:class="$style.wordLineText") {{ currentLineText }}
              base-btn(
                v-if="linesData.length > 0"
                :class="$style.changeLineBtn"
                @click="showLineSelector = !showLineSelector"
              ) {{ $t('lyric_editor__change_line') }}

            //- 行选择器
            div(v-if="showLineSelector" :class="$style.lineSelector")
              div(
                v-for="(line, index) in linesData"
                :key="index"
                :class="[$style.lineSelectorItem, { [$style.active]: index === currentLineIndex }]"
                @click="selectLine(index)"
              )
                span(:class="$style.lineSelectorTime") {{ line.lineTime >= 0 ? formatTimeDisplay(line.lineTime) : '--:--.--' }}
                span(:class="$style.lineSelectorText") {{ line.text }}

            //- 字符打轴区
            div(ref="wordsContainerRef" :class="$style.wordsContainer")
              span(
                v-for="(word, index) in currentWords"
                :key="index"
                :data-word-index="index"
                :class="[$style.wordItem, { [$style.active]: index === currentWordIndex, [$style.stamped]: word.offset >= 0 }]"
                @click="handleWordClick(index)"
              )
                span(:class="$style.wordChar") {{ word.char }}
                span(:class="$style.wordTime" v-if="word.offset >= 0") {{ formatWordTime(word) }}

          //- 操作按钮
          div(:class="$style.controls")
            base-btn(
              :class="[$style.controlBtn, $style.stampBtn]"
              :disabled="!canStamp"
              @click="handleStamp"
            ) {{ editMode === 'line' ? $t('lyric_editor__mark_time') : $t('lyric_editor__mark_word_time') }}

            base-btn(
              :class="$style.controlBtn"
              :disabled="!canUndo"
              :title="$t('lyric_editor__undo_tip')"
              @click="handleUndo"
              @mousedown="handleUndoMouseDown"
              @mouseup="handleUndoMouseUp"
              @mouseleave="handleUndoMouseUp"
            ) {{ $t('lyric_editor__undo') }}

            base-btn(
              :class="$style.controlBtn"
              @click="handleCopy"
            ) {{ $t('lyric_editor__copy') }}

      //- 底部操作栏
      div(:class="$style.footer")
        base-btn(:class="$style.footerBtn" @click="handleCancel") {{ $t('btn_cancel') }}
        base-btn(
          :class="$style.footerBtn"
          color="primary"
          :disabled="linesData.length === 0"
          @click="handleSave"
        ) {{ $t('btn_save') }}
</template>

<script>
import { ref, computed, watch, onBeforeUnmount, nextTick } from '@common/utils/vueTools'
import { getCurrentTime as getPlayerCurrentTime, getDuration as getPlayerDuration, setCurrentTime, setPause, setPlay } from '@renderer/plugins/player'
import { isPlay } from '@renderer/store/player/state'
import {
  splitLyricText,
  formatTimeDisplay,
  formatTimeTag,
  buildLxlrcFromLines,
  createLineData,
  getWordTimestampedCount,
  smartParseLyric,
  isLxlrcFormat,
  isPerCharTimestampFormat,
  isLrcFormat,
} from '@renderer/utils/lyricEditor'

export default {
  name: 'LyricEditorModal',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: Object,
      default: null,
    },
    existingLyric: {
      type: String,
      default: '',
    },
  },
  emits: ['close', 'save'],
  setup(props, { emit }) {
    const textareaRef = ref(null)
    const linesContainerRef = ref(null)
    const wordsContainerRef = ref(null)
    const rawText = ref('')
    const linesData = ref([])
    const currentLineIndex = ref(0)
    const currentWordIndex = ref(0)
    const currentTime = ref(0)
    const editMode = ref('line') // 'line' | 'word'
    const showLineSelector = ref(false)
    const showTimestampView = ref(false) // 是否显示带时间轴的歌词格式
    let animationFrameId = null
    let lastWordStampTime = -1 // 记录上一个字的打轴时间

    const isPlaying = computed(() => isPlay.value)
    const duration = ref(0)
    const currentTimeDisplay = computed(() => formatTimeDisplay(currentTime.value))
    const durationDisplay = computed(() => formatTimeDisplay(duration.value))
    const isSeeking = ref(false)

    // 逐行模式进度
    const lineTimestampedCount = computed(() => {
      return linesData.value.filter(line => line.lineTime >= 0).length
    })

    // 逐字模式进度
    const currentWords = computed(() => {
      if (linesData.value.length === 0 || currentLineIndex.value >= linesData.value.length) {
        return []
      }
      return linesData.value[currentLineIndex.value].words
    })

    const currentLineText = computed(() => {
      if (linesData.value.length === 0 || currentLineIndex.value >= linesData.value.length) {
        return ''
      }
      return linesData.value[currentLineIndex.value].text
    })

    const wordProgressText = computed(() => {
      if (currentWords.value.length === 0) return '0/0'
      const stamped = getWordTimestampedCount(currentWords.value)
      return `${stamped}/${currentWords.value.length}`
    })

    // 是否可以打轴
    const canStamp = computed(() => {
      if (linesData.value.length === 0) return false
      if (editMode.value === 'line') {
        return currentLineIndex.value < linesData.value.length
      } else {
        return currentWords.value.length > 0 && currentWordIndex.value < currentWords.value.length
      }
    })

    // 是否可以撤销
    const canUndo = computed(() => {
      if (editMode.value === 'line') {
        return linesData.value.some(line => line.lineTime >= 0)
      } else {
        return currentWords.value.some(word => word.offset >= 0)
      }
    })

    // 格式化歌词文本（带时间轴）
    const formattedLyricText = computed(() => {
      if (linesData.value.length === 0) return ''
      
      if (editMode.value === 'line') {
        // 逐行模式：生成普通 LRC 格式
        return linesData.value.map(line => {
          if (line.lineTime >= 0) {
            return `${formatTimeTag(line.lineTime)}${line.text}`
          }
          return line.text
        }).join('\n')
      } else {
        // 逐字模式：生成每字时间戳格式
        return linesData.value.map(line => {
          if (line.lineTime >= 0 && line.isWordMode && line.words.some(w => w.offset >= 0)) {
            // 有逐字时间，生成每字时间戳格式
            return line.words.map(w => {
              if (w.offset >= 0) {
                const wordTime = line.lineTime + w.offset
                return `${formatTimeTag(wordTime)}${w.char}`
              }
              return w.char
            }).join('')
          } else if (line.lineTime >= 0) {
            // 只有行时间
            return `${formatTimeTag(line.lineTime)}${line.text}`
          }
          return line.text
        }).join('\n')
      }
    })

    // 切换时间轴显示
    const toggleTimestampView = () => {
      showTimestampView.value = !showTimestampView.value
    }

    // 更新当前播放时间
    const updateCurrentTime = () => {
      if (!isSeeking.value) {
        currentTime.value = getPlayerCurrentTime() * 1000
      }
      duration.value = getPlayerDuration() * 1000
      animationFrameId = requestAnimationFrame(updateCurrentTime)
    }

    // 进度条拖拽控制
    const handleSeek = (e) => {
      const newTime = parseFloat(e.target.value)
      currentTime.value = newTime
      setCurrentTime(newTime / 1000)
    }

    const handleSeekStart = () => {
      isSeeking.value = true
    }

    const handleSeekEnd = () => {
      isSeeking.value = false
    }

    // 处理文本输入
    const handleTextInput = () => {
      const inputText = rawText.value
      
      // 检查输入是否包含时间信息（lxlrc、每字时间戳或普通 LRC 格式）
      const hasTimestampInfo = isLxlrcFormat(inputText) || isPerCharTimestampFormat(inputText) || isLrcFormat(inputText)
      
      if (hasTimestampInfo) {
        // 输入包含时间信息，使用智能解析保留时间戳
        linesData.value = smartParseLyric(inputText)
        // 更新 rawText 为纯文本（去除时间标签后的文本）
        rawText.value = linesData.value.map(l => l.text).join('\n')
        
        // 找到第一个未完成逐字打轴的行（或第一个未打轴的行）
        const firstIncomplete = linesData.value.findIndex(l => {
          if (l.lineTime < 0) return true
          if (l.isWordMode) {
            return l.words.some(w => w.offset < 0 || w.duration < 0)
          }
          return false
        })
        currentLineIndex.value = firstIncomplete >= 0 ? firstIncomplete : linesData.value.length
        
        return
      }
      
      // 普通文本输入，按原逻辑处理
      const newLines = splitLyricText(inputText)
      const oldLinesData = linesData.value
      
      if (newLines.length === oldLinesData.length) {
        // 行数未变，尝试保留时间戳
        linesData.value = newLines.map((text, i) => {
          const oldLine = oldLinesData[i]
          if (text === oldLine.text) {
            return oldLine
          }
          // 文本变化，创建新的 LineData 但保留行时间
          return createLineData(text, oldLine.lineTime)
        })
      } else {
        // 行数变化
        linesData.value = newLines.map((text, i) => {
          if (i < oldLinesData.length) {
            return createLineData(text, oldLinesData[i].lineTime)
          }
          return createLineData(text)
        })
      }
      
      // 修正当前行索引
      if (currentLineIndex.value >= linesData.value.length) {
        currentLineIndex.value = Math.max(0, linesData.value.length - 1)
      }
    }

    // 播放/暂停切换
    const togglePlay = () => {
      if (isPlaying.value) {
        setPause()
      } else {
        setPlay()
      }
    }

    // 模式切换
    const switchMode = (mode) => {
      if (mode === editMode.value) return
      editMode.value = mode
      showLineSelector.value = false
      
      if (mode === 'word') {
        currentWordIndex.value = 0
        lastWordStampTime = -1
        // 如果当前行已有逐字时间，找到第一个未打轴的字
        if (currentWords.value.length > 0) {
          const firstUnstamped = currentWords.value.findIndex(w => w.offset < 0)
          currentWordIndex.value = firstUnstamped >= 0 ? firstUnstamped : currentWords.value.length
        }
      }
    }

    // 逐行模式：打轴
    const handleLineStamp = () => {
      if (currentLineIndex.value >= linesData.value.length) return

      const time = getPlayerCurrentTime() * 1000
      linesData.value[currentLineIndex.value].lineTime = time

      // 移动到下一行
      if (currentLineIndex.value < linesData.value.length - 1) {
        currentLineIndex.value++
        scrollToCurrentLine()
      }
    }

    // 逐字模式：打轴
    const handleWordStamp = () => {
      if (currentWordIndex.value >= currentWords.value.length) return

      const time = getPlayerCurrentTime() * 1000
      const currentLine = linesData.value[currentLineIndex.value]
      
      // 如果行时间还没设置，使用当前时间作为行时间
      if (currentLine.lineTime < 0) {
        currentLine.lineTime = time
        
        // 如果是这一行的第一个字，且上一行存在，更新上一行最后一个字的 duration
        if (currentWordIndex.value === 0 && currentLineIndex.value > 0) {
          const prevLine = linesData.value[currentLineIndex.value - 1]
          if (prevLine.isWordMode && prevLine.words.length > 0) {
            const lastWord = prevLine.words[prevLine.words.length - 1]
            // 如果上一行最后一个字的 duration 是默认值(500)，用真实时间重新计算
            if (lastWord.offset >= 0 && lastWord.duration === 500) {
              const realDuration = time - prevLine.lineTime - lastWord.offset
              if (realDuration > 0) {
                lastWord.duration = Math.round(realDuration)
              }
            }
          }
        }
      }

      const actualLineTime = currentLine.lineTime
      const offset = Math.max(0, Math.round(time - actualLineTime))

      // 设置当前字的 offset
      const word = currentWords.value[currentWordIndex.value]
      word.offset = offset

      // 计算上一个字的 duration
      if (currentWordIndex.value > 0) {
        const prevWord = currentWords.value[currentWordIndex.value - 1]
        if (prevWord.offset >= 0 && prevWord.duration < 0) {
          prevWord.duration = Math.max(0, offset - prevWord.offset)
        }
      }

      // 标记为逐字模式
      currentLine.isWordMode = true
      lastWordStampTime = time

      // 移动到下一个字
      if (currentWordIndex.value < currentWords.value.length - 1) {
        currentWordIndex.value++
        scrollToCurrentWord()
      } else {
        // 最后一个字，设置一个默认的 duration（后面跳转下一行时可能会被真实时间覆盖）
        if (word.duration < 0) {
          word.duration = 500 // 默认 500ms
        }
        
        // 自动跳转到下一行
        if (currentLineIndex.value < linesData.value.length - 1) {
          const prevLineLastWord = word
          const prevLineTime = actualLineTime
          
          currentLineIndex.value++
          currentWordIndex.value = 0
          lastWordStampTime = -1
          scrollToCurrentLine()
          
          // 注意：下一次打轴时会为新行设置行时间
        }
      }
    }

    // 统一的打轴处理
    const handleStamp = () => {
      if (editMode.value === 'line') {
        handleLineStamp()
      } else {
        handleWordStamp()
      }
    }

    // 逐行模式：撤销
    const handleLineUndo = () => {
      let lastStampedIndex = -1
      for (let i = linesData.value.length - 1; i >= 0; i--) {
        if (linesData.value[i].lineTime >= 0) {
          lastStampedIndex = i
          break
        }
      }

      if (lastStampedIndex >= 0) {
        linesData.value[lastStampedIndex].lineTime = -1
        currentLineIndex.value = lastStampedIndex
        scrollToCurrentLine()
      }
    }

    // 逐字模式：撤销
    const handleWordUndo = () => {
      let lastStampedIndex = -1
      for (let i = currentWords.value.length - 1; i >= 0; i--) {
        if (currentWords.value[i].offset >= 0) {
          lastStampedIndex = i
          break
        }
      }

      if (lastStampedIndex >= 0) {
        const word = currentWords.value[lastStampedIndex]
        word.offset = -1
        word.duration = -1
        currentWordIndex.value = lastStampedIndex
        scrollToCurrentWord()
      }
    }

    // 统一的撤销处理
    const handleUndo = () => {
      if (editMode.value === 'line') {
        handleLineUndo()
      } else {
        handleWordUndo()
      }
    }

    // 长按撤销按钮相关
    let undoLongPressTimer = null
    const LONG_PRESS_DURATION = 1000 // 长按 1 秒触发

    const handleUndoMouseDown = () => {
      undoLongPressTimer = setTimeout(() => {
        // 长按触发：一键清除所有时间轴
        handleClearAllTimestamps()
      }, LONG_PRESS_DURATION)
    }

    const handleUndoMouseUp = () => {
      if (undoLongPressTimer) {
        clearTimeout(undoLongPressTimer)
        undoLongPressTimer = null
      }
    }

    // 一键清除所有时间轴
    const handleClearAllTimestamps = () => {
      if (editMode.value === 'line') {
        // 逐行模式：清除所有行的时间
        linesData.value.forEach(line => {
          line.lineTime = -1
          line.isWordMode = false
          line.words.forEach(word => {
            word.offset = -1
            word.duration = -1
          })
        })
        currentLineIndex.value = 0
        scrollToCurrentLine()
      } else {
        // 逐字模式：清除当前行的所有逐字时间
        if (currentWords.value.length > 0) {
          currentWords.value.forEach(word => {
            word.offset = -1
            word.duration = -1
          })
          linesData.value[currentLineIndex.value].isWordMode = false
          currentWordIndex.value = 0
          scrollToCurrentWord()
        }
      }
    }

    // 点击行选择
    const handleLineClick = (index) => {
      currentLineIndex.value = index
    }

    // 双击行进入逐字编辑
    const handleLineDoubleClick = (index) => {
      currentLineIndex.value = index
      switchMode('word')
    }

    // 点击字选择
    const handleWordClick = (index) => {
      currentWordIndex.value = index
    }

    // 选择行（逐字模式）
    const selectLine = (index) => {
      currentLineIndex.value = index
      currentWordIndex.value = 0
      showLineSelector.value = false
      lastWordStampTime = -1
      
      // 找到第一个未打轴的字
      const firstUnstamped = currentWords.value.findIndex(w => w.offset < 0)
      currentWordIndex.value = firstUnstamped >= 0 ? firstUnstamped : currentWords.value.length
    }

    // 滚动到当前行
    const scrollToCurrentLine = () => {
      void nextTick(() => {
        const container = linesContainerRef.value
        if (!container) return

        const currentElement = container.querySelector(`[data-index="${currentLineIndex.value}"]`)
        if (currentElement) {
          currentElement.scrollIntoView({ behavior: 'auto', block: 'center' })
        }
      })
    }

    // 滚动到当前字
    const scrollToCurrentWord = () => {
      void nextTick(() => {
        const container = wordsContainerRef.value
        if (!container) return

        const currentElement = container.querySelector(`[data-word-index="${currentWordIndex.value}"]`)
        if (currentElement) {
          currentElement.scrollIntoView({ behavior: 'auto', block: 'center' })
        }
      })
    }

    // 格式化字的时间显示
    const formatWordTime = (word) => {
      if (word.offset < 0) return ''
      const offsetSec = (word.offset / 1000).toFixed(2)
      const durationSec = word.duration >= 0 ? (word.duration / 1000).toFixed(2) : '?'
      return `${offsetSec}s/${durationSec}s`
    }

    // 保存歌词
    const handleSave = () => {
      const lxlrc = buildLxlrcFromLines(linesData.value)
      emit('save', { lyric: lxlrc })
    }

    // 取消
    const handleCancel = () => {
      emit('close')
    }

    // 复制歌词
    const handleCopy = async () => {
      // 根据当前显示模式复制相应格式
      const textToCopy = showTimestampView.value 
        ? formattedLyricText.value  // 带时间轴格式
        : rawText.value             // 纯文本格式
      try {
        await navigator.clipboard.writeText(textToCopy)
      } catch (err) {
        console.error('Failed to copy lyric:', err)
      }
    }

    // 键盘快捷键
    const handleKeydown = (e) => {
      if (!props.visible) return

      if (e.code === 'Space' && !e.target.matches('textarea, input')) {
        e.preventDefault()
        e.stopPropagation()
        e.lx_handled = true
        handleStamp()
      }
    }

    // 初始化
    watch(() => props.visible, (val) => {
      if (val) {
        // 加载现有歌词
        if (props.existingLyric) {
          // 使用智能解析函数自动识别格式（支持 lxlrc、每字时间戳、普通 LRC）
          linesData.value = smartParseLyric(props.existingLyric)
          // 重建 rawText
          rawText.value = linesData.value.map(l => l.text).join('\n')
          
          // 找到第一个未打轴的行
          const firstUnstamped = linesData.value.findIndex(l => l.lineTime < 0)
          currentLineIndex.value = firstUnstamped >= 0 ? firstUnstamped : linesData.value.length
        } else {
          rawText.value = ''
          linesData.value = []
          currentLineIndex.value = 0
        }

        editMode.value = 'line'
        currentWordIndex.value = 0
        showLineSelector.value = false
        lastWordStampTime = -1

        // 开始监听播放时间
        animationFrameId = requestAnimationFrame(updateCurrentTime)

        // 添加键盘事件
        window.addEventListener('keydown', handleKeydown, true)
      } else {
        // 停止监听
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
        window.removeEventListener('keydown', handleKeydown, true)
      }
    })

    onBeforeUnmount(() => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      window.removeEventListener('keydown', handleKeydown, true)
    })

    return {
      textareaRef,
      linesContainerRef,
      wordsContainerRef,
      rawText,
      linesData,
      currentLineIndex,
      currentWordIndex,
      currentTime,
      currentTimeDisplay,
      duration,
      durationDisplay,
      isPlaying,
      editMode,
      showLineSelector,
      lineTimestampedCount,
      currentWords,
      currentLineText,
      wordProgressText,
      canStamp,
      canUndo,
      showTimestampView,
      formattedLyricText,
      toggleTimestampView,
      formatTimeDisplay,
      formatWordTime,
      handleTextInput,
      togglePlay,
      switchMode,
      handleStamp,
      handleUndo,
      handleUndoMouseDown,
      handleUndoMouseUp,
      handleLineClick,
      handleLineDoubleClick,
      handleWordClick,
      selectLine,
      handleSave,
      handleCopy,
      handleCancel,
      handleSeek,
      handleSeekStart,
      handleSeekEnd,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 850px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--color-content-background);
  border-radius: @radius-border;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px;
  border-bottom: 1px solid var(--color-primary-background-hover);
  gap: 15px;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-font);
}

.modeSwitch {
  display: flex;
  flex: 1;
  justify-content: center;
  gap: 5px;
}

.modeBtn {
  padding: 6px 16px;
  border: 1px solid var(--color-primary-background-hover);
  background: var(--color-primary-background);
  color: var(--color-font-label);
  border-radius: @radius-border;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover:not([disabled]) {
    background: var(--color-primary-background-hover);
  }

  &.active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }

  &[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.closeBtn {
  background: none;
  border: none;
  padding: 5px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.body {
  flex: 1;
  display: flex;
  gap: 15px;
  padding: 15px 20px;
  overflow: hidden;
  min-height: 400px;
}

.inputSection, .stampSection {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--color-font-label);
}

.lineCount, .progress {
  font-size: 12px;
  color: var(--color-font-label);
  opacity: 0.7;
}

.textarea {
  flex: 1;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
  color: var(--color-font);
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;

  &:focus {
    border-color: var(--color-primary);
  }

  &::placeholder {
    color: var(--color-font-label);
    opacity: 0.5;
  }
}

.readonlyTextarea {
  background: var(--color-primary-background-hover);
  cursor: default;
  color: var(--color-font-label);
}

.toggleViewBtn {
  margin-left: auto;
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid var(--color-primary-background-hover);
  background: var(--color-primary-background);
  color: var(--color-font-label);
  border-radius: @radius-border;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary-background-hover);
  }

  &.active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
}

.timeDisplay {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--color-primary-background);
  border-radius: @radius-border;
  margin-bottom: 5px;
}

.timeDuration {
  font-size: 14px;
  color: var(--color-font-label);
  opacity: 0.7;
}

.timeLabel {
  font-size: 12px;
  color: var(--color-font-label);
}

.timeValue {
  font-size: 18px;
  font-weight: 500;
  font-family: monospace;
  color: var(--color-primary);
}

.linesContainer {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
}

.lineItem {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  gap: 8px;

  &:hover {
    background: var(--color-primary-background-hover);
  }

  &.active {
    background: var(--color-primary-background-active);
  }

  &.stamped {
    .lineTime {
      color: var(--color-primary);
    }
  }

  &.hasWordTime {
    .lineText {
      color: var(--color-primary);
    }
  }
}

.lineTime {
  flex: 0 0 80px;
  font-size: 12px;
  font-family: monospace;
  color: var(--color-font-label);
  opacity: 0.6;
}

.lineText {
  flex: 1;
  font-size: 14px;
  color: var(--color-font);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wordBadge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 6px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 10px;
}

// 逐字模式样式
.wordModeContainer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wordLineInfo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--color-primary-background);
  border-radius: @radius-border;
  margin-bottom: 10px;
}

.wordLineLabel {
  font-size: 12px;
  color: var(--color-font-label);
  flex-shrink: 0;
}

.wordLineText {
  flex: 1;
  font-size: 14px;
  color: var(--color-font);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.changeLineBtn {
  flex-shrink: 0;
  font-size: 12px;
  padding: 4px 10px;
}

.lineSelector {
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
  margin-bottom: 10px;
}

.lineSelectorItem {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  gap: 8px;

  &:hover {
    background: var(--color-primary-background-hover);
  }

  &.active {
    background: var(--color-primary-background-active);
  }
}

.lineSelectorTime {
  font-size: 11px;
  font-family: monospace;
  color: var(--color-font-label);
  width: 70px;
  flex-shrink: 0;
}

.lineSelectorText {
  font-size: 13px;
  color: var(--color-font);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wordsContainer {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-primary-background-hover);
  border-radius: @radius-border;
  background: var(--color-primary-background);
  padding: 15px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
}

.wordItem {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  border-radius: @radius-border;
  background: var(--color-primary-background-hover);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 50px;

  &:hover {
    background: var(--color-primary-background-active);
  }

  &.active {
    background: var(--color-primary);
    color: #fff;

    .wordTime {
      color: rgba(255, 255, 255, 0.8);
    }
  }

  &.stamped:not(.active) {
    border: 2px solid var(--color-primary);
  }
}

.wordChar {
  font-size: 20px;
  font-weight: 500;
}

.wordTime {
  font-size: 10px;
  color: var(--color-font-label);
  margin-top: 4px;
  font-family: monospace;
}

.controls {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.controlBtn {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 13px;

  &[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.stampBtn {
  flex: 2;
  background: var(--color-primary) !important;
  color: #fff !important;

  &:hover:not([disabled]) {
    opacity: 0.9;
  }
}

.playbackSection {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 0 10px;
}

.playBtn {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  background: var(--color-primary-background-hover);

  &:hover {
    background: var(--color-primary-background-active);
  }
}

.progressBar {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-primary-background-hover);
  border-radius: 3px;
  cursor: pointer;
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--color-primary);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.1s;
    
    &:hover {
      transform: scale(1.2);
    }
  }

  &::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
  }
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid var(--color-primary-background-hover);
}

.footerBtn {
  min-width: 80px;
}
</style>
