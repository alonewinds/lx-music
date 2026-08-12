<template>
  <div class="lyric-line-transition">
    <Transition name="line-slide">
      <TaskbarLyricWordLyric
        v-if="chars"
        :key="lineKey"
        :chars="chars"
        :start-ms="startMs"
        :font-size="fontSize"
        :style="{ textAlign: align }"
      />
      <TaskbarLyricLyricLine
        v-else
        :key="lineKey"
        :text="text"
        :font-size="fontSize"
        :style="{ textAlign: align }"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TaskbarLyricLyricLine from './TaskbarLyricLyricLine.vue'
import TaskbarLyricWordLyric from './TaskbarLyricWordLyric.vue'

const props = defineProps<{
  text: string
  chars: Array<{ char: string; startMs: number; durationMs: number }> | null
  startMs: number
  fontSize?: number
  align: 'left' | 'center' | 'right'
}>()

const lineKey = computed(() => `${props.startMs}-${props.chars ? 'word' : 'line'}-${props.text}`)
</script>

<style lang="less" scoped>
.lyric-line-transition {
  position: relative;
  height: 1.1em;
  overflow: hidden;
}

.lyric-line-transition :deep(.lyric-line) {
  position: absolute;
  top: 0;
  width: 100%;
}

.line-slide-enter-active,
.line-slide-leave-active {
  transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease;
}

.line-slide-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.line-slide-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
