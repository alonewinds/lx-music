export interface TaskbarLyricDisplay extends Electron.Rectangle {
  workArea: Electron.Rectangle
}

export interface TaskbarLyricBoundsOptions {
  display: TaskbarLyricDisplay
  width: number
  height: number
  position: LX.AppSetting['taskbarLyric.position']
  offsetX: number
  /** TrayNotifyWnd 的逻辑像素左边界，用于回避系统托盘区域。null 时不作约束 */
  trayNotifyLeft?: number | null
}

export type TaskbarPosition = 'top' | 'right' | 'bottom' | 'left'

export interface TaskbarLyricState {
  enabled: boolean
  isPlaying: boolean
  isCollected: boolean
  songId: string | null
  title: string
  artist: string
  lyricLine: string
  lyricLineChars: Array<{ char: string; startMs: number; durationMs: number }> | null
  lyricLineStartMs: number
  locked: boolean
  lyricAlign: 'left' | 'center' | 'right'
  albumCoverUrl: string | null
  offsetX: number
  showCover: boolean
  showSongInfo: boolean
  showCurrentLine: boolean
  swapTitleAndArtist: boolean
  themeColor: string
  backgroundColorMode: LX.AppSetting['taskbarLyric.style.backgroundColorMode']
  backgroundColor: LX.AppSetting['taskbarLyric.style.backgroundColor']
  backgroundOpacity: LX.AppSetting['taskbarLyric.style.backgroundOpacity']
  songInfoFontColorMode: LX.AppSetting['taskbarLyric.style.songInfoFontColorMode']
  songInfoFontColor: LX.AppSetting['taskbarLyric.style.songInfoFontColor']
  lyricFontColorMode: LX.AppSetting['taskbarLyric.style.lyricFontColorMode']
  lyricFontColor: LX.AppSetting['taskbarLyric.style.lyricFontColor']
  font: LX.AppSetting['taskbarLyric.style.font']
  songInfoFontSize: LX.AppSetting['taskbarLyric.style.songInfoFontSize']
  lyricFontSize: LX.AppSetting['taskbarLyric.style.lyricFontSize']
  isFontWeight: LX.AppSetting['taskbarLyric.style.isFontWeight']
}

export interface TaskbarLyricDragMoveParams {
  offsetX: number
}
