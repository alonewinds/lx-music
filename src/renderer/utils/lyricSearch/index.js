/**
 * 歌词搜索 API 统一入口
 * 支持同时搜索多个平台
 */

import txApi from './tx'
import kgApi from './kg'
import wyApi from './wy'
import kwApi from './kw'
import { settleAll, sourceNames } from './utils'

/** 所有可用的搜索源 */
export const sources = {
    tx: txApi,
    kg: kgApi,
    wy: wyApi,
    kw: kwApi,
}

/** 来源名称映射 */
export { sourceNames }

/**
 * 从单个平台搜索歌曲
 * @param {string} keyword 关键词
 * @param {'tx' | 'kg' | 'wy' | 'kw'} source 来源
 * @param {number} page 页码
 * @returns {Promise<import('./types').SearchResult>}
 */
export const searchFromSource = async (keyword, source, page = 1) => {
    const api = sources[source]
    if (!api) throw new Error(`Unknown source: ${source}`)
    return api.searchSongs(keyword, page)
}

/**
 * 从所有平台并发搜索歌曲
 * @param {string} keyword 关键词
 * @param {number} page 页码
 * @returns {Promise<{list: import('./types').SongSearchInfo[], errors: Error[]}>}
 */
export const searchAllSources = async (keyword, page = 1) => {
    const promises = Object.values(sources).map(api =>
        api.searchSongs(keyword, page).catch(err => {
            console.error(`[lyricSearch] ${api.name} search failed:`, err)
            return { list: [], page, hasMore: false, error: err }
        })
    )

    const results = await Promise.all(promises)

    // 合并所有结果
    const allList = []
    const errors = []

    for (const result of results) {
        if (result.error) {
            errors.push(result.error)
        } else {
            allList.push(...result.list)
        }
    }

    return { list: allList, errors }
}

/**
 * 根据歌曲信息获取歌词
 * @param {import('./types').SongSearchInfo} songInfo 歌曲信息
 * @returns {Promise<import('./types').LyricContent>}
 */
export const getLyricByInfo = async (songInfo) => {
    const api = sources[songInfo.source]
    if (!api) throw new Error(`Unknown source: ${songInfo.source}`)
    return api.getLyric(songInfo)
}

export default {
    sources,
    sourceNames,
    searchFromSource,
    searchAllSources,
    getLyricByInfo,
}
