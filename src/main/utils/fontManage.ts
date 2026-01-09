import { getFonts as getSystemFonts } from 'font-list'
import { log } from '@common/utils'

const getFonts = async () => {
  log.info('Getting system fonts...')
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
