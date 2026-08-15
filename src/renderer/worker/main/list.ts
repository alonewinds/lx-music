// import { throttle } from '@common/utils'

import { SPLIT_CHAR } from '@common/constants'
import { filterFileName, sortInsert, similar, arrPushByPosition, arrShuffle } from '@common/utils/common'
import { joinPath, saveStrToFile } from '@common/utils/nodejs'
import { createLocalMusicInfo } from '@renderer/utils/music'


/**
 * 过滤列表中已播放的歌曲
 */
export const filterMusicList = async ({ playedList, listId, list, playerMusicInfo, dislikeInfo, isNext }: {
  /**
   * 已播放列表
   */
  playedList: LX.Player.PlayMusicInfo[]
  /**
   * 列表id
   */
  listId: string
  /**
   * 播放列表
   */
  list: Array<LX.Music.MusicInfo | LX.Download.ListItem>
  /**
   * 下载目录
   */
  // savePath: string
  /**
   * 播放器内当前歌曲（`playInfo.playerPlayIndex`指向的歌曲）
   */
  playerMusicInfo?: LX.Music.MusicInfo | LX.Download.ListItem
  /**
   * 不喜欢的歌曲名字列表
   */
  dislikeInfo: Omit<LX.Dislike.DislikeInfo, 'rules'>

  isNext: boolean
}) => {
  let playerIndex = -1

  let canPlayList: Array<LX.Music.MusicInfo | LX.Download.ListItem> = []
  const filteredPlayedList = playedList.filter(pmInfo => pmInfo.listId == listId && !pmInfo.isTempPlay).map(({ musicInfo }) => musicInfo)
  const hasDislike = (info: LX.Music.MusicInfo) => {
    const name = info.name?.replaceAll(SPLIT_CHAR.DISLIKE_NAME, SPLIT_CHAR.DISLIKE_NAME_ALIAS).toLocaleLowerCase().trim() ?? ''
    const singer = info.singer?.replaceAll(SPLIT_CHAR.DISLIKE_NAME, SPLIT_CHAR.DISLIKE_NAME_ALIAS).toLocaleLowerCase().trim() ?? ''

    return dislikeInfo.musicNames.has(name) || dislikeInfo.singerNames.has(singer) ||
      dislikeInfo.names.has(`${name}${SPLIT_CHAR.DISLIKE_NAME}${singer}`)
  }

  let isDislike = false
  const filteredList: Array<LX.Music.MusicInfo | LX.Download.ListItem> = list.filter(s => {
    // if (!assertApiSupport(s.source)) return false
    if ('progress' in s) {
      if (!s.isComplate) return false
    } else if (hasDislike(s)) {
      if (s.id != playerMusicInfo?.id) return false
      isDislike = true
    }

    canPlayList.push(s)

    let index = filteredPlayedList.findIndex(m => m.id == s.id)
    if (index > -1) {
      filteredPlayedList.splice(index, 1)
      return false
    }
    return true
  })
  if (playerMusicInfo) {
    if (isDislike) {
      if (filteredList.length <= 1) {
        filteredList.splice(0, 1)
        if (canPlayList.length > 1) {
          let currentMusicIndex = canPlayList.findIndex(m => m.id == playerMusicInfo.id)
          if (isNext) {
            playerIndex = currentMusicIndex - 1
            if (playerIndex < 0 && canPlayList.length > 1) playerIndex = canPlayList.length - 2
          } else {
            playerIndex = currentMusicIndex
            if (canPlayList.length <= 1) playerIndex = -1
          }
          canPlayList.splice(currentMusicIndex, 1)
        } else canPlayList.splice(0, 1)
      } else {
        let currentMusicIndex = filteredList.findIndex(m => m.id == playerMusicInfo.id)
        if (isNext) {
          playerIndex = currentMusicIndex - 1
          if (playerIndex < 0 && filteredList.length > 1) playerIndex = filteredList.length - 2
        } else {
          playerIndex = currentMusicIndex
          if (filteredList.length <= 1) playerIndex = -1
        }
        filteredList.splice(currentMusicIndex, 1)
      }
    } else {
      playerIndex = (filteredList.length ? filteredList : canPlayList).findIndex(m => m.id == playerMusicInfo.id)
    }
  }
  return {
    filteredList,
    canPlayList,
    playerIndex,
  }
}

const getIntv = (musicInfo: LX.Music.MusicInfo) => {
  if (!musicInfo.interval) return 0
  // if (musicInfo._interval) return musicInfo._interval
  let intvArr = musicInfo.interval.split(':')
  let intv = 0
  let unit = 1
  while (intvArr.length) {
    intv += parseInt(intvArr.pop()!) * unit
    unit *= 60
  }
  return intv
}

export type SortFieldName = 'name' | 'singer' | 'albumName' | 'interval' | 'source' | 'playCount' | 'addTime'
export type SortFieldType = 'up' | 'down' | 'random'
/**
 * 排序歌曲
 * @param list 歌曲列表
 * @param sortType 排序类型
 * @param fieldName 排序字段
 * @param localeId 排序语言
 * @returns
 */
export const sortListMusicInfo = async (list: LX.Music.MusicInfo[], sortType: SortFieldType, fieldName: SortFieldName, localeId: string, playCounts?: Record<string, number>) => {
  // console.log(sortType, fieldName, localeId)
  // const locale = new Intl.Locale(localeId)
  switch (sortType) {
    case 'random':
      arrShuffle(list)
      break
    case 'up':
      if (fieldName == 'interval') {
        list.sort((a, b) => {
          if (a.interval == null) {
            return b.interval == null ? 0 : -1
          } else return b.interval == null ? 1 : getIntv(a) - getIntv(b)
        })
      } else {
        switch (fieldName) {
          case 'name':
          case 'singer':
          case 'source':
            list.sort((a, b) => {
              if (a[fieldName] == null) {
                return b[fieldName] == null ? 0 : -1
              } else return b[fieldName] == null ? 1 : a[fieldName].localeCompare(b[fieldName], localeId)
            })
            break
          case 'albumName':
            list.sort((a, b) => {
              if (a.meta.albumName == null) {
                return b.meta.albumName == null ? 0 : -1
              } else return b.meta.albumName == null ? 1 : a.meta.albumName.localeCompare(b.meta.albumName, localeId)
            })
            break
          case 'playCount': {
            if (!playCounts) {
              console.log('[Worker] No playCounts provided for sorting (up)')
              break
            }
            console.log('[Worker] Sorting by playCount (up), sample data:', Object.keys(playCounts).slice(0, 3))
            list.sort((a, b) => {
              const countA = playCounts[a.id] ?? 0
              const countB = playCounts[b.id] ?? 0
              return countA - countB
            })
            break
          }
          case 'addTime': {
            const listWithIndex = list.map((item, index) => ({ item, index }))
            listWithIndex.sort((a, b) => {
              const timeA = a.item.meta.addTime
              const timeB = b.item.meta.addTime
              if (timeA != null && timeB != null) {
                return timeA === timeB ? a.index - b.index : timeA - timeB
              }
              if (timeA != null) return -1
              if (timeB != null) return 1
              return a.index - b.index
            })
            list.splice(0, list.length, ...listWithIndex.map(e => e.item))
            break
          }
        }
      }
      break
    case 'down':
      if (fieldName == 'interval') {
        list.sort((a, b) => {
          if (a.interval == null) {
            return b.interval == null ? 0 : 1
          } else return b.interval == null ? -1 : getIntv(b) - getIntv(a)
        })
      } else {
        switch (fieldName) {
          case 'name':
          case 'singer':
          case 'source':
            list.sort((a, b) => {
              if (a[fieldName] == null) {
                return b[fieldName] == null ? 0 : 1
              } else return b[fieldName] == null ? -1 : b[fieldName].localeCompare(a[fieldName], localeId)
            })
            break
          case 'albumName':
            list.sort((a, b) => {
              if (a.meta.albumName == null) {
                return b.meta.albumName == null ? 0 : 1
              } else return b.meta.albumName == null ? -1 : b.meta.albumName.localeCompare(a.meta.albumName, localeId)
            })
            break
          case 'playCount': {
            if (!playCounts) {
              console.log('[Worker] No playCounts provided for sorting')
              break
            }
            console.log('[Worker] Sorting by playCount (down), sample data:', Object.keys(playCounts).slice(0, 3), playCounts[Object.keys(playCounts)[0]])
            list.sort((a, b) => {
              const countA = playCounts[a.id] ?? 0
              const countB = playCounts[b.id] ?? 0
              // console.log(`[Worker] Comparing ${a.id}(${countA}) vs ${b.id}(${countB})`)
              return countB - countA
            })
            break
          }
          case 'addTime': {
            const listWithIndex = list.map((item, index) => ({ item, index }))
            listWithIndex.sort((a, b) => {
              const timeA = a.item.meta.addTime
              const timeB = b.item.meta.addTime
              if (timeA != null && timeB != null) {
                return timeA === timeB ? b.index - a.index : timeB - timeA
              }
              if (timeA != null) return -1
              if (timeB != null) return 1
              return b.index - a.index
            })
            list.splice(0, list.length, ...listWithIndex.map(e => e.item))
            break
          }
        }
      }
      break
  }
  return list
}

const variantRxp = /(\(|（).+(\)|）)/g
const variantRxp2 = /\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[/g
/**
 * 过滤列表内重复的歌曲
 * @param list 歌曲列表
 * @param isFilterVariant 是否过滤 Live Explicit 等歌曲名
 * @returns
 */
export const filterDuplicateMusic = async (list: LX.Music.MusicInfo[], isFilterVariant: boolean = true) => {
  type ListMapValue = Array<{ id: string, index: number, musicInfo: LX.Music.MusicInfo }>
  const listMap = new Map<string, ListMapValue>()
  const duplicateList = new Set<string>()
  const handleFilter = (name: string, index: number, musicInfo: LX.Music.MusicInfo) => {
    if (listMap.has(name)) {
      const targetMusicInfo = listMap.get(name)
      targetMusicInfo!.push({
        id: musicInfo.id,
        index,
        musicInfo,
      })
      duplicateList.add(name)
    } else {
      listMap.set(name, [{
        id: musicInfo.id,
        index,
        musicInfo,
      }])
    }
  }
  if (isFilterVariant) {
    list.forEach((musicInfo, index) => {
      let musicInfoName = musicInfo.name.toLowerCase().replace(variantRxp, '').replace(variantRxp2, '')
      musicInfoName ||= musicInfo.name.toLowerCase().replace(/\s+/g, '')
      handleFilter(musicInfoName, index, musicInfo)
    })
  } else {
    list.forEach((musicInfo, index) => {
      const musicInfoName = musicInfo.name.toLowerCase().trim()
      handleFilter(musicInfoName, index, musicInfo)
    })
  }
  // console.log(duplicateList)
  const duplicateNames = Array.from(duplicateList)
  duplicateNames.sort((a, b) => a.localeCompare(b))
  return duplicateNames.map(name => listMap.get(name)!).flat()
}

/**
 * 跨歌单重复歌曲位置信息
 */
export interface CrossListDuplicateLocation {
  listId: string
  listName: string
  index: number
}

/**
 * 跨歌单重复歌曲项
 */
export interface CrossListDuplicateItem {
  musicInfo: LX.Music.MusicInfo
  locations: CrossListDuplicateLocation[]
}

/**
 * 检测跨歌单的重复歌曲
 * @param listsData 所有歌单的数据
 * @param isFilterVariant 是否过滤变体（Live、Explicit等）
 * @returns 重复歌曲列表
 */
export const filterCrossListDuplicateMusic = async (
  listsData: Array<{
    listId: string
    listName: string
    musicList: LX.Music.MusicInfo[]
  }>,
  isFilterVariant: boolean = true
): Promise<CrossListDuplicateItem[]> => {
  // 使用 Map 存储：key = 歌曲名(标准化) + 歌手名, value = 该歌曲的所有出现位置
  const musicMap = new Map<string, CrossListDuplicateItem>()
  const duplicateKeys = new Set<string>()

  // 遍历所有歌单
  for (const { listId, listName, musicList } of listsData) {
    musicList.forEach((musicInfo, index) => {
      // 标准化歌曲名（参考 filterDuplicateMusic 的逻辑）
      let musicNameKey: string
      if (isFilterVariant) {
        musicNameKey = musicInfo.name.toLowerCase().replace(variantRxp, '').replace(variantRxp2, '')
        musicNameKey ||= musicInfo.name.toLowerCase().replace(/\s+/g, '')
      } else {
        musicNameKey = musicInfo.name.toLowerCase().trim()
      }

      // 添加歌手名到key中（与单歌单不同，这里需要考虑歌手）
      const singerKey = musicInfo.singer?.toLowerCase().trim() || ''
      const fullKey = `${musicNameKey}|||${singerKey}`

      if (musicMap.has(fullKey)) {
        // 已存在，添加新位置
        const item = musicMap.get(fullKey)!
        item.locations.push({ listId, listName, index })
        duplicateKeys.add(fullKey)
      } else {
        // 首次出现
        musicMap.set(fullKey, {
          musicInfo,
          locations: [{ listId, listName, index }]
        })
      }
    })
  }

  // 只返回出现在多个位置的歌曲
  const result: CrossListDuplicateItem[] = []
  for (const key of duplicateKeys) {
    const item = musicMap.get(key)!
    // 按歌单名排序
    item.locations.sort((a, b) => a.listName.localeCompare(b.listName))
    result.push(item)
  }

  // 按歌曲名排序
  result.sort((a, b) =>
    a.musicInfo.name.localeCompare(b.musicInfo.name)
  )

  // 为每个item添加唯一id（用于虚拟列表的key）
  return result.map((item, index) => ({
    ...item,
    id: `${item.musicInfo.id}_${index}`,
  }))
}

export const searchListMusic = (list: LX.Music.MusicInfo[], text: string) => {
  let result: LX.Music.MusicInfo[] = []
  let rxp = new RegExp(text.split('').map(s => s.replace(/[.*+?^${}()|[\]\\]/, '\\$&')).join('.*') + '.*', 'i')
  for (const mInfo of list) {
    const str = `${mInfo.name}${mInfo.singer}${mInfo.meta.albumName ? mInfo.meta.albumName : ''}`
    if (rxp.test(str)) result.push(mInfo)
  }

  const sortedList: Array<{ num: number, data: LX.Music.MusicInfo }> = []

  for (const mInfo of result) {
    sortInsert(sortedList, {
      num: similar(text, `${mInfo.name}${mInfo.singer}${mInfo.meta.albumName ? mInfo.meta.albumName : ''}`),
      data: mInfo,
    })
  }
  return sortedList.map(item => item.data).reverse()
}

/**
 * 搜索所有歌单中的歌曲
 * @param lists 所有歌单数据
 * @param text 搜索文本
 * @returns 搜索结果(包含歌单信息)
 */
export const searchAllListsMusic = (
  lists: Array<{ id: string, name: string, musicList: LX.Music.MusicInfo[] }>,
  text: string
): Array<LX.Music.MusicInfo & { listId: string, listName: string }> => {
  let result: Array<LX.Music.MusicInfo & { listId: string, listName: string }> = []

  for (const list of lists) {
    const matches = searchListMusic(list.musicList, text)
    result.push(...matches.map(music => ({
      ...music,
      listId: list.id,
      listName: list.name
    })))
  }

  return result
}

/**
 * 创建排序后的列表
 * @param list 原始列表
 * @param position 新位置
 * @param ids 要调整顺序的歌曲id
 * @returns
 */
export const createSortedList = (list: LX.Music.MusicInfo[], position: number, ids: string[]) => {
  const infos: LX.Music.MusicInfo[] = []
  const map = new Map<string, LX.Music.MusicInfo>()
  for (const item of list) map.set(item.id, item)
  for (const id of ids) {
    infos.push(map.get(id)!)
    map.delete(id)
  }
  list = list.filter(mInfo => map.has(mInfo.id))
  arrPushByPosition(list, infos, Math.min(position, list.length))
  return list
}


/**
 * 创建本地列表音乐信息
 * @param filePaths 文件路径
 */
export const createLocalMusicInfos = async (filePaths: string[]): Promise<LX.Music.MusicInfoLocal[]> => {
  const list: LX.Music.MusicInfoLocal[] = []
  for await (const path of filePaths) {
    const musicInfo = await createLocalMusicInfo(path)
    if (!musicInfo) continue
    list.push(musicInfo)
  }

  return list
}

/**
 * 导出列表到txt文件
 * @param savePath 保存路径
 * @param lists 列表数据
 * @param isMerge 是否合并
 */
export const exportPlayListToText = async (savePath: string, lists: Array<LX.List.MyDefaultListInfoFull | LX.List.MyLoveListInfoFull | LX.List.UserListInfoFull>, isMerge: boolean) => {
  const iconv = await import('iconv-lite')

  if (isMerge) {
    await saveStrToFile(savePath,
      iconv.encode(lists.map(l => l.list.map(m => `${m.name}  ${m.singer}  ${m.meta.albumName ?? ''}`).join('\n')).join('\n\n'), 'utf8', { addBOM: true }))
  } else {
    for await (const list of lists) {
      await saveStrToFile(joinPath(savePath, `lx_list_${filterFileName(list.name)}.txt`),
        iconv.encode(list.list.map(m => `${m.name}  ${m.singer}  ${m.meta.albumName ?? ''}`).join('\n'), 'utf8', { addBOM: true }))
    }
  }
}

/**
 * 导出列表到csv文件
 * @param savePath 保存路径
 * @param lists 列表数据
 * @param isMerge 是否合并
 * @param header 表头名称
 */
export const exportPlayListToCSV = async (savePath: string,
  lists: Array<LX.List.MyDefaultListInfoFull | LX.List.MyLoveListInfoFull | LX.List.UserListInfoFull>,
  isMerge: boolean,
  header: string) => {
  const iconv = await import('iconv-lite')

  const filterStr = (str: string) => {
    if (!str) return ''
    str = str.replace(/"/g, '""')
    if (str.includes(',')) str = `"${str}"`
    return str
  }

  if (isMerge) {
    await saveStrToFile(savePath, iconv.encode(header + lists.map(l => l.list.map(m => `${filterStr(m.name)},${filterStr(m.singer)},${filterStr(m.meta.albumName ?? '')}`).join('\n')).join('\n'), 'utf8', { addBOM: true }))
  } else {
    for await (const list of lists) {
      await saveStrToFile(joinPath(savePath, `lx_list_${filterFileName(list.name)}.csv`), iconv.encode(header + list.list.map(m => `${filterStr(m.name)},${filterStr(m.singer)},${filterStr(m.meta.albumName ?? '')}`).join('\n'), 'utf8', { addBOM: true }))
    }
  }
}
