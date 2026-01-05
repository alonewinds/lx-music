/**
 * 酷我音乐歌词搜索 API
 * 复用现有的 musicSdk/kw 模块
 */

import musicSearch from '../musicSdk/kw/musicSearch'
import lyric from '../musicSdk/kw/lyric'

const source = 'kw'
const name = '酷我音乐'

/**
 * 搜索歌曲
 * @param {string} keyword 关键词
 * @param {number} page 页码
 * @returns {Promise<import('./types').SearchResult>}
 */
const searchSongs = async (keyword, page = 1) => {
    const limit = 20
    const result = await musicSearch.search(keyword, page, limit)

    const list = result.list.map(item => ({
        source,
        id: item.songmid?.toString(),
        name: item.name,
        singer: item.singer,
        album: item.albumName,
        duration: parseInterval(item.interval),
        img: item.img,
        _extra: {
            songmid: item.songmid,
            albumId: item.albumId,
        },
    }))

    return {
        list,
        page,
        hasMore: page < result.allPage,
        total: result.total,
    }
}

/**
 * 获取歌词
 * @param {import('./types').SongSearchInfo} songInfo 歌曲信息
 * @returns {Promise<import('./types').LyricContent>}
 */
const getLyric = async (songInfo) => {
    const mInfo = {
        songmid: songInfo._extra?.songmid || songInfo.id,
    }

    const result = await lyric.getLyric(mInfo).promise

    return {
        lyric: result.lyric || '',
        tlyric: result.tlyric || '',
        rlyric: result.rlyric || '',
        lxlyric: result.lxlyric || '',
    }
}

/**
 * 解析时长字符串为毫秒
 * @param {string} interval 时长字符串 "mm:ss"
 * @returns {number}
 */
const parseInterval = (interval) => {
    if (!interval) return 0
    const parts = interval.split(':')
    if (parts.length !== 2) return 0
    return (parseInt(parts[0]) * 60 + parseInt(parts[1])) * 1000
}

export default {
    source,
    name,
    searchSongs,
    getLyric,
}
