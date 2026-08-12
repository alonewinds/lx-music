import { screen, powerMonitor } from 'electron'
import { isWin } from '@common/utils'
import { closeWindow, createWindow, refreshBounds, refreshWindowStateFromConfig, isExistWindow, updatePlayerStatus } from './main'
import { refreshTrayNotifyRect, getCachedTrayNotifyRect } from './winTray'

let isRegistered = false
let trayPollInterval: ReturnType<typeof setInterval> | null = null

const refreshBoundsIfEnabled = () => {
  if (!global.lx.appSetting['taskbarLyric.enable']) return
  if (isExistWindow()) refreshBounds()
  else createWindow()
}

/** 轮询 TrayNotifyWnd 坐标：若托盘区宽度发生变化则自动刷新面板位置 */
const startTrayPolling = () => {
  if (trayPollInterval) return
  trayPollInterval = setInterval(async () => {
    if (!global.lx.appSetting['taskbarLyric.enable'] || !isExistWindow()) return
    const prevLeft = getCachedTrayNotifyRect()?.logicalLeft ?? null
    await refreshTrayNotifyRect(true)
    const nextLeft = getCachedTrayNotifyRect()?.logicalLeft ?? null
    // 托盘左边界发生变化（图标增减）→ 重新计算面板位置
    if (prevLeft !== nextLeft) {
      refreshBoundsIfEnabled()
    }
  }, 3000)
}

const stopTrayPolling = () => {
  if (trayPollInterval) {
    clearInterval(trayPollInterval)
    trayPollInterval = null
  }
}

const handleConfigChange = (keys: Array<keyof LX.AppSetting>) => {
  if (!keys.some(key => key.startsWith('taskbarLyric.'))) return

  // 字体变更需要立即同步到已存在的歌词窗口；锁定状态和启用开关均不应阻断样式更新。
  if (keys.includes('taskbarLyric.style.font')) {
    refreshWindowStateFromConfig()
    return
  }

  if (keys.includes('taskbarLyric.enable')) {
    if (global.lx.appSetting['taskbarLyric.enable']) {
      createWindow()
      startTrayPolling()
    } else {
      stopTrayPolling()
      closeWindow()
    }
    return
  }

  if (global.lx.appSetting['taskbarLyric.enable'] && (
    keys.includes('taskbarLyric.position') ||
    keys.includes('taskbarLyric.width') ||
    keys.includes('taskbarLyric.offsetX')
  )) refreshBounds()

  if (global.lx.appSetting['taskbarLyric.enable'] && (
    keys.includes('taskbarLyric.locked') ||
    keys.includes('taskbarLyric.lyricAlign') ||
    keys.includes('taskbarLyric.showCover') ||
    keys.includes('taskbarLyric.showSongInfo') ||
    keys.includes('taskbarLyric.showCurrentLine') ||
    keys.includes('taskbarLyric.swapTitleAndArtist') ||
    keys.includes('taskbarLyric.style.backgroundColorMode') ||
    keys.includes('taskbarLyric.style.backgroundColor') ||
    keys.includes('taskbarLyric.style.backgroundOpacity') ||
    keys.includes('taskbarLyric.style.songInfoFontColorMode') ||
    keys.includes('taskbarLyric.style.songInfoFontColor') ||
    keys.includes('taskbarLyric.style.lyricFontColorMode') ||
    keys.includes('taskbarLyric.style.lyricFontColor') ||
    keys.includes('taskbarLyric.style.songInfoFontSize') ||
    keys.includes('taskbarLyric.style.lyricFontSize')
  )) refreshWindowStateFromConfig()
}

export default () => {
  if (isRegistered || !isWin) return
  isRegistered = true

  global.lx.event_app.on('app_inited', async () => {
    if (global.lx.appSetting['taskbarLyric.enable']) {
      // 启动前先异步查询一次托盘坐标，填充缓存
      await refreshTrayNotifyRect()
      createWindow()
      startTrayPolling()
    }
  })

  global.lx.event_app.on('updated_config', (keys) => {
    handleConfigChange(keys)
  })

  global.lx.event_app.on('player_status', (status) => {
    if (!global.lx.appSetting['taskbarLyric.enable']) return
    updatePlayerStatus(status)
  })

  screen.on('display-added', async () => {
    await refreshTrayNotifyRect()
    refreshBoundsIfEnabled()
  })
  screen.on('display-removed', async () => {
    await refreshTrayNotifyRect()
    refreshBoundsIfEnabled()
  })
  screen.on('display-metrics-changed', async () => {
    await refreshTrayNotifyRect()
    refreshBoundsIfEnabled()
  })
  powerMonitor.on('resume', async () => {
    await refreshTrayNotifyRect()
    refreshBoundsIfEnabled()
  })
  powerMonitor.on('unlock-screen', async () => {
    await refreshTrayNotifyRect()
    refreshBoundsIfEnabled()
  })
}

export * from './main'
