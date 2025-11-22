import {
  createAudio,
} from '@renderer/plugins/player'
import useMediaDevice from './useMediaDevice'
import usePlayerEvent from './usePlayerEvent'
import usePlayer from './usePlayer'
import usePlayStatus from './usePlayStatus'
import { initPlayCountTracking } from '@renderer/core/player/playCountTracking'

export default () => {
  createAudio()

  usePlayerEvent()
  useMediaDevice() // 初始化音频驱动输出设置
  usePlayer()
  const initPlayStatus = usePlayStatus()

  // 初始化播放次数跟踪
  initPlayCountTracking()

  return () => {
    void initPlayStatus()
  }
}
