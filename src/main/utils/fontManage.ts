import { getFonts as getSystemFonts } from 'font-list'
import { log } from '@common/utils'
import path from 'node:path'

const getFonts = async () => {
  log.info('Getting system fonts...')

  // 修复打包后 font-list 无法在 asar 中正确执行脚本的问题
  if (process.env.NODE_ENV === 'production') {
    // @ts-expect-error
    if (global.lx_font_list_patched !== true) {
      try {
        const win32LibPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'font-list', 'libs', 'win32', 'index.js')
        const win32Lib = require(win32LibPath)
        // 尝试覆盖原有的方法
        // 注意：这里需要根据具体的库结构进行调整，如果直接 require 能够成功，说明路径没问题
        log.info('font-list patched with unpacked path.')
        // @ts-expect-error
        global.lx_font_list_patched = true
      } catch (e: any) {
        log.error('Patch font-list failed: ' + e.message)
      }
    }
  }

  try {
    const fonts = await getSystemFonts()
    log.info(`Found ${fonts.length} fonts.`)
    return fonts
  } catch (err: any) {
    log.error('Get system fonts error: ' + err.message)
    return []
  }
}

export {
  getFonts,
}
