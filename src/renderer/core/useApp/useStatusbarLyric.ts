import { appSetting } from '@renderer/store/setting'
import { setDisableAutoPauseBySource } from '@renderer/core/lyric'

export default () => {
  const handleEnableStatusbar = (enable: boolean) => {
    setDisableAutoPauseBySource(enable, 'statusBarLyric')
  }
  const handleEnableTaskbar = (enable: boolean) => {
    setDisableAutoPauseBySource(enable, 'taskbarLyric')
  }
  const handleEnableDesktop = (enable: boolean) => {
    setDisableAutoPauseBySource(enable, 'desktopLyric')
  }

  window.app_event.on('configUpdate', (setting) => {
    if (setting['player.isShowStatusBarLyric'] != null) {
      handleEnableStatusbar(setting['player.isShowStatusBarLyric'])
    }
    if (setting['taskbarLyric.enable'] != null) {
      handleEnableTaskbar(setting['taskbarLyric.enable'])
    }
    if (setting['desktopLyric.enable'] != null) {
      handleEnableDesktop(setting['desktopLyric.enable'])
    }
  })

  return async() => {
    if (appSetting['player.isShowStatusBarLyric']) {
      handleEnableStatusbar(true)
    }
    if (appSetting['taskbarLyric.enable']) {
      handleEnableTaskbar(true)
    }
    if (appSetting['desktopLyric.enable']) {
      handleEnableDesktop(true)
    }
  }
}
