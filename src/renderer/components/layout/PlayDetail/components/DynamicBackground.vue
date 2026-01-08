<template>
  <canvas ref="canvasRef" :class="$style.canvas" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { MeshGradientRenderer } from '@renderer/utils/amll/bg-render/mesh-renderer'
import { PixiRenderer } from '@renderer/utils/amll/bg-render/pixi-renderer'
import { musicInfo } from '@renderer/store/player/state'

const canvasRef = ref(null)
let renderer = null

onMounted(() => {
  if (canvasRef.value) {
    // 尝试使用MeshGradientRenderer，失败则回退到PixiRenderer
    try {
      renderer = new MeshGradientRenderer(canvasRef.value)
    } catch (e) {
      console.warn('MeshGradientRenderer failed, falling back to PixiRenderer:', e)
      renderer = new PixiRenderer(canvasRef.value)
    }
    if (musicInfo.pic) {
      renderer.setAlbum(musicInfo.pic)
    }
  }
})

onBeforeUnmount(() => {
  if (renderer) {
    renderer.dispose()
    renderer = null
  }
})

watch(() => musicInfo.pic, (pic) => {
  if (renderer && pic) {
    renderer.setAlbum(pic)
  }
})
</script>

<style lang="less" module>
.canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>


