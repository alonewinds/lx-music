import { execFile } from 'node:child_process'
import { screen } from 'electron'

/**
 * 通过 PowerShell 内联 C# 调用 Win32 API，查询 TrayNotifyWnd 的真实屏幕坐标。
 * TrayNotifyWnd 是 Windows 系统托盘通知区域（包含时钟和系统图标），
 * 其左边界是歌词面板在右对齐时的右边界约束。
 */

// 用于查询 Shell_TrayWnd → TrayNotifyWnd 矩形的 PowerShell 脚本
// 必须内联 C# 因为 Node 没有直接的 Win32 绑定
const PS_QUERY_SCRIPT = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class TrayHelper {
  [DllImport("user32.dll", SetLastError=true)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll", SetLastError=true)]
  public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@ -ErrorAction SilentlyContinue
try {
  $trayWnd = [TrayHelper]::FindWindow("Shell_TrayWnd", "")
  $notifyWnd = [TrayHelper]::FindWindowEx($trayWnd, [IntPtr]::Zero, "TrayNotifyWnd", "")
  $rect = New-Object TrayHelper+RECT
  $ok = [TrayHelper]::GetWindowRect($notifyWnd, [ref]$rect)
  if ($ok) { Write-Output "$($rect.Left) $($rect.Top) $($rect.Right) $($rect.Bottom)" }
  else { Write-Output "ERR" }
} catch { Write-Output "ERR" }
`.trim()

export interface TrayNotifyRect {
  /** 物理像素左边界 */
  physLeft: number
  /** 物理像素右边界 */
  physRight: number
  /** 逻辑像素左边界（已除以 scaleFactor） */
  logicalLeft: number
}

let _cachedRect: TrayNotifyRect | null = null
let _lastQueryTime = 0
const CACHE_TTL_MS = 3000 // 缓存 3 秒

/**
 * 查询并缓存 TrayNotifyWnd 的坐标，返回逻辑像素左边界。
 * 每次调用都是异步的，不会阻塞主进程。
 */
export const refreshTrayNotifyRect = (): Promise<TrayNotifyRect | null> => {
  return new Promise((resolve) => {
    const now = Date.now()
    // 缓存未过期时直接返回
    if (_cachedRect && now - _lastQueryTime < CACHE_TTL_MS) {
      resolve(_cachedRect)
      return
    }

    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', PS_QUERY_SCRIPT],
      { timeout: 4000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve(null)
          return
        }
        const raw = stdout.trim()
        if (raw === 'ERR' || !raw) {
          resolve(null)
          return
        }
        const parts = raw.split(/\s+/).map(Number)
        if (parts.length !== 4 || parts.some(isNaN)) {
          resolve(null)
          return
        }
        const [left, , right] = parts
        const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1
        const result: TrayNotifyRect = {
          physLeft: left,
          physRight: right,
          logicalLeft: Math.round(left / scaleFactor),
        }
        _cachedRect = result
        _lastQueryTime = now
        resolve(result)
      },
    )
  })
}

/** 强制清除缓存，下次调用时重新查询 */
export const invalidateTrayCache = () => {
  _lastQueryTime = 0
}

/** 同步获取最近一次缓存的值（可能为 null） */
export const getCachedTrayNotifyRect = (): TrayNotifyRect | null => _cachedRect
