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
        button(:class="$style.closeBtn" @click="handleCancel")
          svg(version="1.1" xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 24 24")
            use(xlink:href="#icon-close")

      //- 主内容区
      div(:class="$style.body")
        //- 左侧：歌词输入区
        div(:class="$style.inputSection")
          div(:class="$style.sectionHeader")
            span {{ $t('lyric_editor__input_label') }}
            span(:class="$style.lineCount") ({{ lines.length }} {{ $t('lyric_editor__lines') }})
          textarea(
            ref="textareaRef"
            v-model="rawText"
            :class="$style.textarea"
            :placeholder="$t('lyric_editor__input_placeholder')"
            @input="handleTextInput"
          )

        //- 右侧：打轴区
        div(:class="$style.stampSection")
          div(:class="$style.sectionHeader")
            span {{ $t('lyric_editor__stamp_label') }}
            span(:class="$style.progress") {{ timestampedCount }}/{{ lines.length }}

          //- 当前播放时间和进度条
          div(:class="$style.timeDisplay")
            span(:class="$style.timeLabel") {{ $t('lyric_editor__current_time') }}:
            span(:class="$style.timeValue") {{ currentTimeDisplay }}
            span(:class="$style.timeDuration") / {{ durationDisplay }}
          
          //- 播放进度条
          div(:class="$style.progressContainer")
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

          //- 歌词滚动列表
          div(ref="linesContainerRef" :class="$style.linesContainer")
            div(
              v-for="(line, index) in lines"
              :key="index"
              :data-index="index"
              :class="[$style.lineItem, { [$style.active]: index === currentLineIndex, [$style.stamped]: timestamps[index] >= 0 }]"
              @click="handleLineClick(index)"
            )
              span(:class="$style.lineTime") {{ timestamps[index] >= 0 ? formatTimeDisplay(timestamps[index]) : '--:--.--' }}
              span(:class="$style.lineText") {{ line }}

          //- 操作按钮
          div(:class="$style.controls")
            base-btn(
              :class="$style.controlBtn"
              @click="togglePlay"
            )
              svg(version="1.1" xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 1024 1024")
                use(:xlink:href="isPlaying ? '#icon-pause' : '#icon-play'")

            base-btn(
              :class="[$style.controlBtn, $style.stampBtn]"
              :disabled="lines.length === 0 || currentLineIndex >= lines.length"
              @click="handleStamp"
            ) {{ $t('lyric_editor__mark_time') }}

            base-btn(
              :class="$style.controlBtn"
              :disabled="timestampedCount === 0"
              @click="handleUndo"
            ) {{ $t('lyric_editor__undo') }}

      //- 底部操作栏
      div(:class="$style.footer")
        base-btn(:class="$style.footerBtn" @click="handleCopy") {{ $t('lyric_editor__copy') }}
        base-btn(:class="$style.footerBtn" @click="handleCancel") {{ $t('btn_cancel') }}
        base-btn(
          :class="$style.footerBtn"
          color="primary"
          :disabled="lines.length === 0"
          @click="handleSave"
        ) {{ $t('btn_save') }}
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from '@common/utils/vueTools'
import { getCurrentTime as getPlayerCurrentTime, getDuration as getPlayerDuration, setCurrentTime, setPause, setPlay } from '@renderer/plugins/player'
import { isPlay } from '@renderer/store/player/state'
import {
  splitLyricText,
  formatTimeDisplay,
  buildLrcFromLines,
  getTimestampedCount,
  parseLrcToLines,
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
    const rawText = ref('')
    const lines = ref([])
    const timestamps = ref([])
    const currentLineIndex = ref(0)
    const currentTime = ref(0)
    let animationFrameId = null

    const isPlaying = computed(() => isPlay.value)
    const timestampedCount = computed(() => getTimestampedCount(timestamps.value))
    const currentTimeDisplay = computed(() => formatTimeDisplay(currentTime.value))
    const duration = ref(0)
    const durationDisplay = computed(() => formatTimeDisplay(duration.value))
    const isSeeking = ref(false)

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
      const newLines = splitLyricText(rawText.value)
      const oldTimestamps = timestamps.value
      
      // 尝试保留时间戳
      if (newLines.length === oldTimestamps.length) {
        // 行数未变（如修改错别字），直接更新文本，完整保留时间戳
        lines.value = newLines
        // timestamps.value 保持不变
      } else {
        // 行数变化（如增删行）
        // 策略：按索引保留现有时间戳，多出的补 -1
        const newTimestamps = new Array(newLines.length).fill(-1)
        const count = Math.min(newLines.length, oldTimestamps.length)
        for (let i = 0; i < count; i++) {
          newTimestamps[i] = oldTimestamps[i]
        }
        lines.value = newLines
        timestamps.value = newTimestamps
      }
      
      // 修正当前行索引，避免越界，而不是重置为 0
      if (currentLineIndex.value >= lines.value.length) {
        currentLineIndex.value = Math.max(0, lines.value.length - 1)
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

    // 打轴操作
    const handleStamp = () => {
      if (currentLineIndex.value >= lines.value.length) return

      const time = getPlayerCurrentTime() * 1000
      timestamps.value[currentLineIndex.value] = time

      // 移动到下一行
      if (currentLineIndex.value < lines.value.length - 1) {
        currentLineIndex.value++
        scrollToCurrentLine()
      }
    }

    // 撤销上一次打轴
    const handleUndo = () => {
      // 找到最后一个有时间戳的行
      let lastStampedIndex = -1
      for (let i = timestamps.value.length - 1; i >= 0; i--) {
        if (timestamps.value[i] >= 0) {
          lastStampedIndex = i
          break
        }
      }

      if (lastStampedIndex >= 0) {
        timestamps.value[lastStampedIndex] = -1
        currentLineIndex.value = lastStampedIndex
        scrollToCurrentLine()
      }
    }

    // 点击行选择
    const handleLineClick = (index) => {
      currentLineIndex.value = index
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

    // 保存歌词
    const handleSave = () => {
      const lrc = buildLrcFromLines(lines.value, timestamps.value)
      emit('save', { lyric: lrc })
    }

    // 取消
    const handleCancel = () => {
      emit('close')
    }

    // 复制歌词
    const handleCopy = async () => {
      const lrc = buildLrcFromLines(lines.value, timestamps.value)
      try {
        await navigator.clipboard.writeText(lrc)
        // 可以添加一个简单的提示，这里暂且省略或复用已有的提示机制
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
        e.lx_handled = true // 阻止全局快捷键处理（如播放/暂停）
        handleStamp()
      }
    }

    // 初始化
    watch(() => props.visible, (val) => {
      if (val) {
        // 加载现有歌词
        if (props.existingLyric) {
          // 解析 LRC 格式歌词以恢复时间戳
          const parsed = parseLrcToLines(props.existingLyric)
          if (parsed.length > 0 && parsed.some(p => p.time >= 0)) {
            // 有时间戳的 LRC 格式
            lines.value = parsed.map(p => p.text)
            timestamps.value = parsed.map(p => p.time)
            // 重建 rawText 以显示在输入框
            rawText.value = lines.value.join('\n')
          } else {
            // 纯文本格式
            rawText.value = props.existingLyric
            handleTextInput()
          }
          // 找到第一个未打轴的行
          currentLineIndex.value = timestamps.value.findIndex(t => t < 0)
          if (currentLineIndex.value < 0) currentLineIndex.value = lines.value.length
        } else {
          rawText.value = ''
          lines.value = []
          timestamps.value = []
          currentLineIndex.value = 0
        }

        // 开始监听播放时间
        animationFrameId = requestAnimationFrame(updateCurrentTime)

        // 添加键盘事件（使用捕获阶段，优先于全局快捷键处理）
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
      rawText,
      lines,
      timestamps,
      currentLineIndex,
      currentTime,
      currentTimeDisplay,
      duration,
      durationDisplay,
      isPlaying,
      timestampedCount,
      formatTimeDisplay,
      handleTextInput,
      togglePlay,
      handleStamp,
      handleUndo,
      handleLineClick,
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
  width: 800px;
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
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-font);
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

.progressContainer {
  margin-bottom: 10px;
  padding: 0 10px;
}

.progressBar {
  width: 100%;
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

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid var(--color-primary-background-hover);
}

.cancelBtn {
  min-width: 80px;
}

.saveBtn {
  min-width: 80px;
  background: var(--color-primary) !important;
  color: #fff !important;

  &[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
