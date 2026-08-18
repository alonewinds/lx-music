<template>
  <div ref="containerRef" class="lyric-line word-lyric">
    <div
      v-if="shouldScroll"
      class="lyric-line-track"
      :style="trackStyle"
    >
      <span class="lyric-line-text">
        <span
          v-for="(char, index) in cachedChars"
          :key="index"
          class="word-char"
          :style="charStyles[index]"
        >{{ char.char }}</span>
      </span>
      <span class="lyric-line-gap" aria-hidden="true"></span>
      <span class="lyric-line-text" aria-hidden="true">
        <span
          v-for="(char, index) in cachedChars"
          :key="index"
          class="word-char"
          :style="charStyles[index]"
        >{{ char.char }}</span>
      </span>
    </div>
    <span v-else class="lyric-line-text">
      <span
        v-for="(char, index) in cachedChars"
        :key="index"
        class="word-char"
        :style="charStyles[index]"
      >{{ char.char }}</span>
    </span>
    <span ref="measureRef" class="lyric-line-measure">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { toRef, computed, shallowRef, watch } from 'vue'
import { useTaskbarLyricOverflowMarquee } from '../composables/useTaskbarLyricOverflowMarquee'

const props = defineProps<{
  chars: Array<{ char: string; startMs: number; durationMs: number }>
  startMs: number
  isPlaying?: boolean
  fontSize?: number
}>()

// 行内容标识：只有逐字内容真正变化（行切换）时才会变化。
// 渲染端/主进程推送时 lyricLineChars 可能是「内容相同但引用不同」的新数组，
// 若按引用触发重算，暂停/恢复瞬间 animationDelay 会被 Date.now() 重算，
// 导致浏览器重新评估动画进度，出现「没停在该停的字上、停在后面两个字」的跳变。
const charsKey = computed(() => {
  let key = ''
  for (const c of props.chars) key += `${c.startMs},${c.durationMs},${c.char};`
  return key
})

// 内容级缓存：仅在 charsKey 变化时更新引用，隔离引用级抖动
const cachedChars = shallowRef<typeof props.chars>(props.chars)
watch(charsKey, () => {
  cachedChars.value = props.chars
}, { immediate: true })

const text = computed(() => cachedChars.value.map((c: { char: string; startMs: number; durationMs: number }) => c.char).join(''))

const { containerRef, measureRef, shouldScroll, trackStyle } = useTaskbarLyricOverflowMarquee({
  text: text,
  minDuration: 8,
  pixelsPerSecond: 28,
  distanceVarName: '--taskbar-lyric-line-scroll-distance',
  durationVarName: '--taskbar-lyric-line-scroll-duration',
  watchSources: [toRef(props, 'fontSize')],
  playing: toRef(props, 'isPlaying'),
})

// 行的逐字动画进度基准：只在行切换（cachedChars/startMs 变化）时重算。
// 暂停/恢复只切换 animation-play-state 让动画冻结/继续，
// 若在暂停/恢复时重算 animationDelay（基于 Date.now()），动画进度会被重新评估而跳变。
const charBaseStyles = computed(() => {
  const now = Date.now()
  const lineLatency = Math.max(0, now - props.startMs)
  return cachedChars.value.map((char) => {
    const effectiveDelay = char.startMs - lineLatency
    return {
      animationDuration: `${char.durationMs}ms`,
      animationDelay: `${effectiveDelay}ms`,
    }
  })
})

const charStyles = computed(() => {
  const playState = props.isPlaying === false ? 'paused' : 'running'
  return charBaseStyles.value.map((style) => ({
    ...style,
    animationPlayState: playState,
  }))
})
</script>

<style lang="less" scoped>
.word-lyric .word-char {
  display: inline-block;
  white-space: pre;
  background-image: linear-gradient(var(--taskbar-lyric-text) 0 0);
  background-repeat: no-repeat;
  background-color: color-mix(in srgb, var(--taskbar-lyric-text) 60%, transparent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 0 100%;
  animation-name: word-fill;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes word-fill {
  0% {
    background-size: 0 100%;
  }
  100% {
    background-size: 100% 100%;
  }
}
</style>
