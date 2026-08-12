<template>
  <div ref="containerRef" class="lyric-line word-lyric">
    <div
      v-if="shouldScroll"
      class="lyric-line-track"
      :style="trackStyle"
    >
      <span class="lyric-line-text">
        <span
          v-for="(char, index) in chars"
          :key="index"
          class="word-char"
          :style="charStyles[index]"
        >{{ char.char }}</span>
      </span>
      <span class="lyric-line-gap" aria-hidden="true"></span>
      <span class="lyric-line-text" aria-hidden="true">
        <span
          v-for="(char, index) in chars"
          :key="index"
          class="word-char"
          :style="charStyles[index]"
        >{{ char.char }}</span>
      </span>
    </div>
    <span v-else class="lyric-line-text">
      <span
        v-for="(char, index) in chars"
        :key="index"
        class="word-char"
        :style="charStyles[index]"
      >{{ char.char }}</span>
    </span>
    <span ref="measureRef" class="lyric-line-measure">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { toRef, computed } from 'vue'
import { useTaskbarLyricOverflowMarquee } from '../composables/useTaskbarLyricOverflowMarquee'

const props = defineProps<{
  chars: Array<{ char: string; startMs: number; durationMs: number }>
  startMs: number
  fontSize?: number
}>()

const text = computed(() => props.chars.map((c: { char: string; startMs: number; durationMs: number }) => c.char).join(''))

const { containerRef, measureRef, shouldScroll, trackStyle } = useTaskbarLyricOverflowMarquee({
  text: text,
  minDuration: 8,
  pixelsPerSecond: 28,
  distanceVarName: '--taskbar-lyric-line-scroll-distance',
  durationVarName: '--taskbar-lyric-line-scroll-duration',
  watchSources: [toRef(props, 'fontSize')],
})

const charStyles = computed(() => {
  const now = Date.now()
  const lineLatency = Math.max(0, now - props.startMs)
  return props.chars.map((char) => {
    const effectiveDelay = char.startMs - lineLatency
    return {
      animationDuration: `${char.durationMs}ms`,
      animationDelay: `${effectiveDelay}ms`,
      animationPlayState: 'running',
    }
  })
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
